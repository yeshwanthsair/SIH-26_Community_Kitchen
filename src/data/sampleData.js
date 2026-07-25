'use strict';

/**
 * Generates an array of 100 realistic DailyRecord objects.
 *
 * Assumptions (based on a mid-sized community kitchen):
 *  - Operating window : Jan 2024 – Apr 2024  (100 consecutive days, no gaps)
 *  - Meals served     : 180 – 320 per day    (slightly higher on weekends)
 *  - Rice             : 0.120 – 0.140 kg per meal served
 *  - Dal              : 0.045 – 0.060 kg per meal served
 *  - Vegetables       : 0.080 – 0.110 kg per meal served
 *  - Stock balance    : running total carried forward, replenished randomly
 *  - Cost per meal    : 18 – 28 INR
 *  - Status           : ~90 % open, ~5 % closed (Sunday), ~5 % holiday
 */

function generateSampleData() {
  const START_DATE = new Date('2024-01-01');
  const records    = [];

  // Fixed holidays in the window (YYYY-MM-DD)
  const HOLIDAYS = new Set([
    '2024-01-26', // Republic Day
    '2024-03-25', // Holi
    '2024-03-29', // Good Friday
  ]);

  let stockBalance = 250; // starting stock in kg

  for (let i = 0; i < 100; i++) {
    const dateObj = new Date(START_DATE);
    dateObj.setDate(START_DATE.getDate() + i);
    const date    = dateObj.toISOString().slice(0, 10);
    const dow     = dateObj.getDay(); // 0=Sun

    // Determine status
    let status;
    if (HOLIDAYS.has(date))  status = 'holiday';
    else if (dow === 0)       status = 'closed';
    else                      status = 'open';

    // On non-operational days no meals are served
    if (status !== 'open') {
      records.push({
        date,
        meals_served  : 0,
        rice_kg       : 0,
        dal_kg        : 0,
        vegetables_kg : 0,
        stock_balance : parseFloat(stockBalance.toFixed(2)),
        cost_per_meal : 0,
        rice_per_meal : 0,
        status,
      });
      continue;
    }

    // Weekday vs weekend meal volume
    const isWeekend   = dow === 6; // Saturday
    const baseMin     = isWeekend ? 220 : 180;
    const baseMax     = isWeekend ? 320 : 280;
    const meals       = randInt(baseMin, baseMax);

    // Per-meal ingredient ratios (kg)
    const riceRatio   = randFloat(0.120, 0.140);
    const dalRatio    = randFloat(0.045, 0.060);
    const vegRatio    = randFloat(0.080, 0.110);

    const rice_kg       = parseFloat((meals * riceRatio).toFixed(2));
    const dal_kg        = parseFloat((meals * dalRatio).toFixed(2));
    const vegetables_kg = parseFloat((meals * vegRatio).toFixed(2));
    const totalUsed     = rice_kg + dal_kg + vegetables_kg;

    // Random stock replenishment every ~10 days
    if (i % 10 === 0) stockBalance += randFloat(80, 150);

    stockBalance = Math.max(0, stockBalance - totalUsed);
    const cost_per_meal = parseFloat(randFloat(18, 28).toFixed(2));

    records.push({
      date,
      meals_served  : meals,
      rice_kg,
      dal_kg,
      vegetables_kg,
      stock_balance : parseFloat(stockBalance.toFixed(2)),
      cost_per_meal,
      rice_per_meal : parseFloat(riceRatio.toFixed(4)),
      status,
    });
  }

  return records;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

module.exports = { generateSampleData };
