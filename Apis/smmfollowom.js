const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("smmfollowom", {
  debugPrefix: "smmfollowom",
  debugFileBase: "debug-smmfollowom",
  baseUrlFallback: "https://smmfollowom.com",
});

module.exports = {
  id: "smmfollowom",
  label: "SmmFollowOM",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};

