const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const mosh = require('mosh');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();

app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());
app.use(mosh.initMoshErrorHandler);
app.use(mosh.initMosh);

app.use((req, res, next) => {
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
app.use(routes);

app.get('/', (req, res) => {
  res.send('PG');
});

module.exports = app;
