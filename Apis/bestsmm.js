const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("bestsmm", {
  debugPrefix: "bestsmm",
  debugFileBase: "debug-bestsmm",
  baseUrlFallback: "https://best-smm.com",
});

module.exports = {
  id: "bestsmm",
  label: "Best SMM",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
