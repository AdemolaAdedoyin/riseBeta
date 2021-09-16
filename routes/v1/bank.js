/* eslint-disable no-unused-expressions */
const services = require('../../services');

module.exports = {

  fetchBanks: async (req, res) => {
    try {
      const fetchBanks = await services.bank.fetchBanks(req.query.bankCode);

      res.json({
        status: 'success',
        data: fetchBanks,
      });
    } catch (err) {
      console.log('Bank fetch failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

};
