'use strict';

const service  = require('../services/recordService');
const { sendSuccess, sendBadRequest } = require('../utils/response');

/**
 * GET /api/analytics
 * Query params:
 *   month  (YYYY-MM, optional) — filter summary to a single month
 */
function getAnalytics(req, res, next) {
  try {
    const { month } = req.query;

    if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return sendBadRequest(res, 'Invalid query parameters', { month: 'must be YYYY-MM' });
    }

    const analytics = service.getAnalytics(month);
    return sendSuccess(res, analytics, 'Analytics retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = { getAnalytics };
