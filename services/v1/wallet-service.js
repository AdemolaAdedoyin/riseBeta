/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-const-assign */
/* eslint-disable no-unused-expressions */
const bcrypt = require('bcrypt-nodejs');
const momentT = require('moment-timezone');
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

  fetchWallet: async (userId) => {
    const querypart = [];
    try {
      const attributepart = '*';

      querypart.push(`SELECT ${attributepart} from wallets`);

      if (userId) querypart.push(`Where userId = ${userId} and deletedAt is NULL`);
      else querypart.push('Where id = 0 and deletedAt is NULL');

      querypart.push(' ORDER BY id DESC');

      const response = await sequelize.query(querypart.join(' '), {
        type: sequelize.QueryTypes.SELECT,
        replacements: [],
      });

      return response;
    } catch (error) {
      console.log('can not get wallet: ', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        error.message = error.parent.message || error.errors[0].message;
      }
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
        amount: Number(data.amount),
        bank: {
          code: data.code,
          account_number: data.account_number,
        },
        callback_url: 'http://bda5-197-210-77-157.ngrok.io/fund/account/validate',
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
        wallet = await model.wallet.findOne({ where: { userId: txn.userId }, raw: true });
        if (!(wallet && wallet.id)) throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });

        promise = await services.request.httpRequest('GET', `${paystackUrl}/transaction/verify/${ref}`, { authToken: `Bearer ${paystackPublicKey}` });

        if (!promise.body || !promise.body.status || !promise.body.data || promise.body.data.amount !== txn.amount) throw Object({ code: 'FAILED_VERIFICATION', msg: (promise.body.data) ? promise.body.data.message : promise.body.message || 'Callback failed' });

        updateTxn.responseMessage = promise.body.data.message;

        if (promise.body.data.status === 'success') {
          updateTxn.status = 'completed';
          updateTxn.responseCode = '00';
          module.exports.updateBalance(wallet.id, txn.amount, txn.id);
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

      if (res.code !== 200 || res.body.status !== 'success' || !res.body.data || !res.body.data.transfer) throw Object({ code: 'FAILED_FUNDING', msg: 'Funding failed' });

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

  fundWallet: async (user, data) => {
    let txn;
    try {
      const wallet = await model.wallet.findOne({ where: { userId: user.id }, raw: true });

      if (!(wallet && wallet.id)) {
        throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
      }

      const transaction = {
        amount: data.amount,
        fee: 0,
        type: 'fund',
        source: data.charge_with === 'card' ? 'card' : 'account',
        source_id: 0,
        dest: 'wallet',
        dest_id: wallet.id,
        userId: user.id,
        currency: data.chargeCurrency || 'NGN',
        ref: data.ref,
        meta: JSON.stringify({
          firstName: data.firstname, lastName: data.lastname, email: data.email, charge_with: data.charge_with,
        }),
      };

      txn = await model.transactions.create(transaction);
      txn = txn.dataValues;

      let funding;

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
    const updateTxn = {
      status: 'failed',
      responseMessage: data.responseMessage || 'Request Failed',
      responseCode: data.rc || 'C0',
    };

    try {
      txn = await model.transactions.findOne({ where: { flutterReference: data.ref, source: 'card' }, raw: true });
      if (!(txn && txn.id)) throw Object({ code: 'INVALID_TRANSACTION', msg: 'Transaction not found' });

      wallet = await model.wallet.findOne({ where: { userId: txn.userId }, raw: true });
      if (!(wallet && wallet.id)) throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });

      if (txn.status !== 'pending' || txn.responseCode === '00') throw Object({ code: 'INVALID_TRANSACTION', msg: 'Transaction already validated' });

      if (data.rc === '00') {
        updateTxn.status = 'completed';
        module.exports.updateBalance(wallet.id, txn.amount, txn.id);
      }

      model.transactions.update(updateTxn, { where: { id: txn.id } });

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

      if (data.medium === 'email') payout = await module.exports.disburseToUser(payload);
      else if (data.medium === 'beneficiary') {
        if (!data.beneficiaryId) throw Object({ code: 'INVALID_BENEFICIARY_ID', msg: '{beneficiaryId} Beneficiary Id is required' });

        let wallet = model.wallet.findOne({ where: { userId: payload.userId }, raw: true });
        let fetchedBeneficiary = model.beneficiary.findOne({ where: { id: data.beneficiaryId } });

        bigPromise = await Promise.all([wallet, fetchedBeneficiary]);

        wallet = bigPromise[0];
        fetchedBeneficiary = bigPromise[1];

        reversedObj.wallet = wallet;

        if (!(wallet && wallet.id)) {
          throw Object({ code: 'INVALID_WALLET', msg: 'Wallet not found' });
        } else if (!bcrypt.compareSync(data.lock, wallet.lock_code)) {
          throw Object({ code: 'INVALID_LOCKCODE', msg: 'Wallet Lock code does not match.' });
        }

        if (Array.isArray(fetchedBeneficiary)) fetchedBeneficiary = fetchedBeneficiary[0];

        if (!(fetchedBeneficiary && fetchedBeneficiary.id)) throw Object({ code: 'INVALID_BENEFICIARY', msg: 'Beneficiary does not exist' });

        payload.accountNumber = fetchedBeneficiary.accountNumber;
        payload.bankcode = fetchedBeneficiary.bankCode;

        const transaction = {
          amount: data.amount,
          fee: 40,
          type: 'disburse',
          source: 'wallet',
          source_id: wallet.id,
          dest: 'beneficiary',
          dest_id: fetchedBeneficiary.id,
          userId: user.id,
          currency: 'NGN',
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
      } else throw Object({ code: 'INVALID_MEDIUM', msg: 'Medium is invalid' });

      await services.request.sendMail(user.email, 'Transaction Status', `Your transfer of NGN ${data.amount} was successful`);

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

  disburseToUser: async (data) => {
    try {
      if (!data.destinationEmail) throw Object({ code: 'INVALID_EMAIL', msg: ' {destinationEmail} Disburse email is required' });

      let bigPromise;
      const ref = `${Date.now().toString().slice(0, 10)}${Math.random().toString().slice(-5)}`;

      const destUser = await model.users.findOne({ where: { email: data.destinationEmail }, raw: true });
      if (!(destUser && destUser.id)) throw Object({ code: 'INVALID_EMAIL', msg: 'Destination Email is invalid' });

      let sourceWallet = model.wallet.findOne({ where: { userId: data.userId }, raw: true });
      let destWallet = model.wallet.findOne({ where: { userId: destUser.id }, raw: true });

      bigPromise = await Promise.all([sourceWallet, destWallet]);
      sourceWallet = bigPromise[0];
      destWallet = bigPromise[1];

      if (!(sourceWallet && sourceWallet.id)) {
        throw Object({ code: 'INVALID_SOURCE_WALLET', msg: 'Source Wallet not found' });
      } else if (!(destWallet && destWallet.id)) {
        throw Object({ code: 'INVALID_DEST_WALLET', msg: 'Destination Wallet not found' });
      } else if (!bcrypt.compareSync(data.lock, sourceWallet.lock_code)) {
        throw Object({ code: 'INVALID_LOCKCODE', msg: 'Wallet Lock code does not match.' });
      } else if (sourceWallet.balance < data.amount) {
        throw Object({ code: 'LOW_BALANCE', msg: 'Wallet balance is not sufficient' });
      }

      const transactionOut = {
        amount: data.amount,
        fee: 0,
        type: 'disburse', // 'wallet-transfer-out',
        source: 'wallet',
        source_id: sourceWallet.id,
        dest: 'wallet',
        dest_id: destWallet.id,
        userId: sourceWallet.userId,
        currency: 'NGN',
        ref: `${ref}-OUT`,
      };

      const transactionIn = {
        amount: data.amount,
        fee: 0,
        type: 'fund', // 'wallet-transfer-in',
        source: 'wallet',
        source_id: sourceWallet.id,
        dest: 'wallet',
        dest_id: destWallet.id,
        userId: destWallet.userId,
        currency: 'NGN',
        ref: `${ref}-IN`,
      };

      const outP = await model.transactions.create(transactionOut);
      const inP = (outP) ? await model.transactions.create(transactionIn) : null;

      const debitAmount = data.amount * (-1);
      let debitBalance = module.exports.updateBalance(sourceWallet.id, debitAmount, outP.id);
      const creditAmount = data.amount;
      let creditBalance = module.exports.updateBalance(destWallet.id, creditAmount, inP.id);

      bigPromise = await Promise.all([debitBalance, creditBalance]);
      debitBalance = bigPromise[0];
      creditBalance = bigPromise[1];

      await Promise.all([
        model.transactions.update({ status: 'completed', meta: JSON.stringify({ balance: debitBalance, narration: data.narration }), walletCharged: true }, { where: { id: outP.id } }),
        model.transactions.update({ status: 'completed', meta: JSON.stringify({ balance: creditBalance, narration: data.narration }) }, { where: { id: inP.id } }),
      ]);

      outP.status = 'completed';

      return outP;
    } catch (error) {
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
