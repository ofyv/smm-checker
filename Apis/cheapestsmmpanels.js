const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("cheapestsmmpanels", {
  debugPrefix: "cheapestsmmpanels",
  debugFileBase: "debug-cheapestsmmpanels",
  baseUrlFallback: "https://cheapestsmmpanels.com",
});

module.exports = {
  id: "cheapestsmmpanels",
  label: "Cheapest SMM Panels",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};

