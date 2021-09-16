module.exports = {}; // handle cyclic dependency

const apiServices = require('./v1');

Object.keys(apiServices).forEach((v) => {
  module.exports[v] = apiServices[v];
});
