const {
  createResellerPanelApi,
  extractCsrf,
  extractBalance,
} = require("./_resellerPanelLike");

const api = createResellerPanelApi("engajamais", {
  debugPrefix: "engajamais",
  debugFileBase: "debug-engajamais",
  baseUrlFallback: "https://engajamais.com",
});

module.exports = {
  id: "engajamais",
  label: "Engaja Mais",
  checkAccount: api.checkAccount,
  createOrder: api.createOrder,
  loginAndCreateOrder: api.loginAndCreateOrder,
  extractCsrf,
  extractBalance,
};
