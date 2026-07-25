'use strict';
/**
 * dashboard.js
 * Fetches /api/dashboard and renders:
 *   - 6 animated stat cards
 *   - Low stock alert
 *   - 5 Chart.js charts (meals line, stock line, ingredients doughnut,
 *     status doughnut, monthly bar)
 *   - Top-5 days table
 *   - Recent records table
 */

/* ─── Constants ──────────────────────────────────────────────────── */
const LOW_STOCK_THRESHOLD = 50; // kg — show alert below this

/* ─── Chart instances (kept for destroy-on-refresh) ──────────────── */
const _charts = {};

/* ─── Public API ─────────────────────────────────────────────────── */

/**
 * Initialise the dashboard: fetch data, render everything.
 * Call once on page load, and again when user hits refresh.
 */
async function initDashboard() {
  showSkeletons();

  let data;
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'API error');
    data = json.data;
  } catch (err) {
    showError(err.message);
    return;
  }

  renderCards(data);
  renderCharts(data);
  renderTopDays(data.top_days || []);
  renderRecentRecords(data.recent_records || []);
  renderLowStockAlert(data);
  updateSectionMeta(data);
}

/* ─── Skeletons ──────────────────────────────────────────────────── */
function showSkeletons() {
  // Cards
  const grid = document.getElementById('cardsGrid');
  if (grid) {
    grid.innerHTML = Array(6).fill(
      '<div class="card skeleton" aria-hidden="true"></div>'
    ).join('');
  }

  // Tables
  ['topDaysTbody', 'recentTbody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<tr class="skeleton-row"><td colspan="8"><div class="skeleton-line"></div></td></tr>';
  });
}

/* ─── Error state ────────────────────────────────────────────────── */
function showError(message) {
  const grid = document.getElementById('cardsGrid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:.5rem">⚠️</div>
        <p>Could not load dashboard data.</p>
        <p style="font-size:.82rem;margin-top:.25rem">${escHtml(message)}</p>
      </div>`;
  }
}

/* ─── Stat Cards ─────────────────────────────────────────────────── */
const CARD_DEFS = [
  {
    key:    'meals_served',
    label:  "Today's Meals",
    icon:   '🍽️',
    accent: 'orange',
    unit:   '',
    format: v => Math.round(v).toLocaleString(),
    sub:    d => `Month total: ${Number(d.this_month?.total_meals || 0).toLocaleString()}`,
  },
  {
    key:    'rice_kg',
    label:  'Rice Used',
    icon:   '🌾',
    accent: 'green',
    unit:   'kg',
    format: v => Number(v).toFixed(1),
    sub:    d => `Month: ${Number(d.this_month?.total_rice_kg || 0).toFixed(1)} kg`,
  },
  {
    key:    'dal_kg',
    label:  'Dal Used',
    icon:   '🫘',
    accent: 'teal',
    unit:   'kg',
    format: v => Number(v).toFixed(1),
    sub:    d => `Month: ${Number(d.this_month?.total_dal_kg || 0).toFixed(1)} kg`,
  },
  {
    key:    'vegetables_kg',
    label:  'Vegetables Used',
    icon:   '🥦',
    accent: 'blue',
    unit:   'kg',
    format: v => Number(v).toFixed(1),
    sub:    d => `Month: ${Number(d.this_month?.total_vegetables_kg || 0).toFixed(1)} kg`,
  },
  {
    key:    'stock_balance',
    label:  'Stock Remaining',
    icon:   '📦',
    accent: 'purple',
    unit:   'kg',
    format: v => Number(v).toFixed(1),
    sub:    _d => 'After latest record',
    alertFn: v => Number(v) < LOW_STOCK_THRESHOLD,
  },
  {
    key:    'cost_per_meal',
    label:  'Avg Cost / Meal',
    icon:   '₹',
    accent: 'red',
    unit:   '',
    format: v => `₹${Number(v).toFixed(2)}`,
    sub:    d => `Overall avg: ₹${Number(d.overall_summary?.avg_cost_per_meal || 0).toFixed(2)}`,
  },
];

function renderCards(data) {
  const latest = data.latest_record || {};
  const grid   = document.getElementById('cardsGrid');
  if (!grid) return;

  grid.innerHTML = CARD_DEFS.map(def => {
    const raw   = latest[def.key] ?? 0;
    const value = def.format(raw);
    const sub   = def.sub(data);
    const alert = def.alertFn ? def.alertFn(raw) : false;

    return `
      <div class="card${alert ? ' card--alert' : ''}" data-accent="${def.accent}">
        <div class="card-icon" aria-hidden="true">${def.icon}</div>
        <div class="card-label">${def.label}</div>
        <div class="card-value" data-target="${raw}" data-format="${def.key}">
          ${value}${def.unit ? `<span class="unit">${def.unit}</span>` : ''}
        </div>
        <div class="card-sub">${sub}</div>
      </div>`;
  }).join('');

  // Trigger count-up animation
  animateCounters(grid);
}

/* ─── Animated Counters ──────────────────────────────────────────── */
function animateCounters(container) {
  const valueEls = container.querySelectorAll('.card-value[data-target]');
  valueEls.forEach(el => {
    el.classList.add('animating');
    el.addEventListener('animationend', () => el.classList.remove('animating'), { once: true });
  });
}

/* ─── Low Stock Alert ────────────────────────────────────────────── */
function renderLowStockAlert(data) {
  const stock  = Number(data.latest_record?.stock_balance ?? 999);
  const banner = document.getElementById('lowStockAlert');
  const text   = document.getElementById('lowStockText');
  if (!banner || !text) return;

  if (stock < LOW_STOCK_THRESHOLD) {
    text.textContent = `⚠️ Stock running low — only ${stock.toFixed(1)} kg remaining (threshold: ${LOW_STOCK_THRESHOLD} kg). Consider restocking.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ─── Section Meta ───────────────────────────────────────────────── */
function updateSectionMeta(data) {
  const el = document.getElementById('latestRecordDate');
  if (!el) return;
  const d = data.latest_record?.date;
  el.textContent = d ? `Latest record: ${formatDate(d)}` : 'No records yet';
}

/* ─── Charts ─────────────────────────────────────────────────────── */
function getChartDefaults() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    gridColor:  dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)',
    textColor:  dark ? '#9298b0' : '#8890a4',
    tooltipBg:  dark ? '#1a1d27' : '#fff',
    tooltipText:dark ? '#e8eaf0' : '#1a1a2e',
  };
}

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function renderCharts(data) {
  const trend  = [...(data.stock_trend || [])].reverse();   // oldest → newest
  const labels = trend.map(r => r.date.slice(5));           // MM-DD

  renderMealsChart(trend, labels);
  renderStockChart(trend, labels);
  renderIngredientsChart(data.latest_record);
  renderStatusChart(data.status_breakdown || []);
  renderMonthlyChart(data);
}

/* Meals line chart */
function renderMealsChart(trend, labels) {
  destroyChart('meals');
  const ctx = document.getElementById('mealsChart');
  if (!ctx) return;
  const { gridColor, textColor, tooltipBg, tooltipText } = getChartDefaults();

  _charts.meals = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Meals Served',
        data:  trend.map(r => r.meals_served),
        borderColor:     '#e07b39',
        backgroundColor: 'rgba(224,123,57,.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      }],
    },
    options: lineOptions('Meals', gridColor, textColor, tooltipBg, tooltipText),
  });
}

/* Stock line chart */
function renderStockChart(trend, labels) {
  destroyChart('stock');
  const ctx = document.getElementById('stockChart');
  if (!ctx) return;
  const { gridColor, textColor, tooltipBg, tooltipText } = getChartDefaults();

  _charts.stock = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Stock Balance (kg)',
        data:  trend.map(r => r.stock_balance),
        borderColor:     '#1565c0',
        backgroundColor: 'rgba(21,101,192,.1)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      }],
    },
    options: lineOptions('kg', gridColor, textColor, tooltipBg, tooltipText),
  });
}

/* Ingredients doughnut */
function renderIngredientsChart(record) {
  destroyChart('ingredients');
  const ctx = document.getElementById('ingredientsChart');
  if (!ctx) return;
  const { tooltipBg, tooltipText, textColor } = getChartDefaults();

  const rice = Number(record?.rice_kg      || 0);
  const dal  = Number(record?.dal_kg       || 0);
  const veg  = Number(record?.vegetables_kg|| 0);

  _charts.ingredients = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Rice', 'Dal', 'Vegetables'],
      datasets: [{
        data:            [rice, dal, veg],
        backgroundColor: ['#e07b39', '#2e7d32', '#1565c0'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: doughnutOptions(tooltipBg, tooltipText, textColor),
  });
}

/* Status doughnut */
function renderStatusChart(breakdown) {
  destroyChart('statusChart');
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  const { tooltipBg, tooltipText, textColor } = getChartDefaults();

  const order  = ['open', 'closed', 'holiday'];
  const colors = { open: '#2e7d32', closed: '#c62828', holiday: '#e65100' };
  const labels = [], values = [], bgs = [];

  order.forEach(s => {
    const found = breakdown.find(b => b.status === s);
    if (found) {
      labels.push(s.charAt(0).toUpperCase() + s.slice(1));
      values.push(found.count);
      bgs.push(colors[s]);
    }
  });

  _charts.statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgs, borderWidth: 0, hoverOffset: 6 }],
    },
    options: doughnutOptions(tooltipBg, tooltipText, textColor),
  });
}

/* Monthly bar chart */
function renderMonthlyChart(data) {
  destroyChart('monthly');
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  const { gridColor, textColor, tooltipBg, tooltipText } = getChartDefaults();

  // Build monthly totals from stock_trend or use overall_summary as fallback
  // We ask the dashboard API which returns recent_records (7 days) and
  // stock_trend (14). For the bar chart we use stock_trend grouped by month.
  const trend = data.stock_trend || [];
  const monthly = {};
  trend.forEach(r => {
    const m = r.date.slice(0, 7);
    monthly[m] = (monthly[m] || 0) + (r.meals_served || 0);
  });

  // If we only have a few months from trend, augment with overall if available
  const months = Object.keys(monthly).sort();
  const values = months.map(m => monthly[m]);

  _charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Total Meals',
        data:  values,
        backgroundColor: 'rgba(224,123,57,.75)',
        borderColor:     '#e07b39',
        borderWidth: 1.5,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          borderColor: 'rgba(128,128,128,.2)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${Number(ctx.raw).toLocaleString()} meals`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid:  { display: false },
        },
        y: {
          ticks: { color: textColor, font: { size: 11 } },
          grid:  { color: gridColor },
          beginAtZero: true,
        },
      },
    },
  });
}

/* Shared line chart options */
function lineOptions(unit, gridColor, textColor, tooltipBg, tooltipText) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: 'rgba(128,128,128,.2)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: ctx => ` ${Number(ctx.raw).toLocaleString()} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 11 }, maxRotation: 45 },
        grid:  { display: false },
      },
      y: {
        ticks: { color: textColor, font: { size: 11 } },
        grid:  { color: gridColor },
        beginAtZero: false,
      },
    },
  };
}

/* Shared doughnut options */
function doughnutOptions(tooltipBg, tooltipText, textColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          font: { size: 12 },
          padding: 14,
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: 'rgba(128,128,128,.2)',
        borderWidth: 1,
        padding: 10,
      },
    },
  };
}

/* ─── Top Days Table ─────────────────────────────────────────────── */
function renderTopDays(rows) {
  const tbody = document.getElementById('topDaysTbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><strong>${i + 1}</strong></td>
      <td>${formatDate(r.date)}</td>
      <td><strong>${Number(r.meals_served).toLocaleString()}</strong></td>
      <td>₹${Number(r.cost_per_meal).toFixed(2)}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
}

/* ─── Recent Records Table ───────────────────────────────────────── */
function renderRecentRecords(rows) {
  const tbody = document.getElementById('recentTbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:1.5rem">No records found</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${Number(r.meals_served).toLocaleString()}</strong></td>
      <td>${Number(r.rice_kg).toFixed(1)}</td>
      <td>${Number(r.dal_kg).toFixed(1)}</td>
      <td>${Number(r.vegetables_kg).toFixed(1)}</td>
      <td>${Number(r.stock_balance).toFixed(1)}</td>
      <td>₹${Number(r.cost_per_meal).toFixed(2)}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function statusBadge(status) {
  const icons = { open: '🟢', closed: '🔴', holiday: '🟡' };
  const icon  = icons[status] || '⚪';
  return `<span class="badge badge--${status}" role="status">${icon} ${status}</span>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Exported for app.js */
window.Dashboard = { init: initDashboard, renderCharts };
