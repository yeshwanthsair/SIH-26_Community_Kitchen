'use strict';

const service    = require('../services/recordService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/dashboard
 * Returns a full dashboard summary: totals, latest record, trends, top days.
 */
async function getDashboard(req, res, next) {
  try {
    const summary = service.getDashboardSummary();
    return sendSuccess(res, summary, 'Dashboard data retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
