/* eslint-disable import/order */
const server = require('./server');
const appConfig = require('./config/app');
const models = require('./models');

models.sequelize.sync({ force: false }).then(() => {
  server.listen(appConfig.port, () => {
    console.log(`${appConfig.name} is running on port ${appConfig.port}`);
  });
});
