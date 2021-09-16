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

  fetchBeneficiary: async (user, request = {}) => {
    const page = Number(request.page) || 1;
    const limit = Number(request.per_page) || 100;
    const querypart = [];
    try {
      const attributepart = '*';

      querypart.push(`SELECT ${attributepart} from beneficiaries`);
      querypart.push(`Where userId = ${user.id} and deletedAt is NULL`);

      for (const x in request) {
        const field = x;
        const value = request[x];
        if (field || field === 0) {
          switch (field) {
            case 'accountNumber':
              querypart.push(`and accountNumber = '${value}'`);
              break;
            case 'accountName':
              querypart.push(`and accountName = ${value}`);
              break;
            case 'id':
              querypart.push(`and id = '${value}'`);
              break;
            default:
              break;
          }
        }
      }

      let querypartCount = false;
      querypartCount = querypart.slice();
      querypartCount[0] = 'SELECT COUNT(id) as count from beneficiaries';

      querypart.push(' ORDER BY id DESC');
      querypart.push(` LIMIT ${limit * (page - 1)}, ${limit}`);

      let queryC = sequelize.query(querypartCount.join(' '), {
        type: sequelize.QueryTypes.SELECT,
        replacements: [],
      });

      let response = sequelize.query(querypart.join(' '), {
        type: sequelize.QueryTypes.SELECT,
        replacements: [],
      });

      const bigPromise = await Promise.all([queryC, response]);

      queryC = bigPromise[0];
      response = bigPromise[1];

      return {
        response, count: queryC[0].count, page, limit,
      };
    } catch (error) {
      console.log('can not get beneficiaries: ', error);
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
