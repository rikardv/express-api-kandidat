const express = require('express');
const router = express.Router();
const test_handler = require('./handlers/test_handler');

/**
 * Alla API endpoints defineras nedan med tillhörande handler och dess funktioner
 */

/* Testing endpoints */
router.get('/test/betyg', test_handler.getBetyg);
router.get('/test/avbrott', test_handler.getAvbrott);

module.exports = router;
