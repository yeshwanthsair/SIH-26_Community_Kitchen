'use strict';

/**
 * recordService.js
 * Business-logic layer between controllers and the model.
 * Handles duplicate-date detection, field defaults, and derived analytics.
 */

const model = require('../models/recordModel');

// ─── Records ──────────────────────────────────────────────────────────────────

function listRecords(query) {
  return model.findAll(query);
}

function getRecordById(id) {
  const record = model.findById(id);
  if (!record) {
    const err = new Error(`Record with id ${id} not found`);
    err.status = 404;
    throw err;
  }
  return record;
}

function createRecord(data) {
  // Duplicate date guard
  const existing = model.findByDate(data.date);
  if (existing) {
    const err = new Error(`A record for date ${data.date} already exists (id: ${existing.id})`);
    err.status = 409;
    throw err;
  }
  return model.create(data);
}

function updateRecord(id, data) {
  // Ensure record exists first
  model.findById(id); // throws via service if we call getRecordById — do it inline
  const existing = model.findById(id);
  if (!existing) {
    const err = new Error(`Record with id ${id} not found`);
    err.status = 404;
    throw err;
  }

  // If date is being changed, check the new date isn't already taken
  if (data.date && data.date !== existing.date) {
    const clash = model.findByDate(data.date);
    if (clash) {
      const err = new Error(`A record for date ${data.date} already exists (id: ${clash.id})`);
      err.status = 409;
      throw err;
    }
  }

  return model.update(id, data);
}

function deleteRecord(id) {
  const deleted = model.remove(id);
  if (!deleted) {
    const err = new Error(`Record with id ${id} not found`);
    err.status = 404;
    throw err;
  }
  return { id, deleted: true };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function getDashboardSummary() {
  const today    = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const overallSummary  = model.getAggregateSummary();
  const monthlySummary  = model.getAggregateSummary(thisMonth);
  const recentRecords   = model.findAll({ sort: 'date', order: 'DESC', limit: 7 }).data;
  const stockTrend      = model.getStockTrend(14);
  const statusBreakdown = model.getStatusBreakdown();
  const topDays         = model.getTopDays(5);

  // Latest record
  const latest = recentRecords[0] || null;

  return {
    today,
    latest_record:     latest,
    overall_summary:   overallSummary,
    this_month:        { month: thisMonth, ...monthlySummary },
    status_breakdown:  statusBreakdown,
    top_days:          topDays,
    stock_trend:       stockTrend,
    recent_records:    recentRecords,
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function getAnalytics(month) {
  const summary          = model.getAggregateSummary(month);
  const monthlyBreakdown = model.getMonthlyBreakdown();
  const weeklyBreakdown  = model.getWeeklyBreakdown(12);
  const yearlyBreakdown  = model.getYearlyBreakdown();
  const topDays          = model.getTopDays(10);
  const stockTrend       = model.getStockTrend(30);
  const stockAnalysis    = model.getStockAnalysis();
  const abnormalUsage    = model.getAbnormalUsage();
  const statusBreakdown  = model.getStatusBreakdown();

  return {
    filter:             month ? { month } : { scope: 'all-time' },
    summary,
    weekly_breakdown:   weeklyBreakdown,
    monthly_breakdown:  monthlyBreakdown,
    yearly_breakdown:   yearlyBreakdown,
    top_days:           topDays,
    stock_trend:        stockTrend,
    stock_analysis:     stockAnalysis,
    abnormal_usage:     abnormalUsage,
    status_breakdown:   statusBreakdown,
  };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw user message:
 *  1. Trim whitespace
 *  2. Lowercase
 *  3. Remove punctuation (keep alphanumeric + spaces)
 */
function normalizeMessage(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // remove punctuation
    .replace(/\s+/g, ' ')       // collapse multiple spaces
    .trim();
}

/**
 * Rule-based chat service backed by live DB queries.
 * Input is normalized before intent matching.
 *
 * Supported intents:
 *  meals_today      — meals served in the most recent record
 *  rice_stock       — current rice stock / stock balance
 *  average_meals    — average meals per operational day
 *  highest_meals    — peak / busiest day
 *  rice_usage       — total or average rice consumption
 *  cost             — average cost per meal
 *  low_stock        — low stock alert and threshold
 *  monthly_meals    — meals this month
 *  summary          — overall overview
 *  status_info      — holidays / closed days
 *  unknown          — "I don't know that yet."
 */
function processChat(message) {
  const raw = typeof message === 'string' ? message : '';
  const msg = normalizeMessage(raw);

  // ── intent: meals today (latest record) ────────────────────────
  if (/\bmeals?\s*(today|latest|last|recent|now)\b/.test(msg) ||
      /\b(today|latest|last|recent)\s*meals?\b/.test(msg) ||
      /\bhow many meals? (today|were served today|did we serve today)\b/.test(msg)) {
    const trend = model.getStockTrend(1);
    const latest = trend[0];
    if (latest) {
      return {
        intent: 'meals_today',
        answer: `The latest record (${latest.date}) shows ${Number(latest.meals_served).toLocaleString()} meals served.`,
        data:   { date: latest.date, meals_served: latest.meals_served },
      };
    }
  }

  // ── intent: rice stock / current stock balance ─────────────────
  if (/\brice\s*stock\b/.test(msg) ||
      /\b(current|available|remaining)\s*stock\b/.test(msg) ||
      /\bstock\s*(balance|remaining|left|level)\b/.test(msg) ||
      /\bhow much\s*(stock|rice)\s*(is\s*)?(left|remaining|available)\b/.test(msg)) {
    const trend  = model.getStockTrend(1);
    const latest = trend[0];
    if (latest) {
      const LOW = 50;
      const isLow = Number(latest.stock_balance) < LOW;
      return {
        intent: 'rice_stock',
        answer: `Current stock balance as of ${latest.date}: ${Number(latest.stock_balance).toFixed(2)} kg.` +
                (isLow ? ` ⚠️ This is below the low-stock threshold of ${LOW} kg.` : ''),
        data:   { date: latest.date, stock_balance: latest.stock_balance, low: isLow },
      };
    }
  }

  // ── intent: average meals ──────────────────────────────────────
  if (/\b(average|avg|mean)\s*meals?\b/.test(msg) ||
      /\bmeals?\s*(on average|per day|daily average)\b/.test(msg) ||
      /\bwhat\s*is\s*the\s*(average|avg)\b/.test(msg) && /\bmeals?\b/.test(msg)) {
    const s = model.getAggregateSummary();
    const opDays = Number(s.operational_days) || 1;
    const avg    = Number(s.total_meals) / opDays;
    return {
      intent: 'average_meals',
      answer: `Average meals served per operational day: ${avg.toFixed(1)} (${Number(s.total_meals).toLocaleString()} total meals over ${opDays} operational days).`,
      data:   { avg_meals_per_day: +avg.toFixed(1), total_meals: s.total_meals, operational_days: opDays },
    };
  }

  // ── intent: highest / peak meals ──────────────────────────────
  if (/\b(highest|most|peak|busiest|maximum|max|best)\s*meals?\b/.test(msg) ||
      /\bmeals?\s*(highest|most|peak|maximum|max)\b/.test(msg) ||
      /\b(busiest|peak|best)\s*day\b/.test(msg) ||
      /\bwhich\s*day\b/.test(msg) && /\bmost\b/.test(msg)) {
    const top = model.getTopDays(1);
    if (top[0]) {
      return {
        intent: 'highest_meals',
        answer: `The highest day was ${top[0].date} with ${Number(top[0].meals_served).toLocaleString()} meals served (cost: ₹${Number(top[0].cost_per_meal).toFixed(2)}/meal).`,
        data:   top[0],
      };
    }
  }

  // ── intent: rice usage ─────────────────────────────────────────
  if (/\brice\s*(usage|used|consumption|consumed|per meal|kg|total|overall|average|avg|today)\b/.test(msg) ||
      /\bhow\s*much\s*rice\b/.test(msg) ||
      /\btotal\s*rice\b/.test(msg)) {
    const s      = model.getAggregateSummary();
    const trend  = model.getStockTrend(1);
    const latest = trend[0];
    const opDays = Number(s.operational_days) || 1;
    const avgRice = Number(s.total_rice_kg) / opDays;
    return {
      intent: 'rice_usage',
      answer: `Total rice used across all records: ${Number(s.total_rice_kg).toFixed(2)} kg. ` +
              `Average per day: ${avgRice.toFixed(2)} kg.` +
              (latest ? ` Latest record (${latest.date}): the rice/meal ratio was recorded in the daily entry.` : ''),
      data:   { total_rice_kg: s.total_rice_kg, avg_rice_per_day: +avgRice.toFixed(2) },
    };
  }

  // ── intent: cost ───────────────────────────────────────────────
  if (/\b(cost|price|expense|expenditure)\b/.test(msg) ||
      /\bhow\s*much\s*(does|did|do)\s*it\s*cost\b/.test(msg) ||
      /\bcost\s*per\s*meal\b/.test(msg) ||
      /\bper\s*meal\s*cost\b/.test(msg)) {
    const s = model.getAggregateSummary();
    return {
      intent: 'cost',
      answer: `Average cost per meal: ₹${Number(s.avg_cost_per_meal).toFixed(2)}. ` +
              `Peak was on the busiest day.`,
      data:   { avg_cost_per_meal: s.avg_cost_per_meal },
    };
  }

  // ── intent: low stock ──────────────────────────────────────────
  if (/\b(low\s*stock|stock\s*low|stock\s*alert|running\s*low|restock|shortage)\b/.test(msg) ||
      /\b(is|are)\s*(the\s*)?stock\b/.test(msg) && /\blow\b/.test(msg)) {
    const sa = model.getStockAnalysis();
    const LOW = 50;
    const isLow = Number(sa.current_stock) < LOW;
    return {
      intent: 'low_stock',
      answer: isLow
        ? `⚠️ Yes, stock is currently LOW at ${Number(sa.current_stock).toFixed(2)} kg (threshold: ${LOW} kg). There have been ${sa.low_stock_days} low-stock day${sa.low_stock_days !== 1 ? 's' : ''} in total. Consider restocking.`
        : `Stock is currently adequate at ${Number(sa.current_stock).toFixed(2)} kg (threshold: ${LOW} kg). Total low-stock days on record: ${sa.low_stock_days}.`,
      data:   { current_stock: sa.current_stock, low_stock_days: sa.low_stock_days, threshold: LOW, is_low: isLow },
    };
  }

  // ── intent: meals this month ───────────────────────────────────
  if ((/\bthis\s*months?\b/.test(msg) || /\bcurrent\s*month\b/.test(msg)) && /\bmeals?\b/.test(msg)) {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const s = model.getAggregateSummary(month);
    return {
      intent: 'monthly_meals',
      answer: `This month (${month}) the kitchen has served ${Number(s.total_meals).toLocaleString()} meals across ${s.operational_days} operational days.`,
      data:   { month, ...s },
    };
  }

  // ── intent: total meals / overall meals served ─────────────────
  if (/\b(total|all\s*time|overall|ever)\s*meals?\b/.test(msg) ||
      /\bmeals?\s*(total|served|all\s*time|overall)\b/.test(msg) ||
      /\bhow\s*many\s*meals?\b/.test(msg)) {
    const s = model.getAggregateSummary();
    return {
      intent: 'total_meals',
      answer: `Total meals served across all records: ${Number(s.total_meals).toLocaleString()}.`,
      data:   { total_meals: s.total_meals },
    };
  }

  // ── intent: summary / overview ─────────────────────────────────
  if (/\b(summary|overview|dashboard|stats|statistics|report)\b/.test(msg) ||
      /\btell\s*me\s*(about|everything)\b/.test(msg)) {
    const s = model.getAggregateSummary();
    const opDays = Number(s.operational_days) || 1;
    const avg    = (Number(s.total_meals) / opDays).toFixed(1);
    return {
      intent: 'summary',
      answer: `Overall: ${Number(s.total_meals).toLocaleString()} meals served across ${opDays} operational days (avg ${avg}/day). ` +
              `Average cost: ₹${Number(s.avg_cost_per_meal).toFixed(2)}/meal.`,
      data:   s,
    };
  }

  // ── intent: holidays / closed days ────────────────────────────
  if (/\b(holiday|holidays|closed|closure|non.?operational)\b/.test(msg)) {
    const breakdown = model.getStatusBreakdown();
    const holidays  = breakdown.find(b => b.status === 'holiday') || { count: 0 };
    const closed    = breakdown.find(b => b.status === 'closed')  || { count: 0 };
    return {
      intent: 'status_info',
      answer: `There are ${holidays.count} holiday day${holidays.count !== 1 ? 's' : ''} and ${closed.count} closed day${closed.count !== 1 ? 's' : ''} in the records.`,
      data:   breakdown,
    };
  }

  // ── intent: unknown — required fallback ───────────────────────
  return {
    intent: 'unknown',
    answer: "I don't know that yet. Try asking: meals today, average meals, highest meals, rice usage, cost per meal, stock balance, low stock, or this month's meals.",
    data:   null,
  };
}

module.exports = {
  listRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getDashboardSummary,
  getAnalytics,
  processChat,
};
