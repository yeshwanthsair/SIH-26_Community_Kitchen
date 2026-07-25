'use strict';

const { Router } = require('express');
const { getDashboard } = require('../controllers/dashboardController');

const router = Router();

// GET /api/dashboard
router.get('/', getDashboard);

module.exports = router;
