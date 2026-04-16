const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("crescitaly", {
  debugPrefix: "crescitaly",
  debugFileBase: "debug-crescitaly",
  baseUrlFallback: "https://crescitaly.com",
});

module.exports = {
  id: "crescitaly",
  label: "Crescitaly",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
