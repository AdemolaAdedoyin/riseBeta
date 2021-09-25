const unirest = require('unirest');
const q = require('q');
const nodemailer = require('nodemailer');
// const crypto = require('crypto');
const services = require('..');
const appConfig = require('../../config/app');

const {
  accountEmail, accountPassword,
} = appConfig;

module.exports = {
  httpRequest: (method, url, options = {}) => {
    const d = q.defer();
    let client = false;
    const headers = {};

    if (method === 'GET') {
      client = unirest.get(url);
    } else if (method === 'POST') {
      client = unirest.post(url);
    }

    if (options && options.auth) {
      client.auth({
        user: options.auth.username,
        pass: options.auth.password,
        sendImmediately: true,
      });
    }

    if (options && options.authRefToken) {
      headers.Authorization = services.encryption.encrypt(
        options.authRefToken,
        'SHA512',
      );
    }

    if (options && options.authToken) {
      headers.Authorization = options.authToken;
    }

    if (options && options.password) {
      headers.password = options.password;
    }

    if (options && options.payload) {
      headers['Content-Type'] = 'application/json';
    } else if (options && options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    client.headers(headers);

    if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      client.send(options.form);
    } else {
      client.send(options.payload);
    }

    client.end((resp) => {
      console.log(
        'Client http request response',
        method,
        url,
        headers,
        options.payload,
        resp.code,
        resp.body,
      );
      d.resolve({ code: resp.code, body: resp.body, url });
    });

    return d.promise;
  },

  sendMail: async (receiversEmail, subject, message) => {
    try {
      // const account = await nodemailer.createTestAccount(); // run again when next you get email error 450
      const account = {
        user: 'bep6jpj23uujaccz@ethereal.email',
        pass: 'F5CtTdc6XZP46mQ5XJ',
      };

      const etherealUser = account.user;
      const etherealPass = account.pass; // log in @ https://ethereal.email
      let config = {};

      if (process.env.NODE_ENV === 'production') {
        config = {
          host: 'smtp.gmail.com',
          service: 'gmail',
          auth: {
            user: accountEmail,
            pass: accountPassword,
          },
        };
      } else config = `smtp://${etherealUser}:${etherealPass}@smtp.ethereal.email/?pool=true`;

      const transporter = nodemailer.createTransport(config);
      const verify = await transporter.verify();
      console.log('verify', verify);

      let mailOptions = {};

      mailOptions = {
        from: accountEmail, // sender address
        to: receiversEmail, // list of receivers
        subject: subject || 'Notification', // Subject line
      };

      mailOptions.text = message; // plain text body

      const info = await transporter.sendMail(mailOptions);
      console.log('Message sent - accepted: %s', info.accepted);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return 1;
    } catch (e) {
      console.log('failed sending mail -', e);
      throw Object({
        code: e.name || e.code || 'SERVER_ERROR',
        msg: e.message || e.msg || 'Server failed',
      });
    }
  },

  getExchangeRate: async (name) => {
    let exchangeRate;

    switch (name) {
      case 'Crypto':
        exchangeRate = 30000;
        break;
      case 'newCryptoRate':
        exchangeRate = 30000;
        break;
      case 'USD':
        exchangeRate = 565;
        break;
      default:
        exchangeRate = 40;
        break;
    }

    return exchangeRate;
  },
};
