'use strict';
const http = require('http');
let pass = 0, fail = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const d = body ? JSON.stringify(body) : null;
    const o = {
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    if (d) o.headers['Content-Length'] = Buffer.byteLength(d);
    const r = http.request(o, res => {
      let s = ''; res.on('data', c => s += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(s) }));
    });
    r.on('error', reject); if (d) r.write(d); r.end();
  });
}

function t(label, got, exp) {
  const ok = got === exp;
  console.log((ok ? '  PASS' : '  FAIL') + ' [' + got + '] ' + label + (ok ? '' : '  (exp ' + exp + ')'));
  ok ? pass++ : fail++;
}

function tContains(label, haystack, needle) {
  const ok = String(haystack).toLowerCase().includes(needle.toLowerCase());
  console.log((ok ? '  PASS' : '  FAIL') + ' ' + label + (ok ? '' : '  (missing: ' + needle + ')'));
  ok ? pass++ : fail++;
}

(async () => {
  console.log('\n=== Phase 8: Chat API ===');

  // Validation
  let r = await req('POST', '/api/chat', { message: '' });
  t('empty message → 400', r.status, 400);
  r = await req('POST', '/api/chat', {});
  t('missing message → 400', r.status, 400);
  r = await req('POST', '/api/chat', { message: 'x'.repeat(1001) });
  t('too long → 400', r.status, 400);

  // meals_today
  console.log('\n  --- meals_today ---');
  for (const msg of ['meals today', 'MEALS TODAY', 'Meals Today!', 'meals today?', 'how many meals today', 'what were the latest meals']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    tContains('intent contains meal: ' + msg, r.body.data?.intent, 'meal');
  }

  // rice_stock
  console.log('\n  --- rice_stock ---');
  for (const msg of ['rice stock', 'what is the current stock', 'How much stock is remaining?', 'stock balance', 'stock left']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    tContains('answer has kg: ' + msg, r.body.data?.answer, 'kg');
  }

  // average_meals
  console.log('\n  --- average_meals ---');
  for (const msg of ['average meals', 'avg meals', 'meals per day', 'daily average meals']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent average_meals: ' + msg, r.body.data?.intent, 'average_meals');
  }

  // highest_meals
  console.log('\n  --- highest_meals ---');
  for (const msg of ['highest meals', 'peak meals', 'busiest day', 'most meals served', 'maximum meals']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent highest_meals: ' + msg, r.body.data?.intent, 'highest_meals');
  }

  // rice_usage
  console.log('\n  --- rice_usage ---');
  for (const msg of ['rice usage', 'how much rice was used', 'rice consumption', 'rice consumed', 'total rice']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent rice_usage: ' + msg, r.body.data?.intent, 'rice_usage');
  }

  // cost
  console.log('\n  --- cost ---');
  for (const msg of ['cost per meal', 'average cost', 'what is the cost', 'how much does it cost', 'expense per meal']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent cost: ' + msg, r.body.data?.intent, 'cost');
  }

  // low_stock
  console.log('\n  --- low_stock ---');
  for (const msg of ['low stock', 'is stock running low', 'stock alert', 'running low', 'shortage', 'restock']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent low_stock: ' + msg, r.body.data?.intent, 'low_stock');
  }

  // monthly_meals
  console.log('\n  --- monthly_meals ---');
  for (const msg of ['how many meals this month', 'meals this month', 'current month meals', 'this months meals']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent monthly_meals: ' + msg, r.body.data?.intent, 'monthly_meals');
  }

  // normalisation — punctuation stripped
  console.log('\n  --- normalisation ---');
  for (const msg of ['Rice stock???', 'Rice, stock!', 'Rice-stock.', '...rice stock...', 'RICE   STOCK']) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200 normalised: ' + msg, r.status, 200);
    tContains('kg in answer: ' + msg, r.body.data?.answer, 'kg');
  }

  // unknown → required "I don't know" fallback
  console.log('\n  --- unknown ---');
  for (const msg of ["what is the weather", "who won the election", "make me a pizza", "abcdefgh xyz"]) {
    r = await req('POST', '/api/chat', { message: msg });
    t('200: ' + msg, r.status, 200);
    t('intent unknown: ' + msg, r.body.data?.intent, 'unknown');
    tContains('fallback text: ' + msg, r.body.data?.answer, "don't know");
  }

  console.log('\n=== RESULTS ===');
  console.log('  Passed : ' + pass);
  console.log('  Failed : ' + fail);
  console.log('  Total  : ' + (pass + fail));
  process.exit(fail > 0 ? 1 : 0);
})();
