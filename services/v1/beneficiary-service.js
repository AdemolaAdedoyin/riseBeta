/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-unused-expressions */
const model = require('../../models');
const services = require('..');

const { sequelize } = model;

module.exports = {
  createBeneficiary: async (data) => {
    try {
      const obj = {
        ...data,
      };

      await services.bank.fetchBanks(obj.bankCode);

      const beneficiary = await model.beneficiary.findOrCreate({
        where: obj,
        defaults: obj,
        raw: true,
      });

      return beneficiary[0] || beneficiary;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

};
