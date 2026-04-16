const UNKNOWN = "UNKNOWN";

function inferCurrencyFromRawBalanceText(raw) {
  if (raw == null || typeof raw !== "string") return "USD";
  const s = raw.trim();
  if (/R\$/i.test(s)) return "BRL";
  if (/₹|(?:^|\s)Rs\.?\s*[\d]|\bINR\b/i.test(s)) return "INR";
  if (/€/.test(s)) return "EUR";
  if (/£/.test(s)) return "GBP";
  if (/≈\s*R\s/i.test(s)) return UNKNOWN;
  if (/US\$|\bUSD\b/i.test(s)) return "USD";
  if (/\$\s*[\d]/.test(s)) return "USD";
  if (/^\s*R\s+[\d.,]+\s*$/i.test(s)) return "BRL";
  return "USD";
}

function formatBalanceDisplay(amount, currencyCode) {
  if (amount == null || Number.isNaN(amount)) return "";
  const code = currencyCode || "USD";
  if (code === UNKNOWN) {
    return `${amount} (moeda não identificada — defina walletCurrency em config.js)`;
  }
  return `${amount} ${code}`;
}

function isUnknownCurrency(code) {
  return code === UNKNOWN;
}

module.exports = {
  UNKNOWN,
  inferCurrencyFromRawBalanceText,
  formatBalanceDisplay,
  isUnknownCurrency,
};
