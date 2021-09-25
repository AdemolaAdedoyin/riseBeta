const router = require('express').Router();
const auth = require('./auth');
const wallet = require('./wallet');
const beneficiary = require('./beneficiary');
const banks = require('./bank');
const authorized = require('./middlewares.js/authorization');

router.post('/auth/signup', auth.createUser);
router.post('/auth/login', auth.login);

router.post('/disburse', authorized, wallet.disburseFromWallet);
router.post('/fund', authorized, wallet.fundWallet);
router.get('/fund/card/validate', wallet.validateCardFunding);
router.all('/fund/account/validate', wallet.validateAccountFunding);
router.post('/plan', authorized, wallet.createPlan);
router.get('/transactions', authorized, wallet.fetchTransactions);
router.post('/transactions/reverse', authorized, wallet.reverseTransaction);
router.get('/roi', authorized, wallet.getROI);
router.post('/plan/fund', authorized, wallet.fundPlan);

router.post('/beneficiary', authorized, beneficiary.createBeneficiary);

router.get('/banks', authorized, banks.fetchBanks);

module.exports = router;
