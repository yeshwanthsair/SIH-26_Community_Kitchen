'use strict';

/**
 * Unified JSON response helpers.
 * All API responses go through these so shape is always consistent.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 * @param {number} [statusCode=200]
 */
function sendSuccess(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send a created (201) response.
 */
function sendCreated(res, data, message = 'Created') {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {*} [errors]
 */
function sendError(res, message, statusCode = 500, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * Send a 404 Not Found response.
 */
function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, 404);
}

/**
 * Send a 400 Bad Request response.
 */
function sendBadRequest(res, message = 'Bad request', errors = null) {
  return sendError(res, message, 400, errors);
}

module.exports = { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest };
