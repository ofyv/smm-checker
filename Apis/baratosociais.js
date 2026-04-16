const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("baratosociais", {
  debugPrefix: "baratosociais",
  debugFileBase: "debug-baratosociais",
  baseUrlFallback: "https://baratosociais.com",
});

module.exports = {
  id: "baratosociais",
  label: "Barato Sociais",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
