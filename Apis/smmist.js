const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmist", {
  debugPrefix: "smmist",
  debugFileBase: "debug-smmist",
  baseUrlFallback: "https://smm.ist",
});

module.exports = {
  id: "smmist",
  label: "smm.ist",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
