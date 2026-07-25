'use strict';

require('dotenv').config();
const fs                            = require('fs');
const path                          = require('path');
const { getDb, persistDb, runSql }  = require('./database');

const SCHEMA_FILE = path.join(__dirname, '../../database/schema.sql');

(async () => {
  const db = await getDb();

  // Read and execute the schema (CREATE TABLE IF NOT EXISTS – idempotent)
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  runSql(schema);

  persistDb();
  console.log('[DB] Schema applied from', SCHEMA_FILE);
  console.log('[DB] Database initialised successfully.');
  process.exit(0);
})();
