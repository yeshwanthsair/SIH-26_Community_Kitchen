'use strict';

const { Router } = require('express');
const { getAnalytics } = require('../controllers/analyticsController');

const router = Router();

// GET /api/analytics
router.get('/', getAnalytics);

module.exports = router;
