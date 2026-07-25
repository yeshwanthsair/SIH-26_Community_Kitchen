'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'api.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Lightweight request logger that writes API calls to logs/api.log.
 * In production morgan (already in app.js) covers this; this supplement
 * captures structured JSON lines for API routes only.
 */
function requestLogger(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();

  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts:     new Date().toISOString(),
      method: req.method,
      url:    req.originalUrl,
      status: res.statusCode,
      ms:     Date.now() - start,
      ip:     req.ip,
    };
    const line = JSON.stringify(entry) + '\n';
    fs.appendFile(LOG_FILE, line, () => {}); // fire-and-forget
  });

  next();
}

module.exports = requestLogger;
