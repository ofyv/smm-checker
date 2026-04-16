function makeStubCheckAccount(panelFileName) {
  return async function checkAccount() {
    return {
      ok: false,
      balance: null,
      error: `Configure endpoint em Apis/${panelFileName}`,
    };
  };
}

module.exports = { makeStubCheckAccount };
