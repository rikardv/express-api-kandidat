/**
 * Ställer in alla parametrar för API:et och låter den ligga på en port
 */

const app = require('express')();
const utils = require('./setup/utils');
var cors = require('cors');
var logger = require('morgan');
const pageRouter = require('./endpoints');
const PORT = 8080;
app.use(cors());
app.listen(PORT, () =>
  console.log(`Vårt api ligger och chillar på http://localhost:${PORT}`)
);
app.use(logger('dev'));
app.use('/', pageRouter);

module.exports = app;
