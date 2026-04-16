const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("instabarato", {
  debugPrefix: "instabarato",
  debugFileBase: "debug-instabarato",
  baseUrlFallback: "https://instabarato.com",
});

module.exports = {
  id: "instabarato",
  label: "Insta Barato",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
