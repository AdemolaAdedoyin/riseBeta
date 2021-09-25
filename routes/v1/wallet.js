/* eslint-disable no-unused-expressions */
const validator = require('validator');
const services = require('../../services');
const appConfig = require('../../config/app');

const { port } = appConfig;

module.exports = {
  createPlan: async (req, res) => {
    const params = req.body;
    try {
      res.mosh.emptyCheck(params.planName, '{planName} Plan name is required.', null, false, 400, 'INVALID_PLAN_NAME');
      res.mosh.emptyCheck(params.assertName, '{assertName} Assert Name is required.', null, false, 400, 'INVALID_ASSERT_NAME');
      res.mosh.emptyCheck(params.monthlyFunding, '{monthlyFunding} Monthly Funding is required.', null, false, 400, 'INVALID_MONTHLY_FUNDING');

      const data = {
        planName: req.body.planName,
        assertName: req.body.assertName,
        monthlyFunding: req.body.monthlyFunding,
        userId: req.user.id,
      };

      const createPlan = await services.wallet.createPlan(data);

      res.json({
        status: 'success',
        data: createPlan,
      });
    } catch (err) {
      console.log('Plan creation failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  fetchTransactions: async (req, res) => {
    try {
      let fetchTransactions;
      if (req.query.type === 'realTime') fetchTransactions = await services.wallet.fetchRealTime(req.user, req.query);
      else fetchTransactions = await services.wallet.fetchHistoricalTransactions(req.user, req.query);

      res.json({
        status: 'success',
        data: fetchTransactions,
      });
    } catch (err) {
      console.log('Wallet fetch failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  fundPlan: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck((params.amount && params.amount > 0), 'A Valid Disburse Amount is required', null, false, 400, 'INVALID_AMOUNT');
      res.mosh.emptyCheck(params.planName, '{planName} Plan Name is required.', null, false, 400, 'INVALID_PLAN_NAME');

      const fund = await services.wallet.fundPlan(req.user, params);

      res.json({
        status: 'success',
        data: fund,
      });
    } catch (err) {
      console.log('Plan funding failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  reverseTransaction: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck(params.ref, '{ref} Transaction ref is required.', null, false, 400, 'INVALID_REFERENCE');

      const fund = await services.wallet.reverseTransaction(req.user.id, params.ref, params);

      res.json({
        status: 'success',
        data: fund,
      });
    } catch (err) {
      console.log('Reversal failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  fundWallet: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck(params.firstname, '{firstname} Firstname is required.', null, false, 400, 'INVALID_FIRSTNAME');
      res.mosh.emptyCheck(params.lastname, '{lastname} Lastname is required.', null, false, 400, 'INVALID_LASTNAME');
      res.mosh.emptyCheck(params.phonenumber, '{phonenumber} Phone number is required.', null, false, 400, 'INVALID_PHONENUMBER');
      res.mosh.emptyCheck(params.phonenumber.trim().startsWith('+'), '{phonenumber} Phone number is invalid. Must start with +', null, false, 400, 'INVALID_PHONENUMBER');
      res.mosh.emptyCheck(params.email, '{email} Email is required.', null, false, 400, 'INVALID_EMAIL');
      res.mosh.emptyCheck(params.charge_with, '{charge_with} Charge with is required.', null, false, 400, 'INVALID_CHARGE');
      res.mosh.emptyCheck(validator.isEmail(params.email), '{email} Email is invalid.', null, false, 400, 'INVALID_EMAIL');
      res.mosh.emptyCheck(params.amount, '{amount} Amount is required.', null, false, 400, 'INVALID_AMOUNT');

      if (req.body.charge_with === 'card' || !req.body.charge_with) {
        res.mosh.emptyCheck(params.card_no, '{card_no} Card no is required.', null, false, 400, 'INVALID_CARD_NUMBER');
        res.mosh.emptyCheck(params.cvv, '{cvv} Card cvv is required.', null, false, 400, 'INVALID_CARD_CVV');
        res.mosh.emptyCheck(params.expiry_year, '{expiry_year} Card expiry year is required.', null, false, 400, 'INVALID_CARD_EXPIRY_MONTH');
        res.mosh.emptyCheck(params.expiry_month, '{expiry_month} Card expiry month is required.', null, false, 400, 'INVALID_CARD_EXPIRY_MONTH');
      } else if (req.body.charge_with === 'account') {
        res.mosh.emptyCheck(params.account_number, '{account_number} Sender account number is required.', null, false, 400, 'INVALID_ACCOUNT_NUMBER');
        res.mosh.emptyCheck(params.code, '{code} Sender bank code is required.', null, false, 400, 'INVALID_BANK_CODE');
      }

      const allowedCurrency = ['NGN', 'USD'];
      res.mosh.emptyCheck(allowedCurrency.includes(req.body.charge_currency), `${req.body.charge_currency} Currency Transactions are not allowed`, null, false, 400, 'INVALID_TOKEN');

      const body = {
        email: req.body.email.toLowerCase(),
        charge_with: req.body.charge_with,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        phonenumber: req.body.phonenumber,
        charge_currency: req.body.charge_currency,
        disburse_currency: req.body.charge_currency,
        fee: 40,
        narration: req.body.narration,
        amount: req.body.amount,
        medium: 'mobile',
        sender_bank: req.body.sender_bank || '044',
        ref: `${Date.now().toString().slice(0, 10)}${Math.random().toString().slice(-5)}`,
        redirecturl: `http://localhost:${port}/v1/fund/card/validate`,
      };

      if (req.body.charge_with === 'card' || !req.body.charge_with) {
        body.card_no = req.body.card_no;
        body.cvv = req.body.cvv;
        body.expiry_year = req.body.expiry_year;
        body.expiry_month = req.body.expiry_month;
        body.pin = req.body.pin;
        body.recipient = 'wallet';
      } else if (req.body.charge_with === 'account') {
        body.code = req.body.code;
        body.account_number = req.body.account_number;
        body.callback_url = `http://localhost:${port}/v1/fund/account/validate`;
        body.reference = body.ref;
      } else throw Object({ code: 'INVALID_CHARGE_WITH', msg: 'Charge with is invalid. Only card and account' });

      const fundWallet = await services.wallet.fundWallet(req.user, body);

      res.json({
        status: 'success',
        data: fundWallet,
      });
    } catch (err) {
      console.log('Wallet Funding failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  validateCardFunding: async (req, res) => {
    try {
      const body = req.query;

      res.mosh.emptyCheck(body.responseMessage, '{responseMessage} Response Message is required.', null, false, 400, 'INVALID_MESSAGE');
      res.mosh.emptyCheck(body.rc, '{rc} Response code is required.', null, false, 400, 'INVALID_RESPONSE_CODE');
      res.mosh.emptyCheck(body.ref, '{ref} Transaction reference is required.', null, false, 400, 'INVALID_REFERENCE');

      const validateCardFunding = await services.wallet.validateCardFunding(body);

      res.json({
        status: 'success',
        data: validateCardFunding,
      });
    } catch (err) {
      console.log('Card verification failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
        data: req.qeury,
      });
    }
  },

  validateAccountFunding: async (req, res) => {
    try {
      const { body } = req;
      const params = req.query;
      const reference = body.reference || params.reference;

      res.mosh.emptyCheck(reference, '{reference} Transaction reference is required.', null, false, 400, 'INVALID_REFERENCE');

      const validateAccountFunding = await services.wallet.validateAccountFunding(body, params);

      res.json({
        status: 'success',
        data: validateAccountFunding,
      });
    } catch (err) {
      console.log('Account verification failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
        data: req.qeury,
      });
    }
  },

  disburseFromWallet: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck((params.amount && params.amount > 0), 'A Valid Disburse Amount is required', null, false, 400, 'INVALID_AMOUNT');
      res.mosh.emptyCheck(params.lock, '{lock} Lock is required', null, false, 400, 'INVALID_LOCK');
      res.mosh.emptyCheck(params.currency, '{currency} Currency is required', null, false, 400, 'INVALID_CURRENCY');
      res.mosh.emptyCheck(params.bankcode, '{bankcode} Bank Code is required.', null, false, 400, 'INVALID_BANK_CODE');
      res.mosh.emptyCheck(params.accountNumber, '{accountNumber} Account Number is required.', null, false, 400, 'INVALID_ACCOUNT_NUMBER');
      res.mosh.emptyCheck(params.accountName, '{accountName} Account Name is required.', null, false, 400, 'INVALID_ACCOUNT_NAME');

      const disburse = await services.wallet.disburseFromWallet(req.user, params);

      res.json({
        status: 'success',
        data: disburse,
      });
    } catch (err) {
      console.log('Wallet Disburse failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  getROI: async (req, res) => {
    try {
      const params = req.qeury;

      const getROI = await services.wallet.getROI(req.user, params);

      res.json({
        status: 'success',
        data: getROI,
      });
    } catch (err) {
      console.log('Get ROI failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  withdraw: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck((params.amount && params.amount > 0), 'A Valid Disburse Amount is required', null, false, 400, 'INVALID_AMOUNT');
      res.mosh.emptyCheck(params.lock, '{lock} Lock is required', null, false, 400, 'INVALID_LOCK');
      res.mosh.emptyCheck(params.currency, '{currency} Currency is required', null, false, 400, 'INVALID_CURRENCY');
      res.mosh.emptyCheck(params.bankcode, '{bankcode} Bank Code is required.', null, false, 400, 'INVALID_BANK_CODE');
      res.mosh.emptyCheck(params.accountNumber, '{accountNumber} Account Number is required.', null, false, 400, 'INVALID_ACCOUNT_NUMBER');
      res.mosh.emptyCheck(params.accountName, '{accountName} Account Name is required.', null, false, 400, 'INVALID_ACCOUNT_NAME');

      const disburse = await services.wallet.disburseFromWallet(req.user, params);

      res.json({
        status: 'success',
        data: disburse,
      });
    } catch (err) {
      console.log('User verification failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },
};
