const { getPanelConfig, resolveWalletCurrency } = require("../config");
const { createJar, fetchWithJar } = require("./_cookies");
const { describeFetchError } = require("./_fetchError");

function normalizeOrderLink(url) {
  if (!url || typeof url !== "string") return url;
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u).toString();
  } catch {
    return u;
  }
}

function parseBrlMoney(raw) {
  let t = String(raw).trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) {
    return Number.parseFloat(t.replace(/\./g, "").replace(",", "."));
  }
  if (t.includes(",") && !t.includes(".")) {
    return Number.parseFloat(t.replace(",", "."));
  }
  return Number.parseFloat(t);
}

function extractBalance(html) {
  if (!html || typeof html !== "string") return null;
  const m =
    html.match(
      /<span[^>]*class="[^"]*tx-medium[^"]*tx-secondary[^"]*"[^>]*>[\s\S]*?Saldo atual:\s*R\$\s*([\d.,]+)/i,
    ) || html.match(/Saldo atual:\s*R\$\s*([\d.,]+)/i);
  if (!m) return null;
  const n = parseBrlMoney(m[1]);
  return n != null && !Number.isNaN(n) ? n : null;
}

function stillOnLoginPage(html) {
  if (!html) return false;
  return (
    /name=["']username["']/i.test(html) &&
    /name=["']password["']/i.test(html) &&
    /password/i.test(html)
  );
}

async function fetchLandingAfterLoginRedirect(res, jar, base) {
  const loc = res.headers.get("location");
  await res.text();
  if (loc) {
    const url = loc.startsWith("http") ? loc : new URL(loc, base).href;
    return fetchWithJar(url, jar, { method: "GET" });
  }
  return fetchWithJar(`${base}/`, jar, { method: "GET" });
}

async function checkAccount(user, pass) {
  const cfg = getPanelConfig("fabricadeseguidores");
  const base = String(cfg?.baseUrl || "https://fabricadeseguidores.com.br").replace(
    /\/$/,
    "",
  );
  const jar = createJar();
  try {
    let res = await fetchWithJar(`${base}/`, jar, { method: "GET" });
    await res.text();

    const loginBody = new URLSearchParams({
      username: user,
      password: pass,
    });

    res = await fetchWithJar(`${base}/`, jar, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${base}/`,
      },
      body: loginBody.toString(),
    });

    if (res.status === 200) {
      await res.text();
      return {
        ok: false,
        balance: null,
        error: "Usuário ou senha incorretos",
      };
    }

    if (res.status !== 302) {
      await res.text();
      return {
        ok: false,
        balance: null,
        error: `Login die (HTTP ${res.status})`,
      };
    }

    res = await fetchLandingAfterLoginRedirect(res, jar, base);
    let html = await res.text();
    let balance = extractBalance(html);

    const paths = ["/", "/dashboard", "/painel", "/account", "/home"];
    for (const p of paths) {
      if (balance != null) break;
      res = await fetchWithJar(`${base}${p}`, jar, { method: "GET" });
      html = await res.text();
      balance = extractBalance(html);
    }

    if (balance == null) {
      if (stillOnLoginPage(html)) {
        return {
          ok: false,
          balance: null,
          error: "Sessão não mantida após login",
        };
      }
      return {
        ok: false,
        balance: null,
        error: "Saldo não encontrado no HTML",
      };
    }

    return {
      ok: true,
      balance,
      currency: resolveWalletCurrency(cfg, "BRL"),
    };
  } catch (e) {
    return {
      ok: false,
      balance: null,
      error: describeFetchError(e),
    };
  }
}

function evaluateOrderResponse(bodyText, status) {
  const t = String(bodyText).trim();
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      if (j.success === true || j.status === "success") {
        return { ok: true, message: j.message };
      }
      if (j.error || j.message) {
        return { ok: false, message: String(j.error || j.message) };
      }
    } catch {
      /* noop */
    }
  }
  if (status === 302 || status === 301 || status === 303) {
    return { ok: true };
  }
  if (/sucesso|success|pedido\s+realizad|realizado/i.test(t.slice(0, 8000))) {
    return { ok: true };
  }
  if (/erro|error|inválid|invalid|saldo\s+insuficiente/i.test(t.slice(0, 4000))) {
    return { ok: false, message: t.slice(0, 400) };
  }
  return { ok: status >= 200 && status < 400, message: t.slice(0, 300) };
}

async function createOrder(sessionJar, options) {
  const cfg = getPanelConfig("fabricadeseguidores");
  const base = String(cfg?.baseUrl || "https://fabricadeseguidores.com.br").replace(
    /\/$/,
    "",
  );
  const categories = cfg.orderCategoryId;
  const services = cfg.serviceIdFollowers;
  if (categories == null || services == null) {
    return {
      ok: false,
      error: "Configure orderCategoryId e serviceIdFollowers em config.js.",
      status: null,
      bodySnippet: "",
    };
  }
  const link = normalizeOrderLink(options.link);
  const quantity = Math.floor(
    Math.max(
      (cfg && cfg.orderMinQuantity) ?? 500,
      Number.parseInt(String(options.quantity ?? 500), 10) || 500,
    ),
  );

  const jar = sessionJar || createJar();
  const body = new URLSearchParams({
    categories: String(categories),
    services: String(services),
    link,
    quantity: String(quantity),
  });

  const res = await fetchWithJar(`${base}/`, jar, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      Referer: `${base}/`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body.toString(),
  });
  const bodyText = await res.text();
  const ev = evaluateOrderResponse(bodyText, res.status);
  return {
    ok: ev.ok,
    status: res.status,
    jar,
    error: ev.ok ? undefined : ev.message || "Resposta do pedido não confirmada",
    bodySnippet: bodyText.slice(0, 1200),
  };
}

async function loginAndCreateOrder(user, pass, orderOptions) {
  const cfg = getPanelConfig("fabricadeseguidores");
  const base = String(cfg?.baseUrl || "https://fabricadeseguidores.com.br").replace(
    /\/$/,
    "",
  );
  const jar = createJar();
  try {
    let res = await fetchWithJar(`${base}/`, jar, { method: "GET" });
    await res.text();

    const loginBody = new URLSearchParams({
      username: user,
      password: pass,
    });

    res = await fetchWithJar(`${base}/`, jar, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${base}/`,
      },
      body: loginBody.toString(),
    });

    if (res.status === 200) {
      await res.text();
      return { ok: false, error: "Usuário ou senha incorretos", status: res.status };
    }

    if (res.status !== 302) {
      await res.text();
      return {
        ok: false,
        error: `Login die (HTTP ${res.status})`,
        status: res.status,
      };
    }

    res = await fetchLandingAfterLoginRedirect(res, jar, base);
    await res.text();

    return createOrder(jar, orderOptions);
  } catch (e) {
    return { ok: false, error: describeFetchError(e), status: null };
  }
}

module.exports = {
  id: "fabricadeseguidores",
  label: "Fábrica de Seguidores",
  checkAccount,
  createOrder,
  loginAndCreateOrder,
};
