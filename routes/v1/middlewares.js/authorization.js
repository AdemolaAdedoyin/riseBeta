/* eslint-disable prefer-destructuring */
/* eslint-disable no-param-reassign */
const model = require('../../../models');

const services = require('../../../services');
const appConfig = require('../../../config/app');

function authorized(req, res, next) {
  if (!req.headers.authorization) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED_ACCESS',
      message: 'Access Denied',
    });
  }

  const token = req.headers.authorization;
  services.jwt.decrypt(token, appConfig.secret).then(
    (payload) => {
      if (payload) {
        if (!payload.id) {
          res.status(401).json({
            status: 'error',
            code: 'UNAUTHORIZED_ACCESS',
            message: 'User is inactive.',
          });
        }
        model.users.findOne({ where: { id: payload.id } }).then(
          (user) => {
            if (Array.isArray(user)) user = user[0];
            req.user = (user.dataValues) ? user.dataValues : user;
            next();
          },
          (err) => {
            res.status(401).json({
              status: 'error',
              code: 'UNAUTHORIZED_ACCESS',
              message:
                err && err.msg ? err.msg : 'User does not exist',
            });
          },
        );
      } else {
        throw new Error('Unable to decrypt payload.');
      }
    },
    (error) => {
      console.log(error, {
        h: req.headers,
        r: req.url,
        ip:
          (req.headers['x-forwarded-for'] || '').split(',')[0]
          || req.connection.remoteAddress
          || req.ip,
      });
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED_ACCESS',
        message: 'Invalid or expired token',
      });
    },
  );
}

module.exports = authorized;
