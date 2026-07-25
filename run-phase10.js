'use strict';

/** Starts an isolated ephemeral HTTP server for the Phase 10 API regression suite. */
const { spawn } = require('child_process');
const { getDb, closeDb } = require('./src/config/database');
const app = require('./src/config/app');

(async () => {
  await getDb();
  const server = app.listen(0, () => {
    const { port } = server.address();
    const child = spawn(process.execPath, ['test-phase10.js'], {
      env: { ...process.env, BASE_URL: `http://127.0.0.1:${port}` },
      stdio: 'inherit',
    });
    child.on('error', error => {
      console.error('[Phase 10] Could not start test suite:', error.message);
      server.close(() => { closeDb(); process.exit(1); });
    });
    child.on('close', code => {
      server.close(() => {
        closeDb();
        process.exitCode = code ?? 1;
      });
    });
  });
})().catch(error => {
  console.error('[Phase 10] Setup failed:', error.message);
  process.exitCode = 1;
});
