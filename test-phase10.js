'use strict';

/**
 * Phase 10 regression checks not covered by the existing API/chat suites.
 * Run with: BASE_URL=http://localhost:3001 node test-phase10.js
 */
const fs = require('fs');
const http = require('http');
const initSqlJs = require('sql.js');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function check(label, expectedStatus, method, path, body, assertion = () => true) {
  try {
    const response = await request(method, path, body);
    const ok = response.status === expectedStatus && assertion(response.body);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} [${response.status}] ${label}`);
    if (ok) passed++; else failed++;
  } catch (error) {
    console.log(`  FAIL [ERR] ${label}: ${error.message}`);
    failed++;
  }
}

async function checkDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('./database/kitchen.db'));
  const integrity = db.exec('PRAGMA integrity_check;')[0]?.values?.[0]?.[0];
  const indexes = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='DailyRecords';")[0]?.values?.map(row => row[0]) || [];
  const ok = integrity === 'ok' && ['idx_daily_date', 'idx_daily_status', 'idx_daily_month'].every(name => indexes.includes(name));
  console.log(`  ${ok ? 'PASS' : 'FAIL'} database integrity and DailyRecords indexes`);
  if (ok) passed++; else failed++;
  db.close();
}

(async () => {
  console.log('\n=== Phase 10 targeted regression suite ===');
  await check('dashboard response contains core sections', 200, 'GET', '/api/dashboard', undefined, body =>
    body.success && ['today', 'overall_summary', 'recent_records', 'stock_trend'].every(key => key in body.data));
  await check('rejects impossible calendar date', 400, 'POST', '/api/records', {
    date: '2024-02-31', meals_served: 1, rice_kg: 0, dal_kg: 0, vegetables_kg: 0,
    stock_balance: 0, cost_per_meal: 0, rice_per_meal: 0, status: 'open',
  });
  await check('rejects invalid month number', 400, 'GET', '/api/records?month=2024-13');
  await check('rejects partial page number', 400, 'GET', '/api/records?page=1abc');
  await check('rejects partial limit number', 400, 'GET', '/api/records?limit=20rows');
  await check('rejects partial record id', 400, 'PUT', '/api/records/1abc', { meals_served: 1 });
  await check('analytics exposes all expected datasets', 200, 'GET', '/api/analytics', undefined, body =>
    body.success && ['summary', 'weekly_breakdown', 'monthly_breakdown', 'yearly_breakdown', 'stock_analysis', 'abnormal_usage'].every(key => key in body.data));
  await check('analytics rejects invalid month number', 400, 'GET', '/api/analytics?month=2024-13');
  await check('chatbot normalizes punctuation', 200, 'POST', '/api/chat', { message: 'Rice, stock?!' }, body =>
    body.success && body.data.intent === 'rice_stock');
  await check('chatbot unknown fallback remains deterministic', 200, 'POST', '/api/chat', { message: 'What is the weather on Mars?' }, body =>
    body.success && body.data.intent === 'unknown' && /don't know/i.test(body.data.answer));
  await checkDatabase();

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exitCode = failed ? 1 : 0;
})();
