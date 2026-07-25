# Database Guide

## Engine and Location

Community Kitchen uses SQLite through `sql.js`. By default, the database file is stored at `database/kitchen.db` and is controlled by the `DB_PATH` environment variable.

The application loads the file into the `sql.js` in-memory database at startup and flushes the exported SQLite bytes after each write operation. This keeps a simple file-backed deployment model while retaining the familiar SQLite schema and query behavior.

## Schema

### `DailyRecords`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary key, autoincrement | Record identifier |
| `date` | TEXT | Required, unique | ISO date (`YYYY-MM-DD`) |
| `meals_served` | INTEGER | Required, default `0` | Meals distributed that day |
| `rice_kg` | REAL | Required, default `0` | Rice consumed in kilograms |
| `dal_kg` | REAL | Required, default `0` | Dal consumed in kilograms |
| `vegetables_kg` | REAL | Required, default `0` | Vegetables consumed in kilograms |
| `stock_balance` | REAL | Required, default `0` | Stock remaining after the day |
| `cost_per_meal` | REAL | Required, default `0` | Average meal cost |
| `rice_per_meal` | REAL | Required, default `0` | Rice use per meal |
| `status` | TEXT | Required, checked | `open`, `closed`, or `holiday` |
| `created_at` | TEXT | Required, generated | UTC creation timestamp |

The unique `date` constraint prevents more than one daily record for the same calendar date.

## Indexes

| Index | Purpose |
|---|---|
| `idx_daily_date` | Fast date lookup and ordered history |
| `idx_daily_status` | Fast status filtering |
| `idx_daily_month` | Faster monthly aggregation using `substr(date, 1, 7)` |

## Data Validation

Server validation supplements database constraints:

- Dates must use `YYYY-MM-DD` and represent a real calendar day.
- Numeric operational values must be non-negative.
- Meals must be a non-negative integer.
- Status must be one of the three allowed values.
- Date updates cannot collide with an existing record.

## Initialization and Seed Data

```bash
npm run db:init
npm run db:seed
```

Schema initialization is idempotent. The seeder creates realistic sample records for dashboard and analytics exploration.

## Backup and Restore

Stop the server before copying the database file to ensure no write is in progress.

```bash
# Backup
copy database\kitchen.db backups\kitchen-YYYY-MM-DD.db

# Restore
copy backups\kitchen-YYYY-MM-DD.db database\kitchen.db
```

For production use, schedule backups outside the application process and retain multiple dated copies.

## Integrity Check

Run SQLite's integrity check through a compatible SQLite tool, or use the Phase 10 suite:

```bash
npm run test:phase10
```

The test suite verifies `PRAGMA integrity_check` and confirms the required `DailyRecords` indexes are present.
