const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("fullsmm", {
  debugPrefix: "fullsmm",
  debugFileBase: "debug-fullsmm",
  baseUrlFallback: "https://panel.fullsmm.com",
});

module.exports = {
  id: "fullsmm",
  label: "Full SMM (panel.fullsmm.com)",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
