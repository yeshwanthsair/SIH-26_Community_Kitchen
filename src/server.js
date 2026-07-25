'use strict';
require('dotenv').config();

const { getDb } = require('./config/database');
const app = require('./config/app');

const PORT     = parseInt(process.env.PORT, 10) || 3000;
const APP_NAME = process.env.APP_NAME || 'Community Kitchen';

getDb()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('  =========================================');
      console.log('   ' + APP_NAME);
      console.log('   Server : http://localhost:' + PORT);
      console.log('   Mode   : ' + (process.env.NODE_ENV || 'development'));
      console.log('  =========================================');
      console.log('');
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[FATAL] Port ${PORT} is already in use. Stop the other process or set PORT in .env.`);
      } else {
        console.error('[FATAL] Server failed to start:', err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('[FATAL] DB init failed:', err.message);
    process.exit(1);
  });
