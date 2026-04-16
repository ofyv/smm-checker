const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smm-center", {
  debugPrefix: "smm-center",
  debugFileBase: "debug-smm-center",
  baseUrlFallback: "https://smm-center.com",
});

module.exports = {
  id: "smm-center",
  label: "SMM Center",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
