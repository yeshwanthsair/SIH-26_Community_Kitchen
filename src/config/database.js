'use strict';

const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');

require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './database/kitchen.db');
const dbDir  = path.dirname(dbPath);
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

/** @type {import('sql.js').Database|null} */
let _db = null;

/**
 * Return the singleton sql.js Database, opening / creating the file on first call.
 * @returns {Promise<import('sql.js').Database>}
 */
async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  _db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  _db.run('PRAGMA foreign_keys = ON;');

  // A fresh checkout should be usable with `npm start`; apply the idempotent
  // schema whenever this database file does not yet contain DailyRecords.
  const table = _db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'DailyRecords'");
  if (!table.length) {
    _db.run(fs.readFileSync(schemaPath, 'utf8'));
    persistDb();
    console.log('[DB] Schema applied from', schemaPath);
  }
  console.log('[DB] SQLite ready at', dbPath);
  return _db;
}

/**
 * Flush the in-memory database to disk.
 * Must be called after every write operation.
 */
function persistDb() {
  if (!_db) return;
  fs.writeFileSync(dbPath, Buffer.from(_db.export()));
}

/**
 * Close the connection and reset the singleton.
 */
function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

/**
 * Execute a raw SQL string (useful for schema setup and migrations).
 * @param {string} sql
 */
function runSql(sql) {
  if (!_db) throw new Error('Database not initialised – call getDb() first.');
  _db.run(sql);
}

/**
 * Return the cached database instance synchronously.
 * Throws if getDb() has not been awaited yet.
 * @returns {import('sql.js').Database}
 */
function getDbSync() {
  if (!_db) throw new Error('Database not ready. Ensure getDb() was awaited at startup.');
  return _db;
}

module.exports = { getDb, getDbSync, persistDb, closeDb, runSql };
