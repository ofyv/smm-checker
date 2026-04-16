const fs = require("fs/promises");
const path = require("path");
const { ProxyAgent } = require("undici");

const PROXYS_FILE = path.join(__dirname, "proxys.txt");

const agentCache = new Map();

let pool = [];
let idx = 0;

function parseProxyLine(line) {
  const t = String(line).replace(/\r$/, "").trim();
  if (!t || t.startsWith("#")) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const host = parts[0].trim();
  const port = parts[1].trim();
  if (!host || !/^\d+$/.test(port)) return null;
  const portNum = Number.parseInt(port, 10);
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) return null;
  if (parts.length === 2) {
    return { host, port: String(portNum), user: "", pass: "", key: t };
  }
  if (parts.length >= 4) {
    const user = parts[2].trim();
    const pass = parts.slice(3).join(":");
    return { host, port: String(portNum), user, pass, key: t };
  }
  return null;
}

function proxyUriFromParts(p) {
  const u = new URL(`http://${p.host}:${p.port}/`);
  if (p.user || p.pass) {
    u.username = p.user;
    u.password = p.pass;
  }
  return u.toString();
}

function loadProxysFromText(text) {
  const raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const p = parseProxyLine(line);
    if (!p) continue;
    const uri = proxyUriFromParts(p);
    out.push({
      key: p.key,
      agent: new ProxyAgent({ uri, proxyTunnel: true }),
    });
  }
  return out;
}

function envProxyUrl() {
  return (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "").trim();
}

function noProxyAll() {
  return process.env.NO_PROXY === "1" || process.env.NO_PROXY === "true";
}

function getOrCreateEnvAgent(proxyUrl) {
  if (!agentCache.has(proxyUrl)) {
    let uri = proxyUrl;
    try {
      uri = new URL(proxyUrl).toString();
    } catch {
      /* mantém string */
    }
    agentCache.set(proxyUrl, new ProxyAgent({ uri, proxyTunnel: true }));
  }
  return agentCache.get(proxyUrl);
}

function getDispatcherForNextRequest() {
  const envUrl = envProxyUrl();
  if (envUrl) {
    return getOrCreateEnvAgent(envUrl);
  }
  if (pool.length === 0) return undefined;
  const item = pool[idx % pool.length];
  idx += 1;
  return item.agent;
}

function proxyActive() {
  if (noProxyAll()) return false;
  if (envProxyUrl()) return true;
  return pool.length > 0;
}

function getPoolLength() {
  return pool.length;
}

async function initProxyPool() {
  if (noProxyAll()) {
    pool = [];
    return 0;
  }
  const envUrl = envProxyUrl();
  if (envUrl) {
    getOrCreateEnvAgent(envUrl);
    return 1;
  }
  try {
    const text = await fs.readFile(PROXYS_FILE, "utf8");
    pool = loadProxysFromText(text);
  } catch {
    pool = [];
  }
  idx = 0;
  return pool.length;
}

module.exports = {
  initProxyPool,
  getDispatcherForNextRequest,
  proxyActive,
  envProxyUrl,
  getPoolLength,
  PROXYS_FILE,
};
