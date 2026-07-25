-- =============================================================
-- Community Kitchen  –  Database Schema
-- Phase 2
-- Engine : SQLite (sql.js)
-- =============================================================

PRAGMA foreign_keys = ON;

-- -------------------------------------------------------------
-- DailyRecords
-- One row per calendar day of kitchen operation.
-- A UNIQUE constraint on (date) prevents duplicate entries.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DailyRecords (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT    NOT NULL UNIQUE,           -- ISO-8601  YYYY-MM-DD
  meals_served   INTEGER NOT NULL DEFAULT 0,
  rice_kg        REAL    NOT NULL DEFAULT 0,
  dal_kg         REAL    NOT NULL DEFAULT 0,
  vegetables_kg  REAL    NOT NULL DEFAULT 0,
  stock_balance  REAL    NOT NULL DEFAULT 0,
  cost_per_meal  REAL    NOT NULL DEFAULT 0,
  rice_per_meal  REAL    NOT NULL DEFAULT 0,        -- kg of rice per meal served
  status         TEXT    NOT NULL DEFAULT 'open'
                   CHECK(status IN ('open','closed','holiday')),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- -------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------
-- Fast lookup by date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_daily_date   ON DailyRecords(date);

-- Fast filtering by status
CREATE INDEX IF NOT EXISTS idx_daily_status ON DailyRecords(status);

-- Fast monthly aggregation queries
CREATE INDEX IF NOT EXISTS idx_daily_month
  ON DailyRecords(substr(date, 1, 7));
