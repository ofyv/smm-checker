const fs = require("fs");
const path = require("path");
const { getPanelConfig, resolveWalletCurrency } = require("../config");
const { createJar, fetchWithJar } = require("./_cookies");
const { describeFetchError } = require("./_fetchError");
const { inferCurrencyFromRawBalanceText } = require("./_currency");

function extractCsrf(html) {
  if (!html || typeof html !== "string") return null;
  const patterns = [
    /name="_csrf"[\s\n]*value="([^"]+)"/i,
    /name='_csrf'[\s\n]*value='([^']+)'/i,
    /value="([^"]+)"[\s\n]*name="_csrf"/i,
    /value='([^']+)'[\s\n]*name='_csrf'/i,
    /<meta\s+name="csrf-token"\s+content="([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function extractLoginFormAction(html) {
  if (!html || typeof html !== "string") return null;
  const idx = html.search(/LoginForm\[username\]/i);
  if (idx === -1) return null;
  const chunk = html.slice(Math.max(0, idx - 2800), idx);
  const open = chunk.lastIndexOf("<form");
  if (open === -1) return null;
  const formHead = chunk.slice(open);
  const closeTag = formHead.indexOf(">");
  if (closeTag === -1) return null;
  const tagContent = formHead.slice(0, closeTag + 1);
  const actionM = /\baction\s*=\s*(["'])([^"']*)\1/i.exec(tagContent);
  if (actionM && actionM[2] !== undefined) {
    const a = String(actionM[2]).trim();
    return a.length > 0 ? a : null;
  }
  return null;
}

function resolveLoginPostUrl(base, pageUrl, actionRel) {
  const page =
    pageUrl && String(pageUrl).trim().length > 0
      ? String(pageUrl).trim()
      : `${String(base || "").replace(/\/$/, "")}/`;
  if (actionRel == null || actionRel === "") {
    return page;
  }
  try {
    return new URL(actionRel, page).href;
  } catch {
    const b = String(base || "").replace(/\/$/, "");
    return `${b}/`;
  }
}

function parseMoney(s) {
  let t = String(s).trim();
  t = t.replace(/^[≈~∼]\s*/u, "");
  t = t.trim();
  t = t.replace(
    /^(US\$|USD\s*|R\$\s*|R\s+|\$\s*|₹\s*|Rs\.?\s*|INR\s*)/i,
    "",
  );
  t = t.replace(/[$\s\u00A0\u20B9]/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) {
    return Number.parseFloat(t.replace(/,/g, ""));
  }
  if (t.includes(",") && !t.includes(".")) {
    return Number.parseFloat(t.replace(/\./g, "").replace(",", "."));
  }
  return Number.parseFloat(t);
}

function finishBalanceMeta(balance, raw) {
  const inferredCurrency = inferCurrencyFromRawBalanceText(
    raw != null ? String(raw) : null,
  );
  return {
    balance,
    raw: raw != null ? String(raw).trim() : "",
    inferredCurrency,
  };
}

function pickQuotedBalanceFromHtml(html, preferLast) {
  const re = /"balance"\s*:\s*"?([\d.]+)"?/gi;
  const hits = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isNaN(n)) hits.push(n);
  }
  if (hits.length === 0) return null;
  const n = preferLast ? hits[hits.length - 1] : hits[0];
  return finishBalanceMeta(n, null);
}

function pickBalanceFromUserOrAccountJson(html) {
  const openers = [
    /"user"\s*:\s*\{/gi,
    /"me"\s*:\s*\{/gi,
    /"account"\s*:\s*\{/gi,
    /"customer"\s*:\s*\{/gi,
    /"authUser"\s*:\s*\{/gi,
  ];
  const balRe =
    /"(?:balance|wallet_balance|walletBalance|available_balance)"\s*:\s*"?([\d.]+)"?/gi;
  for (const openRe of openers) {
    let lastOm = null;
    let om;
    openRe.lastIndex = 0;
    while ((om = openRe.exec(html)) !== null) {
      lastOm = om;
    }
    if (!lastOm) continue;
    const chunk = html.slice(lastOm.index, lastOm.index + 48000);
    const nums = [];
    let bm;
    balRe.lastIndex = 0;
    while ((bm = balRe.exec(chunk)) !== null) {
      const n = Number.parseFloat(bm[1]);
      if (!Number.isNaN(n)) nums.push(n);
    }
    if (nums.length > 0) {
      const n = nums[nums.length - 1];
      return Object.assign(finishBalanceMeta(n, null), {
        __fromUserJson: true,
      });
    }
  }
  return null;
}

function brlIndexLooksLikeMinimumDeposit(html, idx) {
  const ctx = html
    .slice(Math.max(0, idx - 400), idx + 500)
    .toLowerCase();
  return /(m[ií]nimo|minimum|min\.?\s*dep|dep[oó]sito|a\s+partir|starting\s+at|somente\s+a\s+partir|from\s+r\$|adicione\s+fund|add\s+fund|recarg|valor\s+m[ií]nimo|no\s+m[ií]nimo|pedido\s+m[ií]nimo|order\s+m[ií]nimo|minimum\s+order|minimum\s+amount|m[ií]n\.\s*dep)/i.test(
    ctx,
  );
}

function extractBalanceMeta(html, hints = {}) {
  const m = extractBalanceMetaInner(html, hints);
  if (
    m != null &&
    hints.balanceRejectDomFifteen === true &&
    m.balance === 15 &&
    !m.__fromUserJson
  ) {
    return null;
  }
  if (m != null && m.__fromUserJson) {
    delete m.__fromUserJson;
  }
  return m;
}

function extractBalanceMetaInner(html, hints = {}) {
  if (!html || typeof html !== "string") return null;

  const spendingM = html.match(
    /<h4[^>]*class="total-title"[^>]*>\s*Account Spending\s*<\/h4>[\s\S]{0,400}<p[^>]*class="total-txt"[^>]*>\s*([^<]{1,32})\s*</i,
  );
  if (spendingM && spendingM[1]) {
    const n = parseMoney(spendingM[1]);
    if (n != null && !Number.isNaN(n)) return finishBalanceMeta(n, spendingM[1]);
  }

  const preferLastDd = hints.preferLastBalanceDropdown === true;
  const preferLastJson = hints.preferLastJsonBalance === true;
  const userJsonFirst = hints.balanceJsonUserBlockFirst === true;
  const skipGenericJsonBalance = hints.balanceJsonSkipGenericQuoted === true;

  const tryText = (raw) => {
    const n = parseMoney(raw);
    if (n != null && !Number.isNaN(n)) return finishBalanceMeta(n, raw);
    return null;
  };

  if (userJsonFirst) {
    const fromUser = pickBalanceFromUserOrAccountJson(html);
    if (fromUser != null) return fromUser;
  }

  const totalsStatLabelRe =
    /totals-block__card-name[\s\S]{0,160}<(p|div|span)[^>]*>([^<]{0,80})</i;
  function totalsCardLabelNearIndex(idx) {
    const slice = html.slice(idx, idx + 700);
    const lm = slice.match(totalsStatLabelRe);
    if (!lm || !lm[2]) return null;
    return String(lm[2])
      .replace(/\s+/g, " ")
      .trim();
  }
  function totalsSliceLooksLikeMinimumOrPromo(idx) {
    const label = totalsCardLabelNearIndex(idx);
    if (!label) return false;
    return /(m[ií]nimo|minimum|dep[oó]sito|a\s+partir|adicione|somente\s+a|starting\s+at|desde|lance|oferta)/i.test(
      label,
    );
  }
  function totalsSliceLooksLikeStatBlock(idx) {
    if (idx == null || idx < 0) return false;
    const slice = html.slice(idx, idx + 700);
    const lm = slice.match(totalsStatLabelRe);
    if (!lm || !lm[2]) return false;
    const label = String(lm[2])
      .replace(/\s+/g, " ")
      .trim();
    return /^(total\s+services|total\s+orders|servi[cç]os\s+totais|pedidos\s+totais|total\s+de\s+servi[cç]os|total\s+de\s+pedidos|todos\s+os\s+pedidos)\s*$/i.test(
      label,
    );
  }

  const reLine = /<[^>]*\bbalance-dropdown__(?:name|toggle)\b[^>]*>\s*([^<]+)</gi;
  let m;
  let lastDdMeta = null;
  while ((m = reLine.exec(html)) !== null) {
    const r = tryText(m[1]);
    if (r != null) {
      if (
        r.balance === 15 &&
        brlIndexLooksLikeMinimumDeposit(html, m.index)
      ) {
        continue;
      }
      if (!preferLastDd) return r;
      lastDdMeta = r;
    }
  }
  if (lastDdMeta != null) return lastDdMeta;

  const reNested = /<[^>]*\bbalance-dropdown__(?:name|toggle)\b[^>]*>([\s\S]*?)<\/div>/gi;
  let lastNested = null;
  while ((m = reNested.exec(html)) !== null) {
    const inner = m[1].replace(/<[^>]+>/g, "").trim();
    const r = tryText(inner);
    if (r != null) {
      if (
        r.balance === 15 &&
        brlIndexLooksLikeMinimumDeposit(html, m.index)
      ) {
        continue;
      }
      if (!preferLastDd) return r;
      lastNested = r;
    }
  }
  if (lastNested != null) return lastNested;

  const looseRe =
    /balance-dropdown__(?:name|toggle)[^>]*>\s*([^<\n\r]{0,48})/gi;
  let lastLoose = null;
  while ((m = looseRe.exec(html)) !== null) {
    const r = tryText(m[1]);
    if (r != null) {
      if (
        r.balance === 15 &&
        brlIndexLooksLikeMinimumDeposit(html, m.index)
      ) {
        continue;
      }
      if (!preferLastDd) return r;
      lastLoose = r;
    }
  }
  if (lastLoose != null) return lastLoose;

  const dataBal = html.match(/data-balance="([^"]+)"/i);
  if (dataBal) {
    const r = tryText(dataBal[1]);
    if (r != null) return r;
  }

  const totalsWalletColorRe =
    /<h2(?=[^>]*\bclass="[^"]*\btotals-block__count-value\b)(?=[^>]*\bstyle-text-primary\b)(?=[^>]*color-id-26)[^>]*>([\s\S]*?)<\/h2>/gi;
  let twM;
  while ((twM = totalsWalletColorRe.exec(html)) !== null) {
    const inner = twM[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/R\$/i.test(inner)) continue;
    const r = tryText(inner);
    if (r != null) return r;
  }

  const totalsStrictRe =
    /<([a-z][a-z0-9]*)[^>]*\bclass="(?=[^"]*\btotals-block__count-value\b)(?=[^"]*\bstyle-text-primary\b)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let tsM;
  while ((tsM = totalsStrictRe.exec(html)) !== null) {
    if (totalsSliceLooksLikeStatBlock(tsM.index)) continue;
    if (totalsSliceLooksLikeMinimumOrPromo(tsM.index)) continue;
    const inner = tsM[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/R\$/i.test(inner)) continue;
    const r = tryText(inner);
    if (r != null) return r;
  }

  const totalsRe =
    /<([a-z][a-z0-9]*)[^>]*\bclass="[^"]*\btotals-block__count-value\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let totalsM;
  let lastTotalsMeta = null;
  while ((totalsM = totalsRe.exec(html)) !== null) {
    if (totalsSliceLooksLikeStatBlock(totalsM.index)) continue;
    if (totalsSliceLooksLikeMinimumOrPromo(totalsM.index)) continue;
    const inner = totalsM[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/R\$/i.test(inner)) continue;
    const r = tryText(inner);
    if (r != null) lastTotalsMeta = r;
  }
  if (lastTotalsMeta != null) return lastTotalsMeta;

  const wallet = html.match(
    /(?:user-balance|wallet-balance|header-balance)[^>]*>\s*([^<]{0,32})/i,
  );
  if (wallet) {
    const r = tryText(wallet[1]);
    if (r != null) return r;
  }

  const userBal = html.match(
    /user[_-]?balance["']?\s*[:=]\s*["']?([\d.]+)/i,
  );
  if (userBal) {
    const n = Number.parseFloat(userBal[1]);
    if (!Number.isNaN(n)) return finishBalanceMeta(n, null);
  }

  const nearRe =
    /(?:saldo|balance|wallet)[^$]{0,80}\$\s*([\d.,]+)/i;
  const nearBalance = nearRe.exec(html);
  if (nearBalance) {
    if (!brlIndexLooksLikeMinimumDeposit(html, nearBalance.index)) {
      const r = tryText(nearBalance[1]);
      if (r != null) return r;
    }
  }

  const hiddenBal = html.match(
    /<input[^>]+name="[^"]*balance[^"]*"[^>]+value="([\d.]+)"/i,
  );
  if (hiddenBal) {
    const n = Number.parseFloat(hiddenBal[1]);
    if (!Number.isNaN(n)) return finishBalanceMeta(n, null);
  }

  const idBal = html.match(
    /id="[^"]*(?:userBalance|user_balance|walletBalance|headerBalance)[^"]*"[^>]*>([^<]+)</i,
  );
  if (idBal) {
    const r = tryText(idBal[1]);
    if (r != null) return r;
  }

  const bemdash = html.match(
    /class="[^"]*balance[_-]dropdown[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  );
  if (bemdash) {
    for (const block of bemdash) {
      const inner = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const money = inner.match(/(\$?\s*[\d.,]+)/);
      if (money) {
        const r = tryText(money[1]);
        if (r != null) return r;
      }
    }
  }

  const scriptMoney = html.match(
    /(?:available_balance|user_balance|total_balance|account_balance)\s*[:=]\s*['"]?([\d.]+)/i,
  );
  if (scriptMoney) {
    const n = Number.parseFloat(scriptMoney[1]);
    if (!Number.isNaN(n)) return finishBalanceMeta(n, null);
  }

  if (!skipGenericJsonBalance) {
    const jsonBalMeta = pickQuotedBalanceFromHtml(html, preferLastJson);
    if (jsonBalMeta != null) return jsonBalMeta;
  }

  if (!skipGenericJsonBalance) {
    const jsonSnippets = html.match(/\{[^{}]{0,800}"balance"[^{}]{0,800}\}/gi);
    if (jsonSnippets) {
      const iter = preferLastJson ? [...jsonSnippets].reverse() : jsonSnippets;
      for (const chunk of iter) {
        const jb = chunk.match(/"balance"\s*:\s*"?([\d.]+)"?/i);
        if (jb) {
          const n = Number.parseFloat(jb[1]);
          if (!Number.isNaN(n)) return finishBalanceMeta(n, null);
        }
      }
    }
  }

  const brlRe = /\bR\$\s*([\d.,]+)/gi;
  let brlM;
  while ((brlM = brlRe.exec(html)) !== null) {
    if (brlIndexLooksLikeMinimumDeposit(html, brlM.index)) continue;
    const tail = html.slice(brlM.index, brlM.index + 520);
    const nameTag = tail.match(
      /totals-block__card-name[\s\S]{0,200}<(p|div|span)[^>]*>([^<]{0,96})</i,
    );
    if (nameTag && nameTag[2]) {
      const lab = String(nameTag[2])
        .replace(/\s+/g, " ")
        .trim();
      if (
        /^(total\s+services|total\s+orders|servi[cç]os\s+totais|pedidos\s+totais|total\s+de\s+servi[cç]os|total\s+de\s+pedidos|todos\s+os\s+pedidos)\s*$/i.test(
          lab,
        )
      ) {
        continue;
      }
    }
    const r = tryText(`R$ ${brlM[1]}`);
    if (r != null) return r;
  }

  const scout = extractBalanceNearKeywordMeta(html);
  if (scout != null) return scout;

  return null;
}

function extractBalanceNearKeywordMeta(html) {
  const lower = html.toLowerCase();
  const needle = "balance";
  let from = 0;
  while (from < lower.length) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) break;
    const slice = html.slice(Math.max(0, idx - 120), idx + 220);
    if (
      /top\s*up|deposit|bonus|add\s*fund|payment|stripe|cryptomus|card\s*payment/i.test(
        slice,
      )
    ) {
      from = idx + needle.length;
      continue;
    }
    const m =
      slice.match(/\$\s*([\d.,]+)/) ||
      slice.match(/([\d.,]+)\s*(?:USD|US\$|\$)/i);
    if (m) {
      const rel = slice.indexOf(m[0]);
      const gIdx = Math.max(0, idx - 120) + (rel >= 0 ? rel : 0);
      if (brlIndexLooksLikeMinimumDeposit(html, gIdx)) {
        from = idx + needle.length;
        continue;
      }
      const raw = m[0];
      const n = parseMoney(m[1]);
      if (n != null && !Number.isNaN(n)) return finishBalanceMeta(n, raw);
    }
    from = idx + needle.length;
  }
  return null;
}

function extractBalance(html) {
  const meta = extractBalanceMeta(html);
  return meta != null ? meta.balance : null;
}

function stillOnLoginForm(html) {
  if (!html) return false;
  const hasUser = /LoginForm\[username\]|name=['"]LoginForm\[username\]/i.test(html);
  const hasPass = /LoginForm\[password\]|type=['"]password['"]/i.test(html);
  const hasSign = /Sign in|Entrar|Fazer login|Login/i.test(html);
  return hasUser && hasPass && hasSign;
}

function looksLikeLoginFailure(html) {
  if (!html) return true;
  if (
    /senha incorreta|invalid password|incorrect password|dados inválidos|invalid credentials|wrong password|account not found|user not found/i.test(
      html,
    )
  ) {
    return true;
  }
  return stillOnLoginForm(html);
}

function isLikelyWafOrBotBlockHtml(html) {
  if (!html || typeof html !== "string") return false;
  const s = html.slice(0, 32000);
  return (
    /Unable to verify your domain submission/i.test(s) ||
    /cf-browser-verification|challenge-platform|__cf_chl/i.test(s) ||
    /\bJust a moment\b.*Cloudflare/i.test(s) ||
    /<title[^>]*>\s*Attention Required/i.test(s)
  );
}

function isLoginLiveRedirect(status) {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

function loginPostFailureMessage(status) {
  if (status === 401) return "Usuário ou senha incorreto";
  return `Login die (HTTP ${status}, esperado redirect 301/302/303/307/308)`;
}

async function fetchLandingAfterLoginRedirect(res, jar, base, extraOpts = {}) {
  const loc = res.headers.get("location");
  await res.text();
  const getOpts = { method: "GET", ...extraOpts };
  const baseRef =
    typeof res.url === "string" && res.url.length > 0 ? res.url : base;
  const baseStr = String(baseRef || "").replace(/\/$/, "");
  if (loc) {
    const url = loc.startsWith("http") ? loc : new URL(loc, baseRef).href;
    return fetchWithJar(url, jar, getOpts);
  }
  return fetchWithJar(`${baseStr}/`, jar, getOpts);
}

function buildOrderBody(fields) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) p.set(k, String(v));
  }
  return p.toString();
}

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

function joinBasePath(base, relPath) {
  const b = String(base || "").trim();
  let p = String(relPath || "").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  try {
    const baseForUrl = /\/$/u.test(b) ? b : `${b}/`;
    return new URL(p, baseForUrl).href;
  } catch {
    const b2 = b.replace(/\/$/, "");
    return b2 + p;
  }
}

function loginPostHeaders(base, refererOverride) {
  const ref =
    refererOverride != null && String(refererOverride).trim() !== ""
      ? String(refererOverride).trim()
      : `${String(base || "").replace(/\/$/, "")}/`;
  const h = {
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: ref,
  };
  try {
    h.Origin = new URL(ref).origin;
  } catch {
    try {
      const b = String(base || "").replace(/\/$/, "");
      h.Origin = new URL(`${b}/`).origin;
    } catch {
      /* noop */
    }
  }
  return h;
}

function isHtmlNotFoundOrErrorPage(html) {
  if (!html) return true;
  return (
    /<title[^>]*>\s*Error\s*404/i.test(html) ||
    /<title[^>]*>\s*Error\s*400/i.test(html) ||
    /<title[^>]*>\s*404\s*Not Found/i.test(html)
  );
}

function evaluateOrderApiResponse(body) {
  const t = String(body).trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t);
    if (j.status === "success") {
      return { ok: true, message: j.message };
    }
    if (j.status === "error") {
      return { ok: false, message: j.message || "Erro na API" };
    }
    if (j.success === true) {
      return { ok: true, message: j.message };
    }
    return null;
  } catch {
    return null;
  }
}

function extractOrderResponseError(html, status) {
  if (!html) return status ? `HTTP ${status}` : "resposta vazia";
  const ct = typeof html === "string";
  if (ct && html.trim().startsWith("{")) {
    try {
      const j = JSON.parse(html);
      if (j.message) return String(j.message);
      if (j.error) return String(j.error);
      if (j.errors) return JSON.stringify(j.errors).slice(0, 500);
      if (typeof j === "string") return j;
    } catch {
      /* noop */
    }
  }
  const s = String(html);
  const alertM = s.match(
    /class="[^"]*alert[^"]*danger[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (alertM) {
    const t = alertM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 400);
  }
  const helpM = s.match(/class="[^"]*help-block[^"]*[^>]*>([^<]+)/i);
  if (helpM) return helpM[1].trim().slice(0, 400);
  const invM = s.match(/class="[^"]*invalid-feedback[^"]*"[^>]*>([^<]+)/i);
  if (invM) return invM[1].trim().slice(0, 400);
  const pErr = s.match(/<p[^>]*class="[^"]*text-danger[^"]*"[^>]*>([^<]+)/i);
  if (pErr) return pErr[1].trim().slice(0, 400);
  if (isHtmlNotFoundOrErrorPage(s)) {
    return `Página de erro (${status}) — rota de pedido pode estar errada (ex.: falta /en/)`;
  }
  return `HTTP ${status} — trecho: ${s.slice(0, 280).replace(/\s+/g, " ")}`;
}

async function fetchOrderCreatePage(jar, base, extraOpts = {}, extraPaths = []) {
  const getOpts = { method: "GET", ...extraOpts };
  const orderCsrfUrl = `${base.replace(/\/$/, "")}/?platform=instagram`;
  let res = await fetchWithJar(orderCsrfUrl, jar, getOpts);
  let html = await res.text();
  if (res.status < 400 && !isHtmlNotFoundOrErrorPage(html)) {
    const csrf = extractCsrf(html);
    if (csrf) {
      return {
        res,
        html,
        url: orderCsrfUrl,
        csrf,
        fromOrderPage: false,
      };
    }
  }

  const paths = [
    ...(Array.isArray(extraPaths) ? extraPaths.filter(Boolean) : []),
    joinBasePath(base, "/order/create"),
    joinBasePath(base, "/order/create/"),
    joinBasePath(base, "/en/order/create"),
    joinBasePath(base, "/en/order/create/"),
    joinBasePath(base, "/pt/order/create"),
    joinBasePath(base, "/pt/order/create/"),
    joinBasePath(base, "/en/order"),
    joinBasePath(base, "/pt/order"),
    joinBasePath(base, "/order"),
  ];
  let last = { res: null, html: "", url: paths[0] };
  for (const url of paths) {
    const res = await fetchWithJar(url, jar, getOpts);
    const html = await res.text();
    last = { res, html, url };
    if (res.status >= 400) continue;
    if (isHtmlNotFoundOrErrorPage(html)) continue;
    const csrf = extractCsrf(html);
    if (!csrf) continue;
    if (/name=["']OrderForm\[category\]/i.test(html) || /OrderForm\[category\]/i.test(html)) {
      return { res, html, url, csrf, fromOrderPage: true };
    }
  }
  const homePaths = [
    joinBasePath(base, "/"),
    joinBasePath(base, "/en"),
    joinBasePath(base, "/en/"),
    joinBasePath(base, "/pt"),
    joinBasePath(base, "/pt/"),
  ];
  for (const url of homePaths) {
    const res = await fetchWithJar(url, jar, getOpts);
    const html = await res.text();
    last = { res, html, url };
    if (res.status >= 400) continue;
    if (isHtmlNotFoundOrErrorPage(html)) continue;
    const csrf = extractCsrf(html);
    if (csrf) {
      return {
        res,
        html,
        url,
        csrf,
        fromOrderPage: false,
      };
    }
  }
  return last;
}

function createResellerPanelApi(panelId, options = {}) {
  const debugPrefix = options.debugPrefix || panelId;
  const debugFileBase = options.debugFileBase || `debug-${panelId}`;
  const baseUrlFallback = options.baseUrlFallback || "";

  function getPanelFetchExtra() {
    const c = getPanelConfig(panelId);
    return c && c.fetchNoProxy === true ? { noProxy: true } : {};
  }

  function debugSmmEnabled() {
    return (
      process.env.SMM_PANEL_DEBUG === "1" ||
      process.env.SMM_PANEL_DEBUG === "true" ||
      process.env.SMM_CENTER_DEBUG === "1" ||
      process.env.SMM_CENTER_DEBUG === "true"
    );
  }

  function safeUserFile(user) {
    return String(user).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "user";
  }

  function dumpReturnedHtml(user, tag, res, html) {
    const root = path.join(__dirname, "..");
    const fn = path.join(
      root,
      `${debugFileBase}-${safeUserFile(user)}-${tag}.html`,
    );
    try {
      fs.writeFileSync(fn, html ?? "", "utf8");
      console.error(
        `[${debugPrefix}] HTML da página retornada → arquivo: ${fn} | ${html?.length ?? 0} bytes | http ${res?.status ?? "?"} | url: ${res?.url ?? "?"}`,
      );
    } catch (err) {
      console.error(`[${debugPrefix}] erro ao gravar HTML: ${err.message}`);
    }
    const maxLen = Number.parseInt(
      process.env.SMM_CENTER_DEBUG_HTML_LEN ?? "12000",
      10,
    );
    const cap =
      Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 12000;
    const raw = String(html ?? "");
    const title = raw.match(/<title[^>]*>([^<]*)</i);
    if (title) console.error(`[${debugPrefix}] <title>: ${title[1].trim()}`);
    console.error(
      `[${debugPrefix}] trecho do HTML (${tag}, ${raw.length} bytes total, mostrando ${Math.min(cap, raw.length)}):\n${raw.slice(0, cap)}\n`,
    );
  }

  function debugWriteHtml(user, tag, res, html) {
    if (!debugSmmEnabled()) return;
    const root = path.join(__dirname, "..");
    const fn = path.join(
      root,
      `${debugFileBase}-${safeUserFile(user)}-${tag}.html`,
    );
    try {
      fs.writeFileSync(fn, html ?? "", "utf8");
      console.error(
        `[${debugPrefix}] HTML completo da página salvo em: ${fn} (${html?.length ?? 0} bytes) | url final: ${res?.url ?? "?"}`,
      );
    } catch (err) {
      console.error(`[${debugPrefix}] erro ao gravar: ${err.message}`);
    }
  }

  function debugPreview(html, label) {
    if (!debugSmmEnabled()) return;
    const raw = String(html ?? "");
    const title = raw.match(/<title[^>]*>([^<]*)</i);
    const maxLen = Number.parseInt(
      process.env.SMM_CENTER_DEBUG_HTML_LEN ?? "12000",
      10,
    );
    const snippet = raw.slice(0, Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 12000);
    console.error(`[${debugPrefix}] Página: ${label}`);
    if (title) console.error(`[${debugPrefix}] <title>: ${title[1].trim()}`);
    console.error(`[${debugPrefix}] HTML (${raw.length} bytes, mostrando ${snippet.length}):\n${snippet}\n`);
  }

  async function checkAccount(user, pass, options = {}) {
    const retainSession =
      options && typeof options === "object" && options.retainSession === true;
    const cfg = getPanelConfig(panelId);
    const base = (cfg && cfg.baseUrl) || baseUrlFallback;
    const jar = createJar();
    const fp = getPanelFetchExtra();
    try {
      const loginLandingUrl =
        cfg && cfg.loginPostUrl ? String(cfg.loginPostUrl).trim() : `${base}/`;
      let res = await fetchWithJar(loginLandingUrl, jar, { method: "GET", ...fp });
      let html = await res.text();
      if (isLikelyWafOrBotBlockHtml(html)) {
        debugWriteHtml(user, "get-home-waf", res, html);
        return {
          ok: false,
          balance: null,
          error:
            "Site devolveu página de bloqueio (WAF/anti-bot, ex.: «Unable to verify your domain submission»). Teste sem proxy: esvazie proxys.txt, use NO_PROXY=1 ou defina fetchNoProxy: true no painel em config.js.",
        };
      }
      let csrf = extractCsrf(html);
      if (!csrf) {
        debugWriteHtml(user, "get-home-sem-csrf", res, html);
        debugPreview(html, "GET / — CSRF ausente");
        return { ok: false, balance: null, error: "CSRF não encontrado na página inicial" };
      }

      const pageUrl =
        typeof res.url === "string" && res.url.length > 0
          ? res.url
          : `${String(base).replace(/\/$/, "")}/`;
      const actionRel = extractLoginFormAction(html);
      const loginPostUrl =
        cfg && cfg.loginPostUrl
          ? String(cfg.loginPostUrl).trim()
          : resolveLoginPostUrl(base, pageUrl, actionRel);

      const loginBody = new URLSearchParams({
        "LoginForm[username]": user,
        "LoginForm[password]": pass,
        _csrf: csrf,
      });
      if (cfg.loginRemember === true) {
        loginBody.set("LoginForm[remember]", "1");
      }

      res = await fetchWithJar(loginPostUrl, jar, {
        method: "POST",
        redirect: "manual",
        headers: {
          ...loginPostHeaders(base, pageUrl),
        },
        body: loginBody.toString(),
        ...fp,
      });

      if (!isLoginLiveRedirect(res.status)) {
        const failHtml = await res.text();
        debugWriteHtml(user, "login-post-nao-302", res, failHtml);
        debugPreview(failHtml, `POST login — die HTTP ${res.status}`);
        return {
          ok: false,
          balance: null,
          error: loginPostFailureMessage(res.status),
        };
      }

      res = await fetchLandingAfterLoginRedirect(res, jar, base, fp);
      html = await res.text();
      const resLoginPost = res;
      const htmlLoginPost = html;
      debugWriteHtml(user, "post-login", resLoginPost, htmlLoginPost);

      if (isLikelyWafOrBotBlockHtml(htmlLoginPost)) {
        return {
          ok: false,
          balance: null,
          error:
            "Após login, resposta parece bloqueio WAF. Teste sem proxy ou fetchNoProxy: true no config do painel.",
        };
      }

      if (looksLikeLoginFailure(htmlLoginPost)) {
        debugWriteHtml(user, "login-post-falha", resLoginPost, htmlLoginPost);
        debugPreview(htmlLoginPost, "Após 302 — falha aparente no HTML");
        return { ok: false, balance: null, error: "Login recusado ou credenciais inválidas" };
      }

      const balanceHints = {
        preferLastBalanceDropdown: cfg.balancePreferLastDropdown === true,
        preferLastJsonBalance: cfg.balancePreferLastJsonBalance === true,
        balanceJsonUserBlockFirst: cfg.balanceJsonUserBlockFirst === true,
        balanceJsonSkipGenericQuoted: cfg.balanceJsonSkipGenericQuoted === true,
        balanceRejectDomFifteen: cfg.balanceRejectDomFifteen === true,
      };

      let meta = extractBalanceMeta(htmlLoginPost, balanceHints);
      let balance = meta?.balance ?? null;

      let lastPath = "post-login";
      let lastRes = resLoginPost;
      let lastHtml = htmlLoginPost;

      const balanceProbeUrls = Array.isArray(cfg.balanceProbeUrls)
        ? cfg.balanceProbeUrls.filter(Boolean)
        : [];
      const balanceProbeTakeLast = cfg.balanceProbeTakeLast === true;
      for (const probeUrl of balanceProbeUrls) {
        if (balance != null && !balanceProbeTakeLast) break;
        lastPath = probeUrl;
        res = await fetchWithJar(probeUrl, jar, { method: "GET", ...fp });
        html = await res.text();
        lastRes = res;
        lastHtml = html;
        const probed = extractBalanceMeta(html, balanceHints);
        if (probed?.balance != null) {
          debugWriteHtml(user, "balance-probe", res, html);
          meta = probed;
          balance = probed.balance;
        }
      }

      const paths = [
        "/",
        "/order",
        "/order/create",
        "/new-order",
        "/neworder",
        "/addfunds",
        "/account",
        "/dashboard",
        "/panel",
        "/home",
        "/user",
        "/en",
        "/en/order",
        "/en/order/create",
      ];

      for (const p of paths) {
        if (balance != null) break;
        lastPath = p;
        res = await fetchWithJar(joinBasePath(base, p), jar, { method: "GET", ...fp });
        html = await res.text();
        lastRes = res;
        lastHtml = html;
        meta = extractBalanceMeta(html, balanceHints);
        balance = meta?.balance ?? null;
        if (balance != null) {
          debugWriteHtml(user, "balance-path", res, html);
        }
      }

      if (balance == null) {
        if (stillOnLoginForm(htmlLoginPost) || stillOnLoginForm(lastHtml)) {
          dumpReturnedHtml(user, "apos-post-login", resLoginPost, htmlLoginPost);
          dumpReturnedHtml(user, `ultimo-get-${lastPath.replace(/\//g, "_") || "root"}`, lastRes, lastHtml);
          return {
            ok: false,
            balance: null,
            error:
              "Sessão não mantida ou ainda na tela de login (HTML sem painel logado)",
          };
        }
        debugWriteHtml(user, "login-post", resLoginPost, htmlLoginPost);
        debugWriteHtml(
          user,
          `last-get-${lastPath.replace(/\//g, "_") || "root"}`,
          lastRes,
          lastHtml,
        );
        debugPreview(htmlLoginPost, "corpo após POST de login");
        debugPreview(lastHtml, `corpo após GET ${lastPath}`);
        return {
          ok: false,
          balance: null,
          error: "Saldo não encontrado (sessão ou HTML inesperado)",
        };
      }

      const inferred = meta?.inferredCurrency ?? "USD";
      const currency = resolveWalletCurrency(cfg, inferred);
      if (retainSession) {
        return { ok: true, balance, currency, jar };
      }
      return { ok: true, balance, currency };
    } catch (e) {
      return {
        ok: false,
        balance: null,
        error: describeFetchError(e),
      };
    }
  }

  async function createOrder(sessionJar, orderOpts) {
    try {
    const cfg = getPanelConfig(panelId);
    const base = (cfg && cfg.baseUrl) || baseUrlFallback;
    const category = cfg && cfg.orderCategoryId;
    const service = cfg && cfg.serviceIdFollowers;
    if (category == null || service == null) {
      return {
        ok: false,
        error: "Configure orderCategoryId e serviceIdFollowers em config.js.",
        status: null,
        bodySnippet: "",
      };
    }
    const link = normalizeOrderLink(orderOpts.link);
    const quantity = Math.floor(
      Math.max(
        (cfg && cfg.orderMinQuantity) ?? 100,
        Number.parseInt(String(orderOpts.quantity ?? 100), 10) || 100,
      ),
    );

    const jar = sessionJar || createJar();
    const fp = getPanelFetchExtra();
    const orderCsrfExtra = Array.isArray(cfg.orderCsrfFetchUrls)
      ? cfg.orderCsrfFetchUrls
      : [];

    const fetched = await fetchOrderCreatePage(jar, base, fp, orderCsrfExtra);
    let { res: resGet, html } = fetched;
    let csrf = fetched.csrf ?? extractCsrf(html);
    if (!csrf || isHtmlNotFoundOrErrorPage(html)) {
      return {
        ok: false,
        error:
          "CSRF não encontrado em /?platform=instagram nem nas outras rotas.",
        status: resGet?.status ?? null,
        bodySnippet: html.slice(0, 800),
      };
    }

    const baseNorm = base.replace(/\/$/, "");
    const orderPostPath =
      cfg.orderPostPath != null ? cfg.orderPostPath : "/order/create";
    const postUrl = /^https?:\/\//i.test(orderPostPath)
      ? orderPostPath
      : `${baseNorm}${orderPostPath.startsWith("/") ? orderPostPath : `/${orderPostPath}`}`;
    const orderReferer =
      cfg.orderRefererPath != null
        ? /^https?:\/\//i.test(cfg.orderRefererPath)
          ? cfg.orderRefererPath
          : `${baseNorm}${cfg.orderRefererPath.startsWith("/") ? cfg.orderRefererPath : `/${cfg.orderRefererPath}`}`
        : `${baseNorm}/?platform=instagram`;
    const postOrigin = (() => {
      try {
        return new URL(baseNorm).origin;
      } catch {
        return base;
      }
    })();
    const fields = {
      "OrderForm[category]": String(category),
      "OrderForm[service]": String(service),
      "OrderForm[user_name]": "",
      "OrderForm[link]": link,
      "OrderForm[quantity]": String(quantity),
      "OrderForm[keywords]": "",
      "OrderForm[comment]": "",
      "OrderForm[mentionUsernames]": "",
      "OrderForm[usernames]": "",
      "OrderForm[usernames_custom]": "",
      "OrderForm[username]": "",
      "OrderForm[mediaUrl]": "",
      "OrderForm[hashtag]": "",
      "OrderForm[hashtags]": "",
      "OrderForm[runs]": "",
      "OrderForm[interval]": "",
      "OrderForm[total_quantity]": "0",
      "OrderForm[posts]": "",
      "OrderForm[old_posts]": "",
      "OrderForm[min]": "",
      "OrderForm[max]": "",
      "OrderForm[delay]": "0",
      "OrderForm[expiry]": "",
      "OrderForm[comment_username]": "",
      "OrderForm[answer_number]": "",
      "OrderForm[email]": "",
      "OrderForm[groups]": "",
      "OrderForm[country]": "",
      "OrderForm[type_of_traffic]": "1",
      "OrderForm[google_keyword]": "",
      "OrderForm[referring_url]": "",
      _csrf: csrf,
    };
    if (cfg.orderIncludePlatform !== false) {
      if (Object.prototype.hasOwnProperty.call(cfg, "orderPlatformValue")) {
        fields["OrderForm[platform]"] = String(cfg.orderPlatformValue);
      } else {
        fields["OrderForm[platform]"] = "instagram";
      }
    }
    if (cfg.orderTermsOfService) {
      fields["OrderForm[termsofservice]"] = "1";
    }

    let res = await fetchWithJar(postUrl, jar, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: orderReferer,
        Origin: postOrigin,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: buildOrderBody(fields),
      ...fp,
    });
    const bodyText = await res.text();

    const api = evaluateOrderApiResponse(bodyText);
    let ok;
    let errMsg;

    if (api) {
      ok = api.ok;
      errMsg = api.ok ? undefined : api.message;
    } else {
      const redirectOk =
        res.status === 302 || res.status === 301 || res.status === 303;
      const htmlOk =
        res.status === 200 &&
        !/erro|error|invalid|inválid|bad request/i.test(
          bodyText.slice(0, 12000),
        );
      ok = redirectOk || htmlOk;
      if (
        ok &&
        res.status === 200 &&
        /erro|error|invalid|danger/i.test(bodyText.slice(0, 4000))
      ) {
        ok = false;
      }
      errMsg = ok
        ? undefined
        : extractOrderResponseError(bodyText, res.status);
    }

    return {
      ok,
      status: res.status,
      jar,
      error: ok ? undefined : errMsg || "Resposta do pedido não confirmada",
      bodySnippet: bodyText.slice(0, 1200),
    };
    } catch (e) {
      return {
        ok: false,
        error: describeFetchError(e),
        status: null,
        bodySnippet: "",
      };
    }
  }

  async function loginAndCreateOrder(user, pass, orderOptions) {
    try {
    const cfg = getPanelConfig(panelId);
    const base = (cfg && cfg.baseUrl) || baseUrlFallback;
    const jar = createJar();
    const fp = getPanelFetchExtra();

    const loginLandingUrl =
      cfg && cfg.loginPostUrl ? String(cfg.loginPostUrl).trim() : `${base}/`;
    let res = await fetchWithJar(loginLandingUrl, jar, { method: "GET", ...fp });
    let html = await res.text();
    if (isLikelyWafOrBotBlockHtml(html)) {
      return {
        ok: false,
        error:
          "Site devolveu bloqueio WAF na página inicial. Sem proxy: proxys.txt vazio ou NO_PROXY=1; ou fetchNoProxy: true no painel.",
        status: null,
      };
    }
    let csrf = extractCsrf(html);
    if (!csrf) {
      return { ok: false, error: "CSRF inicial ausente", status: null };
    }

    const pageUrl =
      typeof res.url === "string" && res.url.length > 0
        ? res.url
        : `${String(base).replace(/\/$/, "")}/`;
    const actionRel = extractLoginFormAction(html);
    const loginPostUrl =
      cfg && cfg.loginPostUrl
        ? String(cfg.loginPostUrl).trim()
        : resolveLoginPostUrl(base, pageUrl, actionRel);

    const loginBody = new URLSearchParams({
      "LoginForm[username]": user,
      "LoginForm[password]": pass,
      _csrf: csrf,
    });
    if (cfg.loginRemember === true) {
      loginBody.set("LoginForm[remember]", "1");
    }

    res = await fetchWithJar(loginPostUrl, jar, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...loginPostHeaders(base, pageUrl),
      },
      body: loginBody.toString(),
      ...fp,
    });

    if (!isLoginLiveRedirect(res.status)) {
      await res.text();
      return {
        ok: false,
        error: loginPostFailureMessage(res.status),
        status: res.status,
      };
    }

    res = await fetchLandingAfterLoginRedirect(res, jar, base, fp);
    html = await res.text();

    if (looksLikeLoginFailure(html)) {
      return { ok: false, error: "Login falhou antes do pedido", status: res.status };
    }

    return createOrder(jar, orderOptions);
    } catch (e) {
      return { ok: false, error: describeFetchError(e), status: null };
    }
  }

  return {
    checkAccount,
    createOrder,
    loginAndCreateOrder,
  };
}

module.exports = {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
  extractBalanceMeta,
};
