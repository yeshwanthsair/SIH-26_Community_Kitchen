'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { getDb, persistDb, runSql, closeDb } = require('../config/database');
const { generateSampleData }                = require('./sampleData');

const SCHEMA_FILE = path.join(__dirname, '../../database/schema.sql');

(async () => {
  const db = await getDb();

  // 1. Apply schema (idempotent)
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  runSql(schema);
  console.log('[Seed] Schema applied.');

  // 2. Check for existing data
  const existing = db.exec('SELECT COUNT(*) AS cnt FROM DailyRecords;');
  const count    = existing[0].values[0][0];

  if (count > 0) {
    console.log(`[Seed] DailyRecords already has ${count} rows – skipping insert.`);
    console.log('[Seed] To re-seed, delete database/kitchen.db and run again.');
    closeDb();
    process.exit(0);
  }

  // 3. Generate 100 realistic records
  const records = generateSampleData();
  console.log(`[Seed] Inserting ${records.length} records …`);

  const INSERT_SQL = `
    INSERT INTO DailyRecords
      (date, meals_served, rice_kg, dal_kg, vegetables_kg,
       stock_balance, cost_per_meal, rice_per_meal, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  const stmt = db.prepare(INSERT_SQL);
  let inserted = 0;
  let skipped  = 0;

  for (const r of records) {
    try {
      stmt.run([
        r.date,
        r.meals_served,
        r.rice_kg,
        r.dal_kg,
        r.vegetables_kg,
        r.stock_balance,
        r.cost_per_meal,
        r.rice_per_meal,
        r.status,
      ]);
      inserted++;
    } catch (err) {
      // UNIQUE constraint on date – skip duplicates gracefully
      if (err.message.includes('UNIQUE')) {
        console.warn(`[Seed] Skipped duplicate date: ${r.date}`);
        skipped++;
      } else {
        throw err;
      }
    }
  }
  stmt.free();

  // 4. Persist to disk
  persistDb();

  // 5. Verify
  const verify = db.exec('SELECT COUNT(*) AS cnt FROM DailyRecords;');
  const total  = verify[0].values[0][0];

  console.log(`[Seed] Inserted : ${inserted}`);
  if (skipped) console.log(`[Seed] Skipped  : ${skipped}`);
  console.log(`[Seed] Total rows in DailyRecords: ${total}`);
  console.log('[Seed] Database seeded successfully.');

  closeDb();
  process.exit(0);
})();
