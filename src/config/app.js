'use strict';

const express       = require('express');
const cors          = require('cors');
const morgan        = require('morgan');
const path          = require('path');

const requestLogger = require('../middleware/requestLogger');
const notFound      = require('../middleware/notFound');
const errorHandler  = require('../middleware/errorHandler');

const dashboardRoutes = require('../routes/dashboard');
const recordsRoutes   = require('../routes/records');
const analyticsRoutes = require('../routes/analytics');
const chatRoutes      = require('../routes/chat');

const app = express();

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors());
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(requestLogger);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../public')));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/records',   recordsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat',      chatRoutes);

// ─── 404 for unknown API routes ───────────────────────────────────────────────
app.use(notFound);

// ─── SPA fallback (non-API routes) ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
