const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmoficial", {
  debugPrefix: "smmoficial",
  debugFileBase: "debug-smmoficial",
  baseUrlFallback: "https://smmoficial.com",
});

module.exports = {
  id: "smmoficial",
  label: "SMM Oficial",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
