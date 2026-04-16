const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmnet", {
  debugPrefix: "smmnet",
  debugFileBase: "debug-smmnet",
  baseUrlFallback: "https://smm.net",
});

module.exports = {
  id: "smmnet",
  label: "SMM.net",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
