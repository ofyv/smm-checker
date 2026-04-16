const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("fontesmm", {
  debugPrefix: "fontesmm",
  debugFileBase: "debug-fontesmm",
  baseUrlFallback: "https://fontesmm.com/pt",
});

module.exports = {
  id: "fontesmm",
  label: "Fonte SMM",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
