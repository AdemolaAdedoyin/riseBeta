/* eslint-disable no-unused-expressions */
const services = require('../../services');

module.exports = {
  createUser: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck(params.name, '{name} User name is required.', null, false, 400, 'INVALID_NAME');
      res.mosh.emptyCheck(params.email, '{email} User email is required.', null, false, 400, 'INVALID_EMAIL');
      res.mosh.emptyCheck(params.password, '{password} User password is required.', null, false, 400, 'INVALID_PASSWORD');

      const data = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
      };

      const createdUser = await services.auth.createUser(data);

      (createdUser.dataValues) ? delete createdUser.dataValues.password : delete createdUser.password;

      res.json({
        status: 'success',
        data: createdUser,
      });
    } catch (err) {
      console.log('User creation failed', err);
      res.status(500).json({
        status: 'error',
        code: err.code,
        message: err.msg,
      });
    }
  },

  login: async (req, res) => {
    try {
      const params = req.body;

      res.mosh.emptyCheck(params.email, '{email} User email is required.', null, false, 400, 'INVALID_EMAIL');
      res.mosh.emptyCheck(params.password, '{password} User password is required.', null, false, 400, 'INVALID_PASSWORD');

      const fetchUser = await services.auth.login(params);

      (fetchUser.dataValues) ? delete fetchUser.dataValues.password : delete fetchUser.password;

      res.json({
        status: 'success',
        data: fetchUser,
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
