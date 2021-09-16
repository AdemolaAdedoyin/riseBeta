/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const fs = require('fs');

// Load `*.js` under current directory as properties
//  i.e., `User.js` will become `exports['User']` or `exports.User`
console.log(' :: API SERVICES');
try {
  fs.readdirSync(`${__dirname}/`).forEach((file) => {
    if (file.match(/\.js$/) !== null && file !== 'index.js') {
      const name = file
        .replace('-service.js', '')
        .replace('.js', '')
        .replace('-', '_');
      console.log(name);
      module.exports[name] = require(`./${file}`);
    }
  });
} catch (e) {
  console.log(e);
}
