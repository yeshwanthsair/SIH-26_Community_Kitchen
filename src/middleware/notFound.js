'use strict';

/**
 * 404 handler — mounted after all routes.
 * Only applies to /api/* paths; all other paths fall through to the SPA.
 */
function notFound(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
  next();
}

module.exports = notFound;
