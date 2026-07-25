'use strict';
/**
 * API test runner — uses Node's built-in http module.
 * No external deps required.
 */

const http = require('http');

const BASE = 'http://localhost:3000/api';
let passed = 0, failed = 0;

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || 80,
      path:     parsed.pathname + parsed.search,
      method,
      headers:  { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function test(label, method, url, body, expectStatus = 200) {
  try {
    const res = await request(method, url, body);
    const ok  = res.status === expectStatus;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}${ok ? '' : `  (expected ${expectStatus})`}`);
    if (!ok) {
      console.log(`       body: ${JSON.stringify(res.body).slice(0, 200)}`);
      failed++;
    } else {
      passed++;
    }
    return res;
  } catch (err) {
    console.log(`  FAIL [ERR] ${label}: ${err.message}`);
    failed++;
    return null;
  }
}

(async () => {
  let res, createdId;

  // ─── Dashboard ───────────────────────────────────────────────────────────
  console.log('\n=== GET /api/dashboard ===');
  res = await test('returns success with data keys', 'GET', `${BASE}/dashboard`);
  if (res) {
    const keys = Object.keys(res.body?.data || {});
    console.log(`       Keys: ${keys.join(', ')}`);
  }

  // ─── Records: list ───────────────────────────────────────────────────────
  console.log('\n=== GET /api/records ===');
  await test('list all (default page)',         'GET', `${BASE}/records`);
  await test('filter by month 2024-01',         'GET', `${BASE}/records?month=2024-01&limit=5`);
  await test('filter by status=open',           'GET', `${BASE}/records?status=open&page=1&limit=3`);
  await test('sort by date ASC',                'GET', `${BASE}/records?sort=date&order=ASC&limit=3`);
  await test('bad status → 400',                'GET', `${BASE}/records?status=invalid`,          null, 400);
  await test('bad date → 400',                  'GET', `${BASE}/records?date=not-a-date`,         null, 400);
  await test('page=0 → 400',                    'GET', `${BASE}/records?page=0`,                  null, 400);
  await test('limit=300 → 400',                 'GET', `${BASE}/records?limit=300`,               null, 400);

  // ─── Records: create ─────────────────────────────────────────────────────
  console.log('\n=== POST /api/records ===');
  const newRec = {
    date: '2025-06-15', meals_served: 250, rice_kg: 32.5, dal_kg: 13.0,
    vegetables_kg: 22.0, stock_balance: 180.0, cost_per_meal: 22.5,
    rice_per_meal: 0.130, status: 'open',
  };
  res = await test('create new record → 201',     'POST', `${BASE}/records`, newRec, 201);
  createdId = res?.body?.data?.id;
  console.log(`       Created id: ${createdId}`);

  await test('duplicate date → 409',            'POST', `${BASE}/records`, newRec, 409);
  await test('missing fields → 400',            'POST', `${BASE}/records`, { date: '2025-07-01' }, 400);
  await test('invalid status → 400',            'POST', `${BASE}/records`, { ...newRec, date: '2025-07-02', status: 'wrong' }, 400);
  await test('negative meals → 400',            'POST', `${BASE}/records`, { ...newRec, date: '2025-07-03', meals_served: -1 }, 400);
  await test('invalid date format → 400',       'POST', `${BASE}/records`, { ...newRec, date: '15-06-2025' }, 400);

  // ─── Records: update ─────────────────────────────────────────────────────
  console.log('\n=== PUT /api/records/:id ===');
  if (createdId) {
    await test('update meals_served',           'PUT',  `${BASE}/records/${createdId}`, { meals_served: 260 });
    await test('update status→closed',          'PUT',  `${BASE}/records/${createdId}`, { status: 'closed' });
    await test('update multiple fields',        'PUT',  `${BASE}/records/${createdId}`, { meals_served: 270, rice_kg: 34.0 });
    await test('record not found → 404',        'PUT',  `${BASE}/records/99999`,        { meals_served: 10 }, 404);
    await test('empty body → 400',             'PUT',  `${BASE}/records/${createdId}`, {}, 400);
    await test('invalid status field → 400',   'PUT',  `${BASE}/records/${createdId}`, { status: 'bad' }, 400);
  } else {
    console.log('  SKIP  (no created id)');
  }
  await test('non-numeric id → 400',            'PUT',  `${BASE}/records/abc`,          { meals_served: 10 }, 400);

  // ─── Records: delete ─────────────────────────────────────────────────────
  console.log('\n=== DELETE /api/records/:id ===');
  if (createdId) {
    await test('delete created record',         'DELETE', `${BASE}/records/${createdId}`);
    await test('delete again → 404',            'DELETE', `${BASE}/records/${createdId}`,  null, 404);
  }
  await test('delete nonexistent → 404',        'DELETE', `${BASE}/records/99999`,         null, 404);
  await test('non-numeric id → 400',            'DELETE', `${BASE}/records/abc`,           null, 400);

  // ─── Analytics ───────────────────────────────────────────────────────────
  console.log('\n=== GET /api/analytics ===');
  res = await test('all-time analytics',        'GET', `${BASE}/analytics`);
  if (res) console.log(`       Keys: ${Object.keys(res.body?.data || {}).join(', ')}`);
  await test('filter by month 2024-01',         'GET', `${BASE}/analytics?month=2024-01`);
  await test('bad month YYYY-M → 400',          'GET', `${BASE}/analytics?month=2024-1`,  null, 400);
  await test('bad month string → 400',          'GET', `${BASE}/analytics?month=jan`,     null, 400);

  // ─── Chat ────────────────────────────────────────────────────────────────
  console.log('\n=== POST /api/chat ===');
  const chatTests = [
    ['total meals intent',       'How many total meals were served?'],
    ['this month meals intent',  'How many meals this month?'],
    ['stock balance intent',     'What is the current stock balance?'],
    ['busiest day intent',       'Which was the busiest day?'],
    ['avg cost intent',          'What is the average cost per meal?'],
    ['summary intent',           'Give me a summary overview'],
    ['holiday info intent',      'How many holiday days are there?'],
    ['unknown → fallback',       'What is the weather today?'],
  ];
  for (const [label, message] of chatTests) {
    res = await test(label, 'POST', `${BASE}/chat`, { message });
    if (res?.body?.data) console.log(`       intent: ${res.body.data.intent}`);
  }
  await test('empty message → 400',   'POST', `${BASE}/chat`, { message: '' }, 400);
  await test('missing message → 400', 'POST', `${BASE}/chat`, {}, 400);
  await test('message too long → 400','POST', `${BASE}/chat`, { message: 'x'.repeat(1001) }, 400);

  // ─── 404 ─────────────────────────────────────────────────────────────────
  console.log('\n=== 404 for unknown API routes ===');
  await test('unknown route → 404',   'GET',  `${BASE}/unknown-endpoint`, null, 404);
  await test('unknown POST → 404',    'POST', `${BASE}/nonexistent`,      {},   404);

  // ─── Results ─────────────────────────────────────────────────────────────
  console.log('\n=== RESULTS ===');
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);
  console.log(`  Total  : ${passed + failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
