const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmhype", {
  debugPrefix: "smmhype",
  debugFileBase: "debug-smmhype",
  baseUrlFallback: "https://smmhype.com",
});

module.exports = {
  id: "smmhype",
  label: "SMM Hype",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
