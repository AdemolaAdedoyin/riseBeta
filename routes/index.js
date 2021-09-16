const router = require('express').Router();
const api = require('./v1');

router.use('/v1', api);

module.exports = router;
