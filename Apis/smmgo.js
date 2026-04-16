const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmgo", {
  debugPrefix: "smmgo",
  debugFileBase: "debug-smmgo",
  baseUrlFallback: "https://smmgo.io",
});

module.exports = {
  id: "smmgo",
  label: "SMMGO.io",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};

