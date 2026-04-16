const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("worldofsmm", {
  debugPrefix: "worldofsmm",
  debugFileBase: "debug-worldofsmm",
  baseUrlFallback: "https://worldofsmm.com",
});

module.exports = {
  id: "worldofsmm",
  label: "World of SMM",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
