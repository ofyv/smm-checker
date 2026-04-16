const { fetch: undiciFetch, ProxyAgent } = require("undici");
const { isRetriableProxyTunnelError } = require("./_fetchError");

let envDispatcher;
let proxyPoolMod;

function getProxyPool() {
  if (!proxyPoolMod) {
    try {
      proxyPoolMod = require("../proxyPool");
    } catch {
      proxyPoolMod = null;
    }
  }
  return proxyPoolMod;
}

function getEnvDispatcher() {
  if (process.env.NO_PROXY === "1" || process.env.NO_PROXY === "true") {
    return undefined;
  }
  const u = (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "").trim();
  if (!u) return undefined;
  if (!envDispatcher) envDispatcher = new ProxyAgent(u);
  return envDispatcher;
}

function getSetCookieList(res) {
  const h = res.headers;
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const one = h.get("set-cookie");
  return one ? [one] : [];
}

function mergeSetCookieIntoJar(jar, setCookieLines) {
  for (const line of setCookieLines) {
    const nv = String(line).split(";")[0].trim();
    if (!nv || !nv.includes("=")) continue;
    const name = nv.split("=")[0];
    jar.set(name, nv);
  }
}

function createJar() {
  return new Map();
}

function jarToHeader(jar) {
  return Array.from(jar.values()).join("; ");
}

function resolveDispatcher(jar, noProxy, explicitDispatcher) {
  if (noProxy) return undefined;
  if (explicitDispatcher) return explicitDispatcher;
  const pp = getProxyPool();
  const envD = getEnvDispatcher();
  if (envD) {
    const d = jar._stickyProxyDispatcher || envD;
    jar._stickyProxyDispatcher = d;
    return d;
  }
  if (pp && pp.proxyActive && pp.proxyActive()) {
    if (jar._stickyProxyDispatcher) {
      return jar._stickyProxyDispatcher;
    }
    const d = pp.getDispatcherForNextRequest();
    jar._stickyProxyDispatcher = d;
    return d;
  }
  return undefined;
}

async function fetchWithJar(url, jar, options = {}) {
  const { headers: optHeaders = {}, noProxy, ...rest } = options;
  const { dispatcher: optDispatcher, ...restFetch } = rest;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    ...optHeaders,
  };
  const c = jarToHeader(jar);
  if (c) headers.Cookie = c;

  const maxAttempts = (() => {
    if (noProxy || optDispatcher) return 2;
    const pp = getProxyPool();
    if (!pp || !pp.proxyActive || !pp.proxyActive() || pp.envProxyUrl()) return 2;
    const n = typeof pp.getPoolLength === "function" ? pp.getPoolLength() : 0;
    if (n <= 0) return 2;
    return Math.min(32, Math.max(2, n));
  })();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let dispatcher = resolveDispatcher(jar, noProxy, optDispatcher);
    const fetchOpts = {
      redirect: "follow",
      ...restFetch,
      headers,
    };
    if (dispatcher) fetchOpts.dispatcher = dispatcher;
    try {
      const res = await undiciFetch(url, fetchOpts);
      mergeSetCookieIntoJar(jar, getSetCookieList(res));
      return res;
    } catch (e) {
      const pp = getProxyPool();
      const poolActive =
        pp && pp.proxyActive && pp.proxyActive() && !pp.envProxyUrl();
      const canRetry =
        attempt < maxAttempts - 1 &&
        poolActive &&
        jar._stickyProxyDispatcher &&
        isRetriableProxyTunnelError(e);
      if (canRetry) {
        jar._stickyProxyDispatcher = undefined;
        continue;
      }
      throw e;
    }
  }
}

module.exports = {
  createJar,
  jarToHeader,
  fetchWithJar,
  mergeSetCookieIntoJar,
  getSetCookieList,
};
