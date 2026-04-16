const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("machinesmm", {
  debugPrefix: "machinesmm",
  debugFileBase: "debug-machinesmm",
  baseUrlFallback: "https://machinesmm.com",
});

module.exports = {
  id: "machinesmm",
  label: "Machine SMM",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
