/* eslint-disable no-unused-expressions */
const services = require('../../services');

module.exports = {
  createBeneficiary: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck(params.accountNumber, '{accountNumber} Account Number is required.', null, false, 400, 'INVALID_ACCOUNT_NUMBER');
      res.mosh.emptyCheck(params.accountName, '{accountName} Account Name is required.', null, false, 400, 'INVALID_ACCOUNT_NAME');
      res.mosh.emptyCheck(params.bankCode, '{bankCode} Bank Code is required.', null, false, 400, 'INVALID_BANK_CODE');

      const data = {
        accountNumber: req.body.accountNumber,
        accountName: req.body.accountName,
        bankCode: req.body.bankCode,
        userId: req.user.id,
        currency: 'NGN',
      };

      const createBeneficiary = await services.beneficiary.createBeneficiary(data);

      res.json({
        status: 'success',
        data: createBeneficiary,
      });
    } catch (err) {
      console.log('Beneficiary creation failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  fetchBeneficiary: async (req, res) => {
    try {
      const fetchBeneficiary = await services.beneficiary.fetchBeneficiary(req.user, req.query);

      res.json({
        status: 'success',
        data: fetchBeneficiary,
      });
    } catch (err) {
      console.log('Beneficiary fetch failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

};
