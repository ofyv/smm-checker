function collectCauseChain(e, out, depth) {
  if (depth > 15 || !e) return;
  if (typeof e === "string") {
    out.push(e);
    return;
  }
  if (e && e.message) out.push(String(e.message));
  collectCauseChain(e.cause, out, depth + 1);
}

function describeFetchError(e) {
  const parts = [];
  collectCauseChain(e, parts, 0);
  const blob = parts.join(" ");
  const pr = /Proxy response \((\d+)\)/.exec(blob);
  if (pr) {
    const code = pr[1];
    if (code === "402") {
      return "Proxy recusou o túnel (402 — limite/quota ou sessão do proxy esgotada)";
    }
    if (code === "407") {
      return "Proxy exige autenticação (407) — se o provedor passou usuário e senha, use em proxys.txt o formato IP:porta:usuario:senha";
    }
    if (code === "403" || code === "404") {
      return `Proxy recusou o túnel (HTTP ${code})`;
    }
    return `Falha no túnel HTTPS pelo proxy (CONNECT retornou ${code})`;
  }
  if (/Request was cancelled/i.test(blob) && /Proxy response/i.test(blob)) {
    const m = blob.match(/Proxy response \((\d+)\)/);
    if (m) {
      return describeFetchError({ message: `Proxy response (${m[1]})` });
    }
  }
  if (parts.length) {
    const last = parts[parts.length - 1];
    if (last && !/^fetch failed$/i.test(last)) return last;
    if (parts.length > 1) return parts[parts.length - 2] || last;
  }
  return e && e.message ? String(e.message) : "fetch failed";
}

function isRetriableProxyTunnelError(err) {
  let c = err;
  for (let i = 0; i < 12 && c; i++) {
    const msg = c.message ? String(c.message) : "";
    if (/Proxy response \(\d+\) !== 200/.test(msg)) return true;
    if (/Proxy Authentication Required \(407\)|\(407\)/.test(msg)) return true;
    c = c.cause;
  }
  return false;
}

module.exports = {
  describeFetchError,
  isRetriableProxyTunnelError,
};
