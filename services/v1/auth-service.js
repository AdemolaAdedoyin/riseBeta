/* eslint-disable no-unused-expressions */
const bcrypt = require('bcrypt-nodejs');
const model = require('../../models');
const services = require('..');
const appConfig = require('../../config/app');

module.exports = {
  createUser: async (userData) => {
    try {
      const obj = {
        ...userData,
      };

      obj.password = bcrypt.hashSync(obj.password, 0);
      const user = await model.users.create(obj);

      const walletData = {
        lock_code: userData.password,
        name: `${obj.name}'s Wallet`,
        userId: user.id,
      };

      await services.wallet.createWallet(walletData);

      return user;
    } catch (error) {
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },

  login: async (data) => {
    try {
      const query = {};
      const identifier = data.email;
      const { password } = data;

      query.email = identifier;
      const user = await model.users.findOne({ where: query, raw: true });

      if (!(user && user.id) || !bcrypt.compareSync(password, `$2a${user.password.slice(3)}`)) throw Object({ code: 'INVALID_USER', message: 'User credentials are Invalid' });

      (user.dataValues) ? delete user.dataValues.password : delete user.password;

      const token = await services.jwt.encrypt(user, appConfig.secret);
      user.token = token;

      return user;
    } catch (error) {
      console.log(error);
      throw Object({
        code: error.name || error.code || 'SERVER_ERROR',
        msg: error.message || error.msg || 'Server failed',
      });
    }
  },
};
