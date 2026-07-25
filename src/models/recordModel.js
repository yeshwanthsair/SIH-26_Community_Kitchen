'use strict';

/**
 * recordModel.js
 * All SQL interactions with the DailyRecords table.
 *
 * sql.js is async to init but after the server boot (server.js awaits getDb())
 * the singleton is cached.  We call getDb() synchronously here knowing the
 * promise will resolve on the same tick.
 */

const { getDbSync, persistDb } = require('../config/database');

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a sql.js exec() result into an array of plain objects.
 */
function toObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    columns.reduce((obj, col, i) => { obj[col] = row[i]; return obj; }, {})
  );
}

/**
 * Execute a SELECT and return rows as plain objects.
 */
function query(sql, params = []) {
  const result = getDbSync().exec(sql, params);
  return toObjects(result);
}

/**
 * Execute an INSERT / UPDATE / DELETE and persist to disk.
 */
function run(sql, params = []) {
  getDbSync().run(sql, params);
  persistDb();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function findById(id) {
  const rows = query('SELECT * FROM DailyRecords WHERE id = ?', [id]);
  return rows[0] || null;
}

function findByDate(date) {
  const rows = query('SELECT * FROM DailyRecords WHERE date = ?', [date]);
  return rows[0] || null;
}

/**
 * List records with optional filters and pagination.
 *
 * @param {object} opts
 * @param {string}  [opts.date]
 * @param {string}  [opts.month]   YYYY-MM
 * @param {string}  [opts.status]  open | closed | holiday
 * @param {string}  [opts.sort]    column name (default: date)
 * @param {string}  [opts.order]   ASC | DESC (default: DESC)
 * @param {number}  [opts.page]    1-based (default: 1)
 * @param {number}  [opts.limit]   rows per page (default: 20, max: 200)
 */
function findAll({ date, month, status, sort = 'date', order = 'DESC', page = 1, limit = 20 } = {}) {
  const ALLOWED_SORTS = ['id', 'date', 'meals_served', 'stock_balance', 'cost_per_meal', 'created_at'];
  const safeSort      = ALLOWED_SORTS.includes(sort) ? sort : 'date';
  const safeOrder     = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const safePage      = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit     = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
  const offset        = (safePage - 1) * safeLimit;

  const conditions = [];
  const params     = [];

  if (date)   { conditions.push('date = ?');                params.push(date);   }
  if (month)  { conditions.push("substr(date,1,7) = ?");   params.push(month);  }
  if (status) { conditions.push('status = ?');              params.push(status); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRows = query(`SELECT COUNT(*) AS total FROM DailyRecords ${where}`, params);
  const total     = countRows[0]?.total ?? 0;

  const rows = query(
    `SELECT * FROM DailyRecords ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    data: rows,
    pagination: {
      total,
      page:       safePage,
      limit:      safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

function create({ date, meals_served, rice_kg, dal_kg, vegetables_kg, stock_balance, cost_per_meal, rice_per_meal, status }) {
  run(
    `INSERT INTO DailyRecords
       (date, meals_served, rice_kg, dal_kg, vegetables_kg, stock_balance, cost_per_meal, rice_per_meal, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date, meals_served, rice_kg, dal_kg, vegetables_kg, stock_balance, cost_per_meal, rice_per_meal, status]
  );
  return findByDate(date);
}

function update(id, fields) {
  const ALLOWED    = ['date', 'meals_served', 'rice_kg', 'dal_kg', 'vegetables_kg',
                      'stock_balance', 'cost_per_meal', 'rice_per_meal', 'status'];
  const setClauses = [];
  const params     = [];

  for (const key of ALLOWED) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return findById(id);

  params.push(id);
  run(`UPDATE DailyRecords SET ${setClauses.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

function remove(id) {
  if (!findById(id)) return false;
  run('DELETE FROM DailyRecords WHERE id = ?', [id]);
  return true;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function getAggregateSummary(month) {
  const where  = month ? "WHERE substr(date,1,7) = ?" : '';
  const params = month ? [month] : [];
  const rows = query(
    `SELECT
       COUNT(*)                                                             AS total_days,
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)                      AS operational_days,
       COALESCE(SUM(meals_served), 0)                                       AS total_meals,
       COALESCE(SUM(rice_kg), 0)                                            AS total_rice_kg,
       COALESCE(SUM(dal_kg), 0)                                             AS total_dal_kg,
       COALESCE(SUM(vegetables_kg), 0)                                      AS total_vegetables_kg,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN cost_per_meal END), 0)  AS avg_cost_per_meal,
       COALESCE(MAX(meals_served), 0)                                       AS max_meals_in_day,
       COALESCE(MIN(CASE WHEN meals_served > 0 THEN meals_served END), 0)   AS min_meals_in_day
     FROM DailyRecords ${where}`,
    params
  );
  return rows[0] || {};
}

function getMonthlyBreakdown() {
  return query(
    `SELECT
       substr(date,1,7)                                                     AS month,
       COUNT(*)                                                             AS total_days,
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)                      AS operational_days,
       COALESCE(SUM(meals_served), 0)                                       AS total_meals,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN meals_served END), 0)   AS avg_meals,
       COALESCE(SUM(rice_kg), 0)                                            AS total_rice_kg,
       COALESCE(SUM(dal_kg), 0)                                             AS total_dal_kg,
       COALESCE(SUM(vegetables_kg), 0)                                      AS total_vegetables_kg,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN cost_per_meal END), 0)  AS avg_cost_per_meal,
       COALESCE(MAX(meals_served), 0)                                       AS max_meals,
       COALESCE(MIN(CASE WHEN meals_served > 0 THEN meals_served END), 0)   AS min_meals
     FROM DailyRecords
     GROUP BY substr(date,1,7)
     ORDER BY month ASC`
  );
}

/**
 * Weekly breakdown — group by ISO year-week (YYYY-WW).
 * Returns last N weeks ordered oldest-first.
 */
function getWeeklyBreakdown(n = 12) {
  // SQLite doesn't have a native ISO week function; compute week number via strftime %W (Mon start).
  return query(
    `SELECT
       strftime('%Y', date) || '-W' || printf('%02d', strftime('%W', date)) AS week,
       COUNT(*)                                                              AS total_days,
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)                       AS operational_days,
       COALESCE(SUM(meals_served), 0)                                        AS total_meals,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN meals_served END), 0)    AS avg_meals,
       COALESCE(SUM(rice_kg), 0)                                             AS total_rice_kg,
       COALESCE(SUM(dal_kg), 0)                                              AS total_dal_kg,
       COALESCE(SUM(vegetables_kg), 0)                                       AS total_vegetables_kg,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN cost_per_meal END), 0)   AS avg_cost_per_meal
     FROM DailyRecords
     GROUP BY week
     ORDER BY week DESC
     LIMIT ?`,
    [n]
  ).reverse(); // oldest-first for charts
}

/**
 * Yearly breakdown.
 */
function getYearlyBreakdown() {
  return query(
    `SELECT
       strftime('%Y', date)                                                  AS year,
       COUNT(*)                                                              AS total_days,
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)                       AS operational_days,
       COALESCE(SUM(meals_served), 0)                                        AS total_meals,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN meals_served END), 0)    AS avg_meals,
       COALESCE(SUM(rice_kg), 0)                                             AS total_rice_kg,
       COALESCE(SUM(dal_kg), 0)                                              AS total_dal_kg,
       COALESCE(SUM(vegetables_kg), 0)                                       AS total_vegetables_kg,
       COALESCE(AVG(CASE WHEN meals_served > 0 THEN cost_per_meal END), 0)   AS avg_cost_per_meal,
       COALESCE(MAX(meals_served), 0)                                        AS max_meals,
       COALESCE(MIN(CASE WHEN meals_served > 0 THEN meals_served END), 0)    AS min_meals,
       COALESCE(SUM(meals_served * cost_per_meal), 0)                        AS total_cost
     FROM DailyRecords
     GROUP BY year
     ORDER BY year ASC`
  );
}

/**
 * Stock analysis — expected vs actual, low-stock days.
 * Expected stock = previous stock_balance - (rice_kg + dal_kg + vegetables_kg).
 * We join each row with the previous row's stock_balance.
 *
 * Low stock threshold: 50 kg.
 */
function getStockAnalysis() {
  const LOW_THRESHOLD = 50;

  const rows = query(
    `SELECT
       id, date, status, meals_served,
       rice_kg, dal_kg, vegetables_kg,
       stock_balance,
       rice_kg + dal_kg + vegetables_kg AS total_used,
       LAG(stock_balance) OVER (ORDER BY date) AS prev_stock
     FROM DailyRecords
     ORDER BY date ASC`
  );

  const lowStock = rows.filter(r => r.stock_balance < LOW_THRESHOLD && r.status === 'open');

  // Expected stock = prev_stock - total_used; variance = actual - expected
  const variance = rows
    .filter(r => r.prev_stock !== null && r.status === 'open')
    .map(r => {
      const expected = Number(r.prev_stock) - Number(r.total_used);
      const actual   = Number(r.stock_balance);
      const diff     = actual - expected;
      return { date: r.date, expected: +expected.toFixed(2), actual: +actual.toFixed(2), variance: +diff.toFixed(2) };
    });

  // Current stock = most recent record's stock_balance
  const latest = query('SELECT stock_balance, date FROM DailyRecords ORDER BY date DESC LIMIT 1')[0] || {};

  return {
    current_stock:      latest.stock_balance ?? 0,
    current_stock_date: latest.date ?? null,
    low_stock_threshold: LOW_THRESHOLD,
    low_stock_days:     lowStock.length,
    low_stock_records:  lowStock.slice(0, 10), // last 10 low-stock days
    stock_variance:     variance.slice(-30),   // last 30 with variance
  };
}

/**
 * Abnormal usage detection.
 * Flags days where:
 *   - meals_served > avg + 2*stdev  (unusually high)
 *   - rice_per_meal > avg + 2*stdev (over-consumption of rice)
 *   - cost_per_meal > avg + 2*stdev (abnormally high cost)
 */
function getAbnormalUsage() {
  // Compute global stats
  const stats = query(
    `SELECT
       AVG(meals_served)                    AS avg_meals,
       AVG(rice_per_meal)                   AS avg_rpm,
       AVG(cost_per_meal)                   AS avg_cost,
       -- standard deviations via variance
       SQRT(AVG(meals_served * meals_served) - AVG(meals_served) * AVG(meals_served))    AS sd_meals,
       SQRT(AVG(rice_per_meal * rice_per_meal) - AVG(rice_per_meal) * AVG(rice_per_meal)) AS sd_rpm,
       SQRT(AVG(cost_per_meal * cost_per_meal) - AVG(cost_per_meal) * AVG(cost_per_meal)) AS sd_cost
     FROM DailyRecords
     WHERE status = 'open' AND meals_served > 0`
  )[0] || {};

  const avM  = Number(stats.avg_meals  || 0);
  const avR  = Number(stats.avg_rpm    || 0);
  const avC  = Number(stats.avg_cost   || 0);
  const sdM  = Number(stats.sd_meals   || 0);
  const sdR  = Number(stats.sd_rpm     || 0);
  const sdC  = Number(stats.sd_cost    || 0);

  const SIGMA = 2;

  // Fetch all open days
  const rows = query(
    `SELECT id, date, meals_served, rice_per_meal, cost_per_meal, rice_kg, dal_kg, vegetables_kg
     FROM DailyRecords
     WHERE status = 'open' AND meals_served > 0
     ORDER BY date DESC`
  );

  const flagged = rows
    .map(r => {
      const flags = [];
      if (sdM > 0 && r.meals_served > avM + SIGMA * sdM)   flags.push({ type: 'high_meals',    value: r.meals_served,   avg: +avM.toFixed(1), threshold: +(avM + SIGMA * sdM).toFixed(1) });
      if (sdR > 0 && r.rice_per_meal > avR + SIGMA * sdR)  flags.push({ type: 'high_rice_pm',  value: r.rice_per_meal,  avg: +avR.toFixed(4), threshold: +(avR + SIGMA * sdR).toFixed(4) });
      if (sdC > 0 && r.cost_per_meal > avC + SIGMA * sdC)  flags.push({ type: 'high_cost_pm',  value: r.cost_per_meal,  avg: +avC.toFixed(2), threshold: +(avC + SIGMA * sdC).toFixed(2) });
      return flags.length ? { date: r.date, flags } : null;
    })
    .filter(Boolean);

  return {
    thresholds: {
      meals_served:  { avg: +avM.toFixed(1), stdev: +sdM.toFixed(1), limit: +(avM + SIGMA * sdM).toFixed(1) },
      rice_per_meal: { avg: +avR.toFixed(4), stdev: +sdR.toFixed(4), limit: +(avR + SIGMA * sdR).toFixed(4) },
      cost_per_meal: { avg: +avC.toFixed(2), stdev: +sdC.toFixed(2), limit: +(avC + SIGMA * sdC).toFixed(2) },
    },
    flagged_count: flagged.length,
    flagged:       flagged.slice(0, 20),
  };
}

function getTopDays(n = 5) {
  return query(
    `SELECT date, meals_served, cost_per_meal, status
     FROM DailyRecords
     WHERE status = 'open'
     ORDER BY meals_served DESC
     LIMIT ?`,
    [n]
  );
}

function getStockTrend(n = 30) {
  return query(
    `SELECT date, stock_balance, meals_served, status
     FROM DailyRecords
     ORDER BY date DESC
     LIMIT ?`,
    [n]
  );
}

function getStatusBreakdown() {
  return query(
    `SELECT status, COUNT(*) AS count
     FROM DailyRecords
     GROUP BY status`
  );
}

module.exports = {
  findById,
  findByDate,
  findAll,
  create,
  update,
  remove,
  getAggregateSummary,
  getMonthlyBreakdown,
  getWeeklyBreakdown,
  getYearlyBreakdown,
  getStockAnalysis,
  getAbnormalUsage,
  getTopDays,
  getStockTrend,
  getStatusBreakdown,
};
