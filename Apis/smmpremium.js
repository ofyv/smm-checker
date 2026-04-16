const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmpremium", {
  debugPrefix: "smmpremium",
  debugFileBase: "debug-smmpremium",
  baseUrlFallback: "https://smmpremium.net",
});

module.exports = {
  id: "smmpremium",
  label: "SMM Premium",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
