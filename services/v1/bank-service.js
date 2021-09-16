const services = require('..');
const appConfig = require('../../config/app');

const { stagingUrl } = appConfig;

module.exports = {

  fetchBanks: async (bankCode = null) => {
    try {
      let returnedBank;

      let getBanks = await services.request.httpRequest('POST', `${stagingUrl}/v1/banks`, { payload: {} });

      if (!(getBanks && getBanks.body)) throw Object({ code: 'BANKS_DOWN', msg: 'Can not get banks at the moment' });

      getBanks = getBanks.body.data;

      if (bankCode) {
        if (!getBanks[bankCode]) throw Object({ code: 'INVALID_BANK', msg: 'Bank Code does not exist' });
        returnedBank = {};
        returnedBank[`${bankCode}`] = getBanks[bankCode];
      } else returnedBank = getBanks;

      return returnedBank;
    } catch (error) {
      console.log('can not get banks: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

};
