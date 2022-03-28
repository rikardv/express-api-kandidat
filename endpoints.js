const express = require('express');
const router = express.Router();
const handler = require('./handlers/handler');

/**
 * Alla API endpoints defineras nedan med tillhörande handler och dess funktioner
 */

/* Testing endpoints */
router.get('/test/betyg', handler.getBetyg);
router.get('/test/avbrott', handler.getAvbrott);

module.exports = router;
