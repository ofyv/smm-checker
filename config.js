const path = require("path");

const MIN_BALANCE = Number.parseFloat(process.env.MIN_BALANCE ?? "0.01");
const DEFAULT_ORDER_BALANCE_BUFFER = Number.parseFloat(
  process.env.ORDER_BALANCE_BUFFER ?? "0",
);
const CONTAS_DIR = path.join(__dirname, "contas");
const proxysFile = path.join(__dirname, "proxys.txt");
const instagramTargetUrl = "https://instagram.com/33diplomata__";

const panels = {
  fabricadeseguidores: {
    contasFile: path.join(CONTAS_DIR, "fabricadeseguidores.txt"),
    baseUrl: "https://fabricadeseguidores.com.br",
    orderCategoryId: 234,
    serviceIdFollowers: 970,
    orderMinQuantity: 500,
    pricePer1000: 29.7,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
  },
  crescitaly: {
    contasFile: path.join(CONTAS_DIR, "crescitaly.txt"),
    baseUrl: "https://crescitaly.com",
    orderCategoryId: 1375630,
    serviceIdFollowers: 30308,
    orderMinQuantity: 1,
    pricePer1000: 1.2,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderBalanceBuffer: 0.08,
  },
  baratosociais: {
    contasFile: path.join(CONTAS_DIR, "baratosociais.txt"),
    baseUrl: "https://baratosociais.com",
    orderCategoryId: 6146,
    serviceIdFollowers: 1178,
    orderMinQuantity: 100,
    pricePer1000: 3.05,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderPlatformValue: "",
  },
  engajamais: {
    contasFile: path.join(CONTAS_DIR, "engajamais.txt"),
    baseUrl: "https://engajamais.com",
    orderCategoryId: 976,
    serviceIdFollowers: 2229,
    orderMinQuantity: 100,
    pricePer1000: 1.37,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
  },
  instabarato: {
    contasFile: path.join(CONTAS_DIR, "instabarato.txt"),
    baseUrl: "https://instabarato.com",
    orderCategoryId: 1,
    serviceIdFollowers: 644,
    orderMinQuantity: 10,
    pricePer1000: 5.94,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderTermsOfService: true,
  },
  machinesmm: {
    contasFile: path.join(CONTAS_DIR, "machinesmm.txt"),
    baseUrl: "https://machinesmm.com",
    orderCategoryId: 466,
    serviceIdFollowers: 2476,
    orderMinQuantity: 100,
    pricePer1000: 4.94,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
  },
  smmhype: {
    contasFile: path.join(CONTAS_DIR, "smmhype.txt"),
    baseUrl: "https://smmhype.com",
    orderCategoryId: 243912,
    serviceIdFollowers: 14325,
    orderMinQuantity: 20,
    pricePer1000: 0.59,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderPlatformValue: "",
  },
  "smm-center": {
    contasFile: path.join(CONTAS_DIR, "smm-center.txt"),
    baseUrl: "https://smm-center.com",
    orderCategoryId: 794048,
    serviceIdFollowers: 29125,
    orderMinQuantity: 100,
    pricePer1000: 0.77,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
  },
  smmoficial: {
    contasFile: path.join(CONTAS_DIR, "smmoficial.txt"),
    baseUrl: "https://smmoficial.com",
    orderCategoryId: 5988,
    serviceIdFollowers: 1034,
    orderMinQuantity: 100,
    pricePer1000: 1.62,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
    orderPostPath: "/",
    orderRefererPath: "/",
  },
  verifiedatacado: {
    contasFile: path.join(CONTAS_DIR, "verifiedatacado.txt"),
    baseUrl: "https://verifiedatacado.com",
    orderCategoryId: 1,
    serviceIdFollowers: 943,
    orderMinQuantity: 10,
    pricePer1000: 5.94,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
    orderIncludePlatform: false,
    orderTermsOfService: true,
  },
  smmpremium: {
    contasFile: path.join(CONTAS_DIR, "smmpremium.txt"),
    baseUrl: "https://smmpremium.net",
    orderCategoryId: 533,
    serviceIdFollowers: 361,
    orderMinQuantity: 10,
    pricePer1000: 6.25,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
    orderIncludePlatform: false,
  },
  smmja: {
    contasFile: path.join(CONTAS_DIR, "smmja.txt"),
    baseUrl: "https://smmja.com",
    orderCategoryId: 18451,
    serviceIdFollowers: 1762,
    orderMinQuantity: 20,
    pricePer1000: 19,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
  },
  smmist: {
    contasFile: path.join(CONTAS_DIR, "smmist.txt"),
    baseUrl: "https://smm.ist",
    orderCategoryId: 123,
    serviceIdFollowers: 1753,
    orderMinQuantity: 100,
    pricePer1000: 1.025,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderPostPath: "/",
    orderRefererPath: "/",
    fetchNoProxy: true,
  },
  worldofsmm: {
    contasFile: path.join(CONTAS_DIR, "worldofsmm.txt"),
    baseUrl: "https://worldofsmm.com",
    orderCategoryId: 357,
    serviceIdFollowers: 3654,
    orderMinQuantity: 100,
    pricePer1000: 0.48,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderPostPath: "/",
    orderRefererPath: "/",
  },
  bestsmm: {
    contasFile: path.join(CONTAS_DIR, "bestsmm.txt"),
    baseUrl: "https://best-smm.com",
    orderCategoryId: 100095,
    serviceIdFollowers: 4856,
    orderMinQuantity: 20,
    pricePer1000: 0.12,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderPostPath: "/",
    orderRefererPath: "/",
  },
  fontesmm: {
    contasFile: path.join(CONTAS_DIR, "fontesmm.txt"),
    baseUrl: "https://fontesmm.com/pt",
    orderCategoryId: 490,
    serviceIdFollowers: 1817,
    orderMinQuantity: 10,
    pricePer1000: 3.86,
    pricePer1000Currency: "BRL",
    walletCurrency: "BRL",
    orderPlatformValue: "",
    orderPostPath: "https://fontesmm.com/order/create",
    orderCsrfFetchUrls: ["https://fontesmm.com/order/create"],
    loginRemember: true,
    balanceJsonUserBlockFirst: true,
    balanceJsonSkipGenericQuoted: true,
    balanceRejectDomFifteen: true,
    balancePreferLastDropdown: true,
    balancePreferLastJsonBalance: true,
    balanceProbeTakeLast: true,
    balanceProbeUrls: [
      "https://fontesmm.com/order/create",
      "https://fontesmm.com/",
      "https://fontesmm.com/addfunds",
    ],
  },
  fullsmm: {
    contasFile: path.join(CONTAS_DIR, "fullsmm.txt"),
    baseUrl: "https://panel.fullsmm.com",
    orderCategoryId: 5424,
    serviceIdFollowers: 734,
    orderMinQuantity: 10,
    pricePer1000: 0.616,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderRefererPath: "/order/create",
  },
  smmnet: {
    contasFile: path.join(CONTAS_DIR, "smmnet.txt"),
    baseUrl: "https://smm.net",
    orderCategoryId: 104,
    serviceIdFollowers: 1146,
    orderMinQuantity: 10,
    pricePer1000: 1.79,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    loginPostUrl: "https://smm.net/?redirect=/",
    orderIncludePlatform: false,
    orderPostPath: "/",
    orderRefererPath: "/",
  },
  smmgo: {
    contasFile: path.join(CONTAS_DIR, "smmgo.txt"),
    baseUrl: "https://smmgo.io",
    orderCategoryId: 496,
    serviceIdFollowers: 7000,
    orderMinQuantity: 5,
    pricePer1000: 0.94,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderIncludePlatform: false,
    orderPostPath: "/",
    orderRefererPath: "/",
  },
  cheapestsmmpanels: {
    contasFile: path.join(CONTAS_DIR, "cheapestsmmpanels.txt"),
    baseUrl: "https://cheapestsmmpanels.com",
    orderCategoryId: 21552,
    serviceIdFollowers: 4258,
    orderMinQuantity: 2,
    pricePer1000: 0.43365,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    fxRates: {
      USD_INR: 93.14,
    },
    orderPlatformValue: "",
    orderPostPath: "/order/create",
    orderRefererPath: "/order/create",
  },
  smmfollowom: {
    contasFile: path.join(CONTAS_DIR, "smmfollowom.txt"),
    baseUrl: "https://smmfollowom.com",
    orderCategoryId: 451257,
    serviceIdFollowers: 5300,
    orderMinQuantity: 10,
    pricePer1000: 0.33,
    pricePer1000Currency: "USD",
    walletCurrency: "auto",
    orderPlatformValue: "",
    orderPostPath: "/order/create",
    orderRefererPath: "/order/create",
  },
};

function getPanelConfig(panelId) {
  return panels[panelId];
}

function costForFollowers(pricePer1000, quantity) {
  if (pricePer1000 == null || Number.isNaN(pricePer1000)) return null;
  return (quantity / 1000) * pricePer1000;
}

function getOrderBalanceBuffer(panelCfg) {
  const envRaw = process.env.ORDER_BALANCE_BUFFER;
  if (envRaw !== undefined && String(envRaw).trim() !== "") {
    const n = Number.parseFloat(envRaw);
    if (Number.isFinite(n) && n >= 0 && n < 1) return n;
  }
  if (panelCfg && panelCfg.orderBalanceBuffer != null) {
    const n = Number(panelCfg.orderBalanceBuffer);
    if (Number.isFinite(n) && n >= 0 && n < 1) return n;
  }
  return DEFAULT_ORDER_BALANCE_BUFFER;
}

function maxFollowersForBalance(pricePer1000, balance, bufferFraction) {
  if (pricePer1000 == null || pricePer1000 <= 0 || balance == null) return null;
  const buf =
    bufferFraction != null &&
    Number.isFinite(bufferFraction) &&
    bufferFraction > 0 &&
    bufferFraction < 1
      ? bufferFraction
      : 0;
  const effective = buf > 0 ? balance * (1 - buf) : balance;
  return Math.floor((effective / pricePer1000) * 1000);
}

function clampOrderQuantityToBalance(pricePer1000, balance, quantity, orderMinQuantity) {
  if (
    pricePer1000 == null ||
    balance == null ||
    quantity == null ||
    quantity < 1
  ) {
    return null;
  }
  const minQ = Math.max(1, Math.floor(orderMinQuantity ?? 1));
  let q = Math.floor(quantity);
  while (q > minQ && costForFollowers(pricePer1000, q) > balance) {
    q -= 1;
  }
  if (costForFollowers(pricePer1000, q) > balance) {
    return null;
  }
  if (q < minQ) return null;
  return q;
}

function minOrderBalanceUsd(panelCfg) {
  if (!panelCfg || panelCfg.pricePer1000 == null || !panelCfg.orderMinQuantity) {
    return null;
  }
  return (panelCfg.orderMinQuantity / 1000) * panelCfg.pricePer1000;
}

function normalizeFxKey(from, to) {
  return `${String(from || "").toUpperCase()}_${String(to || "").toUpperCase()}`;
}

function getFxRate(from, to, panelCfg) {
  const f = String(from || "").toUpperCase();
  const t = String(to || "").toUpperCase();
  if (!f || !t || f === t) return 1;

  const key = normalizeFxKey(f, t);
  const keyInv = normalizeFxKey(t, f);

  const fromCfg =
    panelCfg && panelCfg.fxRates && typeof panelCfg.fxRates === "object"
      ? panelCfg.fxRates
      : null;
  const envKey = `FX_${key}`;
  const envKeyInv = `FX_${keyInv}`;

  const direct =
    (fromCfg && fromCfg[key] != null ? Number(fromCfg[key]) : null) ??
    (process.env[envKey] != null ? Number(process.env[envKey]) : null);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const inv =
    (fromCfg && fromCfg[keyInv] != null ? Number(fromCfg[keyInv]) : null) ??
    (process.env[envKeyInv] != null ? Number(process.env[envKeyInv]) : null);
  if (Number.isFinite(inv) && inv > 0) return 1 / inv;

  return null;
}

function resolvePricePer1000InWallet(panelCfg, walletCurrency) {
  if (!panelCfg || panelCfg.pricePer1000 == null) return null;
  const priceCur = (panelCfg.pricePer1000Currency ?? "USD").toUpperCase();
  const walletCur = String(walletCurrency || "USD").toUpperCase();
  if (priceCur === walletCur) return Number(panelCfg.pricePer1000);
  const r = getFxRate(priceCur, walletCur, panelCfg);
  if (r == null) return null;
  return Number(panelCfg.pricePer1000) * r;
}

function minOrderBalanceInWallet(panelCfg, walletCurrency) {
  const p = resolvePricePer1000InWallet(panelCfg, walletCurrency);
  if (p == null || !panelCfg || !panelCfg.orderMinQuantity) return null;
  return (panelCfg.orderMinQuantity / 1000) * p;
}

function resolveWalletCurrency(panelCfg, inferredCurrency) {
  const w = panelCfg && panelCfg.walletCurrency;
  if (w && w !== "auto") return w;
  if (inferredCurrency === "UNKNOWN") return "UNKNOWN";
  if (inferredCurrency && typeof inferredCurrency === "string") return inferredCurrency;
  return "USD";
}

function canEstimateFollowers(panelCfg, walletCurrencyResolved) {
  const p =
    panelCfg && panelCfg.pricePer1000Currency != null
      ? panelCfg.pricePer1000Currency
      : "USD";
  if (p === walletCurrencyResolved) return true;
  return getFxRate(p, walletCurrencyResolved, panelCfg) != null;
}

module.exports = {
  MIN_BALANCE,
  DEFAULT_ORDER_BALANCE_BUFFER,
  CONTAS_DIR,
  instagramTargetUrl,
  proxysFile,
  panels,
  getPanelConfig,
  costForFollowers,
  maxFollowersForBalance,
  getOrderBalanceBuffer,
  clampOrderQuantityToBalance,
  minOrderBalanceUsd,
  minOrderBalanceInWallet,
  resolveWalletCurrency,
  resolvePricePer1000InWallet,
  getFxRate,
  canEstimateFollowers,
};
