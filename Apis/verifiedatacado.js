const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("verifiedatacado", {
  debugPrefix: "verifiedatacado",
  debugFileBase: "debug-verifiedatacado",
  baseUrlFallback: "https://verifiedatacado.com",
});

module.exports = {
  id: "verifiedatacado",
  label: "Verified Atacado",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
