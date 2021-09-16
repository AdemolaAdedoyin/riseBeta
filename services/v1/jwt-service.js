/* eslint-disable no-param-reassign */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

const Q = require('q');
const jwt = require('jsonwebtoken');
const _ = require('lodash');

/**
 * responsible for managing jwt creation and deletion
 * @class JwtService
 */
class JwtService {
  /**
   * uses the clientid to get a client secret and encrypt the supplied payload
   * @method encrypt
   * @static
   * @param payload {Object} any object to be encrypet to jw token
   * @param secret {String}
   * @return Promise
   */
  static encrypt(payload, secret, options = {}) {
    const deferred = Q.defer();
    Q.fcall(() => {
      if (_.isEmpty(payload)) {
        return deferred.reject({ code: 'INVALID_PAYLOAD', message: 'payload can not be empty' });
      }

      jwt.sign(payload, secret, { expiresIn: options.expireDuration || 7200 },
        (err, token) => {
          if (err) {
            deferred.reject({ code: 'INVALID_REQUEST', message: 'Payload can not be tokenized' });
            return;
          }
          deferred.resolve(token);
        });
    });

    return deferred.promise;
  }

  /**
   * uses the client id supplied to get the client secret and decrypt the token
   * supplied into its original payload or rejects the returned promise
   * @method decrypt
   * @static
   * @param token {String}
   * @param secret {String}
   * @return Promise
   */
  static decrypt(token, secret) {
    // TODO: change in such a way to be able to test expiration
    const deferred = Q.defer();
    Q.fcall(() => {
      if (!token) {
        deferred.reject({ code: 'INVALID_TOKEN', message: 'Token is required' });
        return;
      }
      jwt.verify(token, secret, (err, payload) => {
        if (err) {
          deferred.reject({ code: 'INVALID_TOKEN', message: 'Token is either invalid or expired' });
        } else {
          deferred.resolve(payload);
        }
      });
    });
    return deferred.promise;
  }
}

module.exports = JwtService;
