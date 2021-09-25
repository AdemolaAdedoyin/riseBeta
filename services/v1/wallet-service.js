/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-const-assign */
/* eslint-disable no-unused-expressions */
const bcrypt = require('bcrypt-nodejs');
const momentT = require('moment-timezone');
const moment = require('moment');
const model = require('../../models');
const services = require('..');
const appConfig = require('../../config/app');

const {
  stagingUrl, paystackPublicKey, paystackUrl, mwApiKey, mwSecret, mwWalletPassword,
} = appConfig;
const { sequelize } = model;

module.exports = {
  createWallet: async (data) => {
    try {
      const obj = {
        ...data,
      };

      obj.lock_code = bcrypt.hashSync(obj.lock_code, 0);
      const wallet = await model.wallet.create(obj);

      return wallet;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fetchRealTime: async (user, request) => {
    try {
      if (!request.planId) throw Object({ code: 'PLAN_REQUIRED', msg: 'Plan Id required' });

      const plan = await model.plans.findOne({ where: { id: request.planId } });

      if (!(plan && plan.id)) throw Object({ code: 'INVALID_PLAN', msg: 'Plan does not exist' });

      const firsTxn = await model.transactions.findOne({
        where: {
          userId: user.id, dest_id: request.planId, dest: 'plan', type: 'fund',
        },
        order: [
          ['createdAt', 'ASC'],
        ],
        raw: true,
      });

      const currentBalance = firsTxn.amount * (1 + await module.exports.getROI(user));

      return currentBalance;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fetchHistoricalTransactions: async (user, request) => {
    try {
      const page = Number(request.page) || 1;
      const limit = Number(request.per_page) || 100;

      const query = ['Select tr.*, u.email, p.planName, ac.name as asserClassName from transactions tr'];
      query.push(' left join plans p On p.id = tr.dest_id left join assertClasses ac On p.assertId = ac.id left join users u On tr.userId = u.id');
      query.push(' Where status = ? and dest != ? and source != ?');
      query.push(` and tr.userId = ${user.id}`);

      for (const x in request) {
        const field = x;
        const value = request[x];

        if (field || field === 0) {
          switch (field) {
            case 'type':
              if (field === 'fund' || field === 'disburse') query.push(` and type = '${value}'`);
              break;
            case 'ref':
              query.push(` and ref = '${value}' OR flutterReference = '${value}'`);
              break;
            case 'plan':
              query.push(` and dest_id = ${value}`);
              break;
            default:
              break;
          }
        }
      }

      const queryCount = query.slice();
      queryCount[0] = 'Select count(tr.id) as count from transactions tr';

      query.push('ORDER BY tr.id DESC');
      query.push(` LIMIT ${limit * (page - 1)}, ${limit}`);

      const bigPromise = await Promise.all([
        sequelize.query(query.join(' '), { type: sequelize.QueryTypes.SELECT, replacements: ['completed', 'system', 'system'] }),
        sequelize.query(queryCount.join(' '), { type: sequelize.QueryTypes.SELECT, replacements: ['completed', 'system', 'system'] }),
      ]);

      console.log(bigPromise[1][0]);

      return {
        response: bigPromise[0], count: bigPromise[1][0].count, page, limit,
      };
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  createPlan: async (data) => {
    try {
      const obj = {
        ...data,
      };
      const assert = await model.assertClasses.findOne({ where: { name: data.assertName }, raw: true });

      if (!(assert && assert.id)) throw Object({ code: 'INVALID_ASSERT', msg: 'Assert not found' });

      obj.assertId = assert.id;
      delete obj.assertName;

      const plans = await model.plans.findOrCreate({
        where: obj,
        defaults: obj,
        raw: true,
      });

      return plans;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fundingViaPayStack: async (data) => {
    try {
      const payload = {
        email: data.email,
        amount: Number(data.amount) * 100,
        bank: {
          code: data.code,
          account_number: data.account_number,
        },
        callback_url: data.callback_url,
        reference: data.reference,
      };

      const res = await services.request.httpRequest('POST', `${paystackUrl}/charge`, { payload: { ...payload }, authToken: `Bearer ${paystackPublicKey}` });

      if (!res.body || !res.body.status || !res.body.data || !res.body.data.reference) throw Object({ code: 'FAILED_FUNDING', msg: res.body.message || 'Funding failed' });

      const returnObj = {
        ...res.body,
      };

      return returnObj;
    } catch (error) {
      console.log('paystack account funding failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  validateAccountFunding: async (body, query) => {
    let txn;
    let wallet;
    const updateTxn = {};
    let promise;
    let returnObj = {};
    let user;

    try {
      const ref = body.reference || query.reference;

      txn = await model.transactions.findOne({ where: { ref, source: 'account' }, raw: true });

      if (!(txn && txn.id)) throw Object({ code: 'INVALID_TRANSACTION', msg: 'Transaction not found' });

      if (body.birthday) {
        const birthday = body.birthday.split('-');

        if (birthday[0].length !== 4 || birthday[1].length !== 2 || birthday[2].length !== 2) throw Object({ code: 'INVALID_BIRTHDAY', msg: 'Birthday format is wrong. Format should be yyyy-mm-dd' });

        promise = await services.request.httpRequest('POST', `${paystackUrl}/charge/submit_birthday`, { payload: { birthday, reference: ref }, authToken: `Bearer ${paystackPublicKey}` });

        if (!promise.body || !promise.body.status || !promise.body.data) throw Object({ code: 'FAILED_VERIFICATION', msg: (promise.body.data) ? promise.body.data.message : promise.body.message || 'Birthday verification failed' });

        returnObj = {
          ...promise.body,
        };
      } else if (body.otp) {
        const otp = body.otp;

        if (otp.length < 6) throw Object({ code: 'INVALID_OTP', msg: 'Otp has to be 6 numbers' });
        if (Number.isNaN(otp)) throw Object({ code: 'INVALID_OTP', msg: 'Otp must be a number' });

        promise = await services.request.httpRequest('POST', `${paystackUrl}/charge/submit_otp`, { payload: { otp, reference: ref }, authToken: `Bearer ${paystackPublicKey}` });

        if (!promise.body || !promise.body.status || !promise.body.data) throw Object({ code: 'FAILED_VERIFICATION', msg: (promise.body.data) ? promise.body.data.message : promise.body.message || 'Otp Verification failed' });

        returnObj = {
          ...promise.body,
        };
      } else if (query.reference) {
        const bigPromise = await Promise.all([
          model.wallet.findOne({ where: { userId: txn.userId }, raw: true }),
          model.users.findOne({ where: { id: txn.userId }, raw: true }),
        ]);

        wallet = bigPromise[0];
        user = bigPromise[1];

        if (!(wallet && wallet.id)) throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
        if (!(user && user.id)) throw Object({ code: 'INVALID_USER', msg: 'User not found' });

        promise = await services.request.httpRequest('GET', `${paystackUrl}/transaction/verify/${ref}`, { authToken: `Bearer ${paystackPublicKey}` });

        if (!promise.body || !promise.body.status || !promise.body.data || (promise.body.data.amount / 100) !== Math.round(txn.amount * await services.request.getExchangeRate('USD'))) throw Object({ code: 'FAILED_VERIFICATION', msg: (promise.body.data) ? promise.body.data.message : promise.body.message || 'Callback failed' });

        updateTxn.responseMessage = promise.body.data.message;

        if (promise.body.data.status === 'success') {
          updateTxn.status = 'completed';
          updateTxn.responseCode = '00';
          module.exports.updateBalance(wallet.id, txn.amount, txn.id);
          services.request.sendMail(user.email, 'Account Funding Status', `Your wallet has successfully been funded with USD ${promise.body.data.amount}`);
        } else if (promise.body.data.status === 'failed') {
          updateTxn.status = 'failed';
          updateTxn.responseCode = 'C0';
        }

        model.transactions.update(updateTxn, { where: { id: txn.id } });

        returnObj = {
          ...promise.body,
        };
      } else throw Object({ code: 'INVALID_RESPONSE', msg: 'Missing parameters' });

      return returnObj;
    } catch (error) {
      console.log('paystack verification failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fundViaRave: async (wallet, txn, data) => {
    try {
      let token = await services.request.httpRequest('POST', `${stagingUrl}/v1/merchant/verify`, { payload: { apiKey: mwApiKey, secret: mwSecret } });
      if (!(token && token.body && token.body.token)) throw Object({ code: 'INVALID_REQUEST', msg: token.body.message || 'Invalid Request' });
      token = token.body.token;

      let res = await services.request.httpRequest('POST', `${stagingUrl}/v1/transfer/rave`, { payload: { ...data }, authToken: token });

      if (res.code !== 200 || res.body.status !== 'success' || !res.body.data || !res.body.data.transfer) throw Object({ code: 'FAILED_FUNDING', msg: res.body.message || 'Funding failed' });

      res = res.body.data;

      const returnedObj = {
        responseMessage: res.transfer.responseMessage,
        amount: res.transfer.amountToSend,
        flutterReference: res.transfer.flutterChargeReference,
        currency: res.transfer.disburseCurrency,
        code: res.transfer.flutterChargeResponseCode || res.transfer.chargeResponseCode,
        message: res.transfer.flutterChargeResponseMessage || res.transfer.chargeResponseMessage,
        chargeMethod: res.transfer.chargeMethod,
      };

      const updateTxnObj = {
        responseMessage: res.transfer.flutterChargeResponseMessage || res.transfer.chargeResponseMessage,
        responseCode: res.transfer.flutterChargeResponseCode || res.transfer.chargeResponseCode,
        flutterReference: res.transfer.flutterChargeReference,
      };

      if (!res.pendingValidation) {
        module.exports.updateBalance(wallet.id, data.amount, txn.id);
        updateTxnObj.status = 'completed';
      } else {
        returnedObj.pendingValidation = res.pendingValidation;
        returnedObj.authurl = res.authurl;
      }

      model.transactions.update(updateTxnObj, { where: { id: txn.id } });

      return returnedObj;
    } catch (error) {
      console.log('rave card funding failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  reverse: async (userId, data) => {
    try {
      const type = (data.amount > 0) ? 'CREDIT' : 'DEBIT';
      const wallet = await model.wallet.findOne({ where: { userId } });

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_SOURCE_WALLET', msg: 'Source Wallet not found' });
      }

      if (type === 'DEBIT' && (wallet.balance) < Math.abs(data.amount)) {
        throw Object({ code: 'INSUFFICIENT_FUNDS', msg: 'Insufficient funds for Transaction' });
      }

      const transaction = {
        amount: Math.abs(data.amount),
        fee: 0,
        userId,
        currencyId: 'USD',
        ref: data.ref,
      };

      if (data.message) transaction.responseMessage = data.message;

      if (type === 'CREDIT') {
        transaction.type = 'fund';
        transaction.source = data.customSource || 'system';
        transaction.source_id = data.customSourceId || 0;
        transaction.dest = 'wallet';
        transaction.dest_id = wallet.id;
      } else {
        transaction.type = 'disburse';
        transaction.source = 'wallet';
        transaction.source_id = wallet.id;
        transaction.dest = data.customDest || 'system';
        transaction.dest_id = data.customDestId || 0;
      }

      const txn = await model.transactions.create(transaction);

      const balance = await module.exports.updateBalance(wallet.id, data.amount, txn.id);

      model.transactions.update({ status: 'completed', meta: JSON.stringify({ balance, narration: data.narration }) }, { where: { id: txn.id } });

      return { id: txn.id, msg: 'Successful' };
    } catch (error) {
      console.log('reversal failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  reverseTransaction: async (userId, reference, options = {}) => {
    let txn;
    try {
      txn = await model.transactions.findOne({
        where: {
          ref: reference, status: 'completed', userId, reversed: 0,
        },
        raw: true,
      });

      if (!(txn && txn.id)) {
        throw Object({ code: 'INVALID_REFERENCE', msg: 'Transaction not found or not in required state.' });
      }

      const data = {
        walletId: txn.type === 'disburse' ? txn.source_id : txn.dest_id,
        amount: txn.type === 'disburse' ? Number(txn.amount) + Number(txn.fee) : (Number(txn.amount) + Number(txn.fee)) * -1,
        currency: txn.currency,
        narration: txn.type === 'disburse' ? `Payoutrefund/${(txn.ref || txn.flutterReference)}` : `Fundreversal/${(txn.ref || txn.flutterReference)}`,
        ref: `${txn.ref}R`,
        message: (options.updateResponseMessage) ? options.updateResponseMessage : txn.responseMessage,
      };

      await module.exports.reverse(txn.userId, data);

      const update = {
        reversed: true,
        responseCode: options.updateResponseCode || 'RR',
        responseMessage: options.updateResponseMessage || 'Transaction Failed',
      };

      await model.transactions.update(update, { where: { id: txn.id } });

      return model.transactions.findOne({ where: { id: txn.id } });
    } catch (error) {
      console.log('reversal failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  getROI: async (user) => {
    try {
      // https://www.aaii.com/journal/article/how-to-calculate-the-return-on-your-portfolio?printerfriendly=true
      // formular gotten from the above link (Time-Weighted Return)

      let query = 'select amount, type from transactions where status = ? and reversed != ? and userId = ? and (source = ? OR dest = ?)';
      let allPlans = 'select tr.*, ac.name as assertName from transactions tr left join plans p On p.id = tr.dest_id left join assertClasses ac On p.assertId = ac.id where status = ? and reversed != ? and tr.userId = ? and type = ? and dest = ? group by dest_id order by tr.createdAt ASC';
      let allUnits = 'select meta, type from transactions tr where status = ? and reversed != ? and tr.userId = ? and dest = ?';

      const bigPromise = await Promise.all([
        sequelize.query(query, { type: sequelize.QueryTypes.SELECT, replacements: ['completed', 1, user.id, 'plan', 'plan'] }),
        sequelize.query(allPlans, { type: sequelize.QueryTypes.SELECT, replacements: ['completed', 1, user.id, 'fund', 'plan'] }),
        sequelize.query(allUnits, { type: sequelize.QueryTypes.SELECT, replacements: ['completed', 1, user.id, 'plan'] }),
      ]);

      query = bigPromise[0];
      allPlans = bigPromise[1];
      allUnits = bigPromise[2];

      let netAdditions = 0;
      let beginningValue = 0;
      let endingValue = 0;
      let unit = 0;
      let ignoreFirst = true;

      query.forEach((v) => {
        if (v.type === 'fund') {
          if (!ignoreFirst) netAdditions += v.amount;
          ignoreFirst = false;
        } else if (v.type === 'disburse') netAdditions -= v.amount;
      });

      for (const x in allUnits) {
        const current = allUnits[x];
        const meta = current.meta ? JSON.parse(current.meta) : {};

        if (current.type === 'fund') unit += meta.unit;
        if (current.type === 'disburse') unit -= meta.unit;
      }

      endingValue = unit * await services.request.getExchangeRate('newCryptoRate');

      for (const x in allPlans) {
        const current = allPlans[x];
        beginningValue += current.amount;
      }

      const numerator = endingValue - (0.50 * netAdditions);
      const denominator = beginningValue + (0.50 * netAdditions);
      const rio = (numerator / denominator) - 1;

      return rio;
    } catch (error) {
      console.log('get ROI failed: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fundPlan: async (user, data) => {
    let txn;
    let debited;
    let wallet;

    try {
      wallet = model.wallet.findOne({ where: { userId: user.id }, raw: true });
      let plan = model.plans.findOne({ where: { userId: user.id, planName: data.planName }, raw: true });

      const bigPromise = await Promise.all([wallet, plan]);

      wallet = bigPromise[0];
      plan = bigPromise[1];

      if (data.amount < 10) {
        throw Object({ code: 'INVALID_AMOUNT', msg: 'You can not fund with less than 10 dollars' });
      }

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
      }

      if (!(plan && plan.id)) {
        throw Object({ code: 'INVALID_PLAN', msg: 'Plan not found' });
      }

      if (wallet.balance < data.amount) {
        throw Object({ code: 'LOW_BALANCE', msg: 'Wallet balance is not sufficient' });
      }

      data.getExchangeRate = await services.request.getExchangeRate('Crypto');
      data.unit = data.amount / data.getExchangeRate;

      const transaction = {
        amount: data.amount.toFixed(2),
        fee: 0,
        type: 'fund',
        source: 'wallet',
        source_id: wallet.id,
        dest: 'plan',
        status: 'completed',
        dest_id: plan.id,
        userId: user.id,
        currency: data.chargeCurrency || 'USD',
        ref: `${Date.now().toString().slice(0, 10)}${Math.random().toString().slice(-5)}`,
        meta: JSON.stringify(data),
      };

      txn = await model.transactions.create(transaction);
      txn = txn.dataValues;

      await module.exports.updateBalance(wallet.id, txn.amount * -1, txn.id);
      debited = true;

      return txn;
    } catch (error) {
      const updateTxn = {
        status: 'failed',
        responseMessage: 'Request Failed',
        responseCode: 'C0',
      };

      if (txn) model.transactions.update(updateTxn, { where: { id: txn.id } });

      if (debited) await module.exports.updateBalance(wallet.id, Math.abs(txn.amount), txn.id);

      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  fundWallet: async (user, data) => {
    let txn;
    try {
      const wallet = await model.wallet.findOne({ where: { userId: user.id }, raw: true });

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
      }

      const meta = { ...data };
      delete meta.cvv;
      delete meta.expiry_year;
      delete meta.expiry_month;
      delete meta.pin;
      delete meta.card_no;

      const transaction = {
        amount: data.charge_currency === 'USD' ? (data.amount *= 1).toFixed(2) : (data.amount / await services.request.getExchangeRate('USD')).toFixed(2),
        fee: 0,
        type: 'fund',
        source: data.charge_with === 'card' ? 'card' : 'account',
        source_id: 0,
        dest: 'wallet',
        dest_id: wallet.id,
        userId: user.id,
        currency: 'USD',
        ref: data.ref,
        meta: JSON.stringify(meta),
      };

      txn = await model.transactions.create(transaction);
      txn = txn.dataValues;

      let funding;
      data.disburse_currency = 'NGN';

      if (data.charge_with === 'card') funding = await module.exports.fundViaRave(wallet, txn, data);
      else if (data.charge_with === 'account') funding = await module.exports.fundingViaPayStack(data);
      else throw Object({ code: 'INVALID_CHARGE_WITH', msg: 'Charge with is invalid. Only card and account' });

      return funding;
    } catch (error) {
      const updateTxn = {
        status: 'failed',
        responseMessage: 'Request Failed',
        responseCode: 'C0',
      };

      if (txn) model.transactions.update(updateTxn, { where: { id: txn.id } });

      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  validateCardFunding: async (data) => {
    let txn;
    let wallet;
    let user;
    const updateTxn = {
      status: 'failed',
      responseMessage: data.responseMessage || 'Request Failed',
      responseCode: data.rc || 'C0',
    };

    try {
      txn = await model.transactions.findOne({ where: { flutterReference: data.ref, source: 'card' }, raw: true });
      if (!(txn && txn.id)) throw Object({ code: 'INVALID_TRANSACTION', msg: 'Transaction not found' });

      const bigPromise = await Promise.all([
        model.wallet.findOne({ where: { userId: txn.userId }, raw: true }),
        model.users.findOne({ where: { id: txn.userId }, raw: true }),
      ]);

      wallet = bigPromise[0];
      user = bigPromise[1];

      if (!(wallet && wallet.id)) throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
      if (!(user && user.id)) throw Object({ code: 'INVALID_USER', msg: 'User not found' });

      if (txn.status !== 'pending' || txn.responseCode === '00') throw Object({ code: 'INVALID_TRANSACTION', msg: 'Transaction already validated' });

      if (data.rc === '00') {
        updateTxn.status = 'completed';
        module.exports.updateBalance(wallet.id, txn.amount, txn.id);
      }

      model.transactions.update(updateTxn, { where: { id: txn.id } });
      services.request.sendMail(user.email, 'Card Funding Status', `Your wallet has successfully been funded with USD ${txn.amount}`);

      return data;
    } catch (error) {
      if (txn) model.transactions.update(updateTxn, { where: { id: txn.id } });

      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  disburseFromWallet: async (user, data) => {
    let charged = false;
    let bigPromise;
    const reference = `${Date.now().toString().slice(0, 10)}${Math.random().toString().slice(-5)}`;
    const reversedObj = {};
    try {
      const payload = {
        ...data,
        userId: user.id,
        senderName: user.name,
      };
      let payout;

      let wallet = model.wallet.findOne({ where: { userId: payload.userId }, raw: true });
      let fetchedBeneficiary = services.beneficiary.createBeneficiary({
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        bankCode: payload.bankcode,
        userId: payload.userId,
        currency: 'USD',
      });
      let similarTxn = sequelize.query('Select * from transactions where userId = ? order by createdAt DESC LIMIT 1', { type: sequelize.QueryTypes.SELECT, replacements: [payload.userId] });

      bigPromise = await Promise.all([wallet, fetchedBeneficiary, similarTxn]);

      wallet = bigPromise[0];
      fetchedBeneficiary = bigPromise[1];
      similarTxn = bigPromise[2];

      if (Array.isArray(similarTxn)) similarTxn = similarTxn[0];

      reversedObj.wallet = wallet;

      const now = moment(new Date());
      const end = moment(similarTxn.createdAt);
      const duration = moment.duration(now.diff(end));
      const seconds = duration.asSeconds();

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
      } else if (!bcrypt.compareSync(data.lock, wallet.lock_code)) {
        throw Object({ code: 'INVALID_LOCKCODE', msg: 'Wallet Lock code does not match.' });
      } else if (seconds < 15) {
        throw Object({ code: 'POSSIBLE_DUPLICATE', msg: 'Similar transactions are prevented for 15 seconds' });
      }

      if (Array.isArray(fetchedBeneficiary)) fetchedBeneficiary = fetchedBeneficiary[0];

      if (!(fetchedBeneficiary && fetchedBeneficiary.id)) throw Object({ code: 'INVALID_BENEFICIARY', msg: 'Beneficiary does not exist' });

      const transaction = {
        amount: data.amount.toFixed(2),
        fee: 40,
        type: 'disburse',
        source: 'wallet',
        source_id: wallet.id,
        dest: 'beneficiary',
        dest_id: fetchedBeneficiary.id,
        userId: user.id,
        currency: 'USD',
        ref: reference,
      };

      reversedObj.amount = (transaction.amount + transaction.fee);

      if (wallet.balance < (transaction.amount + transaction.fee)) {
        throw Object({ code: 'LOW_BALANCE', msg: 'Wallet balance is not sufficient' });
      }

      const txn = await model.transactions.create(transaction);
      reversedObj.txn = txn.dataValues;

      let token = await services.request.httpRequest('POST', `${stagingUrl}/v1/merchant/verify`, { payload: { apiKey: mwApiKey, secret: mwSecret } });
      if (!(token && token.body && token.body.token)) throw Object({ code: 'INVALID_REQUEST', msg: token.body.message || 'Invalid Request' });
      token = token.body.token;

      payload.ref = reference;
      payload.lock = mwWalletPassword;
      payload.currency = 'NGN';
      payload.amount *= await services.request.getExchangeRate('USD');

      payout = await services.request.httpRequest('POST', `${stagingUrl}/v1/disburse`, { payload, authToken: token });
      if (!payout || payout.code !== 200) throw Object({ code: payout.body.code, msg: payout.body.message });

      const debitAmount = (transaction.amount + transaction.fee) * -1;
      const debitBalance = await module.exports.updateBalance(wallet.id, debitAmount, txn.id);

      charged = true;

      payout = payout.body.data.data;

      const updateTxn = {
        responseMessage: payout.responsemessage,
        responseCode: payout.responsecode,
        flutterReference: payout.uniquereference,
        walletCharged: true,
        meta: JSON.stringify({ balance: debitBalance, narration: data.narration }),
        status: (payout.responsecode === '00') ? 'completed' : 'pending',
      };

      await model.transactions.update(updateTxn, { where: { id: txn.id } });

      services.request.sendMail(user.email, 'Transaction Status', `Your transfer of USD ${data.amount} was successful`);

      return payout;
    } catch (error) {
      const updateTxn = {
        status: 'failed',
        responseMessage: 'Request Failed',
        responseCode: 'C0',
      };

      if (charged) await module.exports.updateBalance(reversedObj.wallet.id, Math.abs(reversedObj.amount), reversedObj.txn.id);

      if (reversedObj.txn) model.transactions.update(updateTxn, { where: { id: reversedObj.txn.id } });

      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  updateBalance: async (walletId, amount, ref) => {
    try {
      const balanceKey = 'balance';
      const fetchQuery = 'SELECT * FROM wallets WHERE id = ?';
      const dt = momentT().tz('Africa/Lagos').format().slice(0, 19).replace('T', ' ');

      let wallet = await sequelize.query(fetchQuery, { type: sequelize.QueryTypes.SELECT, replacements: [walletId] });
      if (Array.isArray(wallet)) wallet = wallet[0];

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found.' });
      } else if (amount < 0 && ((wallet[balanceKey]) < Math.abs(amount))) {
        throw Object({ code: 'LOW_BALANCE', msg: 'Wallet balance is not sufficient' });
      }

      const updateQuery = `UPDATE wallets SET ${balanceKey} = ${balanceKey} + ${Number(amount)}, updatedAt = ?, lastUpdatedRef = ? WHERE id = ?`;

      await sequelize.query(updateQuery, { type: sequelize.QueryTypes.UPDATE, replacements: [dt, ref, walletId] });

      const newBalance = (Number(wallet[balanceKey]) + Number(amount));

      wallet = await sequelize.query(fetchQuery, { type: sequelize.QueryTypes.SELECT, replacements: [walletId] });
      if (Array.isArray(wallet)) wallet = wallet[0];

      const returnedBal = wallet[balanceKey];

      if (newBalance !== returnedBal) {
        throw Object({ code: 'DEBIT_ERROR', msg: 'Invalid debit response' });
      }

      return returnedBal;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },
};
