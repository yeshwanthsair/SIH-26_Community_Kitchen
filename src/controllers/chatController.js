'use strict';

const service  = require('../services/recordService');
const { validateChatMessage } = require('../utils/validate');
const { sendSuccess, sendBadRequest } = require('../utils/response');

/**
 * POST /api/chat
 * Body: { message: string }
 */
function postChat(req, res, next) {
  try {
    const errors = validateChatMessage(req.body);
    if (errors) return sendBadRequest(res, 'Validation failed', errors);

    const result = service.processChat(req.body.message);
    return sendSuccess(res, result, 'Chat response generated');
  } catch (err) {
    next(err);
  }
}

module.exports = { postChat };
