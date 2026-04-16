const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmja", {
  debugPrefix: "smmja",
  debugFileBase: "debug-smmja",
  baseUrlFallback: "https://smmja.com",
});

module.exports = {
  id: "smmja",
  label: "SmmJá",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
