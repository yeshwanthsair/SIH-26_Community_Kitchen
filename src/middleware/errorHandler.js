'use strict';

/**
 * Global Express error handler.
 * Catches errors forwarded via next(err) and returns consistent JSON.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log 5xx errors in detail; 4xx are expected, log briefly
  if (status >= 500) {
    console.error('[ERROR]', req.method, req.originalUrl, status, err.stack || message);
  } else {
    console.warn('[WARN]',  req.method, req.originalUrl, status, message);
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && err.stack
      ? { stack: err.stack }
      : {}),
  });
}

module.exports = errorHandler;
