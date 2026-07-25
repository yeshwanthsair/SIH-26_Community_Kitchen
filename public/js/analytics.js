'use strict';

// Keep this feature module's state out of the shared global scope used by
// classic <script> tags. Other modules also maintain private state names.
(() => {
/**
 * analytics.js — Analytics Module (Phase 7)
 *
 * Features:
 *  - Period tabs: Weekly / Monthly / Yearly
 *  - KPI cards: avg meals, rice, dal, veg consumption, cost analysis, stock
 *  - Charts: meals bar, cost line, ingredient stacked bar,
 *            stock trend line, status doughnut, stock variance bar
 *  - Tables: low-stock days, abnormal usage flags, period breakdown
 *  - Responsive + dark-mode aware
 */

/* ─── Chart instances ────────────────────────────────────────────── */
const _ac = {};

/* ─── State ──────────────────────────────────────────────────────── */
let _data   = null;
let _period = 'monthly'; // weekly | monthly | yearly
let _initialized = false;

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */
async function initAnalytics() {
  if (!_initialized) {
    _bindEvents();
    _initialized = true;
  }
  await _load();
}

async function reloadAnalytics() {
  _data = null;
  await _load();
}

/* ═══════════════════════════════════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════════════════════════════════ */
function _bindEvents() {
  // Period tabs
  document.querySelectorAll('.an-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _period = btn.dataset.period;
      document.querySelectorAll('.an-tab').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      if (_data) _render(); // re-render without re-fetch
    });
  });

  // Refresh button
  document.getElementById('anRefreshBtn')?.addEventListener('click', reloadAnalytics);
}

/* ═══════════════════════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════════════════════ */
async function _load() {
  _showSkeletons();

  try {
    const res  = await fetch('/api/analytics');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || `Error ${res.status}`);
    _data = json.data;
    _render();
  } catch (err) {
    _showError(err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RENDER ORCHESTRATOR
   ═══════════════════════════════════════════════════════════════════ */
function _render() {
  _renderKpiCards();
  _renderAbnormalAlert();
  // Charts are isolated — a Chart.js failure must not block table rendering
  try {
    _renderCharts();
  } catch (err) {
    console.warn('[Analytics] Chart render error:', err.message);
  }
  _renderLowStockTable();
  _renderAbnormalTable();
  _renderPeriodTable();
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARDS
   ═══════════════════════════════════════════════════════════════════ */
function _renderKpiCards() {
  const s  = _data.summary || {};
  const sa = _data.stock_analysis || {};

  // Per-period averages
  const pd  = _getPeriodData();
  const opDays = pd.reduce((a, r) => a + Number(r.operational_days || 0), 0) || 1;
  const totalMeals = pd.reduce((a, r) => a + Number(r.total_meals || 0), 0);
  const totalRice  = pd.reduce((a, r) => a + Number(r.total_rice_kg || 0), 0);
  const totalDal   = pd.reduce((a, r) => a + Number(r.total_dal_kg || 0), 0);
  const totalVeg   = pd.reduce((a, r) => a + Number(r.total_vegetables_kg || 0), 0);

  const avgMeals = opDays > 0 ? totalMeals / opDays : 0;
  const avgRice  = opDays > 0 ? totalRice  / opDays : 0;
  const avgDal   = opDays > 0 ? totalDal   / opDays : 0;
  const avgVeg   = opDays > 0 ? totalVeg   / opDays : 0;
  const avgCost  = Number(s.avg_cost_per_meal || 0);
  const stock    = Number(sa.current_stock || 0);

  const isLowStock = stock < Number(sa.low_stock_threshold || 50);

  const cards = [
    { icon: '🍽️', label: 'Avg Meals / Day',     value: avgMeals.toFixed(0),             unit: '',    accent: 'orange', sub: `Period total: ${totalMeals.toLocaleString()}` },
    { icon: '🌾', label: 'Avg Rice / Day',       value: avgRice.toFixed(2),              unit: 'kg',  accent: 'green',  sub: `Total: ${totalRice.toFixed(1)} kg` },
    { icon: '🫘', label: 'Avg Dal / Day',         value: avgDal.toFixed(2),               unit: 'kg',  accent: 'teal',   sub: `Total: ${totalDal.toFixed(1)} kg` },
    { icon: '🥦', label: 'Avg Vegetables / Day', value: avgVeg.toFixed(2),               unit: 'kg',  accent: 'blue',   sub: `Total: ${totalVeg.toFixed(1)} kg` },
    { icon: '₹',  label: 'Avg Cost / Meal',      value: `₹${avgCost.toFixed(2)}`,         unit: '',    accent: 'red',    sub: `Max: ₹${Number(s.max_meals_in_day || 0).toFixed(0)} meals peak` },
    { icon: '📦', label: 'Current Stock',        value: stock.toFixed(1),                unit: 'kg',  accent: isLowStock ? 'red' : 'purple', alert: isLowStock, sub: `As of ${sa.current_stock_date || '—'}` },
  ];

  const grid = document.getElementById('anCards');
  if (!grid) return;

  grid.innerHTML = cards.map(c => `
    <div class="card${c.alert ? ' card--alert' : ''}" data-accent="${c.accent}">
      <div class="card-icon" aria-hidden="true">${c.icon}</div>
      <div class="card-label">${c.label}</div>
      <div class="card-value">
        ${c.value}${c.unit ? `<span class="unit">${c.unit}</span>` : ''}
      </div>
      <div class="card-sub">${c.sub}</div>
    </div>`).join('');

  // Animate
  grid.querySelectorAll('.card-value').forEach(el => {
    el.classList.add('animating');
    el.addEventListener('animationend', () => el.classList.remove('animating'), { once: true });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   CHARTS
   ═══════════════════════════════════════════════════════════════════ */
function _cd() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid:        dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)',
    text:        dark ? '#9298b0' : '#8890a4',
    tooltipBg:   dark ? '#1a1d27' : '#fff',
    tooltipText: dark ? '#e8eaf0' : '#1a1a2e',
  };
}

function _destroyChart(key) {
  if (_ac[key]) { _ac[key].destroy(); delete _ac[key]; }
}

function _renderCharts() {
  const pd = _getPeriodData();
  try { _renderMealsChart(pd); }    catch (e) { console.warn('[Analytics] mealsChart:', e.message); }
  try { _renderCostChart(pd); }     catch (e) { console.warn('[Analytics] costChart:', e.message); }
  try { _renderIngChart(pd); }      catch (e) { console.warn('[Analytics] ingChart:', e.message); }
  try { _renderStockChart(); }      catch (e) { console.warn('[Analytics] stockChart:', e.message); }
  try { _renderStatusChart(); }     catch (e) { console.warn('[Analytics] statusChart:', e.message); }
  try { _renderStockVarChart(); }   catch (e) { console.warn('[Analytics] stockVarChart:', e.message); }
}

/* Meals bar chart */
function _renderMealsChart(pd) {
  _destroyChart('meals');
  const ctx = document.getElementById('anMealsChart');
  if (!ctx) return;
  const { grid, text, tooltipBg, tooltipText } = _cd();
  const label = _periodLabel();
  document.getElementById('anMealsChartTitle').textContent = `Meals Served by ${label}`;

  _ac.meals = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pd.map(r => r[_periodKey()]),
      datasets: [
        {
          label:           'Total Meals',
          data:            pd.map(r => Number(r.total_meals || 0)),
          backgroundColor: 'rgba(224,123,57,.75)',
          borderColor:     '#e07b39',
          borderWidth:     1.5,
          borderRadius:    4,
          yAxisID:         'y',
        },
        {
          label:           'Avg Meals/Day',
          data:            pd.map(r => Number(r.avg_meals || 0)),
          type:            'line',
          borderColor:     '#1565c0',
          backgroundColor: 'rgba(21,101,192,.08)',
          borderWidth:     2,
          pointRadius:     3,
          fill:            false,
          tension:         0.4,
          yAxisID:         'y2',
        },
      ],
    },
    options: _dualAxisOptions('Meals', 'Avg/Day', grid, text, tooltipBg, tooltipText),
  });
}

/* Cost line chart */
function _renderCostChart(pd) {
  _destroyChart('cost');
  const ctx = document.getElementById('anCostChart');
  if (!ctx) return;
  const { grid, text, tooltipBg, tooltipText } = _cd();
  const label = _periodLabel();
  document.getElementById('anCostChartTitle').textContent = `Avg Cost / Meal by ${label}`;

  _ac.cost = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pd.map(r => r[_periodKey()]),
      datasets: [{
        label:           '₹ / Meal',
        data:            pd.map(r => +Number(r.avg_cost_per_meal || 0).toFixed(2)),
        borderColor:     '#c62828',
        backgroundColor: 'rgba(198,40,40,.08)',
        borderWidth:     2.5,
        pointRadius:     4,
        fill:            true,
        tension:         0.4,
      }],
    },
    options: _lineOptions('₹', grid, text, tooltipBg, tooltipText),
  });
}

/* Ingredient stacked bar */
function _renderIngChart(pd) {
  _destroyChart('ing');
  const ctx = document.getElementById('anIngChart');
  if (!ctx) return;
  const { grid, text, tooltipBg, tooltipText } = _cd();
  const label = _periodLabel();
  document.getElementById('anIngChartTitle').textContent = `Ingredient Consumption by ${label} (kg)`;

  _ac.ing = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pd.map(r => r[_periodKey()]),
      datasets: [
        {
          label:           'Rice',
          data:            pd.map(r => +Number(r.total_rice_kg || 0).toFixed(2)),
          backgroundColor: 'rgba(224,123,57,.8)',
          stack:           'ingredients',
          borderRadius:    { topLeft: 0, topRight: 0 },
        },
        {
          label:           'Dal',
          data:            pd.map(r => +Number(r.total_dal_kg || 0).toFixed(2)),
          backgroundColor: 'rgba(46,125,50,.75)',
          stack:           'ingredients',
        },
        {
          label:           'Vegetables',
          data:            pd.map(r => +Number(r.total_vegetables_kg || 0).toFixed(2)),
          backgroundColor: 'rgba(21,101,192,.7)',
          stack:           'ingredients',
          borderRadius:    { topLeft: 4, topRight: 4 },
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: text, font: { size: 11 }, padding: 12, boxWidth: 11 } },
        tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, borderColor: 'rgba(128,128,128,.2)', borderWidth: 1, padding: 10, callbacks: { label: c => ` ${c.dataset.label}: ${Number(c.raw).toFixed(2)} kg` } },
      },
      scales: {
        x: { stacked: true, ticks: { color: text, font: { size: 11 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: text, font: { size: 11 } }, grid: { color: grid }, beginAtZero: true },
      },
    },
  });
}

/* Stock trend line */
function _renderStockChart() {
  _destroyChart('stock');
  const ctx = document.getElementById('anStockChart');
  if (!ctx) return;
  const { grid, text, tooltipBg, tooltipText } = _cd();
  const trend = [...(_data.stock_trend || [])].reverse();

  _ac.stock = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map(r => r.date.slice(5)),
      datasets: [{
        label:           'Stock (kg)',
        data:            trend.map(r => Number(r.stock_balance)),
        borderColor:     '#1565c0',
        backgroundColor: 'rgba(21,101,192,.1)',
        borderWidth:     2.5,
        pointRadius:     3,
        fill:            true,
        tension:         0.4,
      }],
    },
    options: _lineOptions('kg', grid, text, tooltipBg, tooltipText),
  });
}

/* Status doughnut */
function _renderStatusChart() {
  _destroyChart('status');
  const ctx = document.getElementById('anStatusChart');
  if (!ctx) return;
  const { tooltipBg, tooltipText, text } = _cd();
  const breakdown = _data.status_breakdown || [];
  const order  = ['open', 'closed', 'holiday'];
  const colors = { open: '#2e7d32', closed: '#c62828', holiday: '#e65100' };
  const labels = [], values = [], bgs = [];
  order.forEach(s => {
    const f = breakdown.find(b => b.status === s);
    if (f) { labels.push(s.charAt(0).toUpperCase() + s.slice(1)); values.push(f.count); bgs.push(colors[s]); }
  });

  _ac.status = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: bgs, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: text, font: { size: 12 }, padding: 14, boxWidth: 12 } },
        tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, borderColor: 'rgba(128,128,128,.2)', borderWidth: 1, padding: 10 },
      },
    },
  });
}

/* Stock variance bar */
function _renderStockVarChart() {
  _destroyChart('var');
  const ctx = document.getElementById('anStockVarChart');
  if (!ctx) return;
  const { grid, text, tooltipBg, tooltipText } = _cd();
  const variance = (_data.stock_analysis?.stock_variance || []).slice(-20);

  _ac.var = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: variance.map(r => r.date.slice(5)),
      datasets: [
        {
          label:           'Expected (kg)',
          data:            variance.map(r => r.expected),
          backgroundColor: 'rgba(21,101,192,.55)',
          borderRadius:    3,
        },
        {
          label:           'Actual (kg)',
          data:            variance.map(r => r.actual),
          backgroundColor: 'rgba(224,123,57,.65)',
          borderRadius:    3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: text, font: { size: 11 }, padding: 12, boxWidth: 11 } },
        tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, borderColor: 'rgba(128,128,128,.2)', borderWidth: 1, padding: 10 },
      },
      scales: {
        x: { ticks: { color: text, font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: text, font: { size: 11 } }, grid: { color: grid }, beginAtZero: false },
      },
    },
  });
}

/* ─── Shared chart option factories ──────────────────────────────── */
function _lineOptions(unit, grid, text, tooltipBg, tooltipText) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, borderColor: 'rgba(128,128,128,.2)', borderWidth: 1, padding: 10,
        callbacks: { label: c => ` ${Number(c.raw).toLocaleString()} ${unit}` } },
    },
    scales: {
      x: { ticks: { color: text, font: { size: 11 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { color: text, font: { size: 11 } }, grid: { color: grid }, beginAtZero: false },
    },
  };
}

function _dualAxisOptions(unit1, unit2, grid, text, tooltipBg, tooltipText) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: text, font: { size: 11 }, padding: 12, boxWidth: 11 } },
      tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, borderColor: 'rgba(128,128,128,.2)', borderWidth: 1, padding: 10 },
    },
    scales: {
      x:  { ticks: { color: text, font: { size: 11 }, maxRotation: 45 }, grid: { display: false } },
      y:  { position: 'left',  ticks: { color: text, font: { size: 11 } }, grid: { color: grid }, beginAtZero: true, title: { display: true, text: unit1, color: text } },
      y2: { position: 'right', ticks: { color: text, font: { size: 11 } }, grid: { drawOnChartArea: false }, beginAtZero: true, title: { display: true, text: unit2, color: text } },
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   TABLES
   ═══════════════════════════════════════════════════════════════════ */

/* Abnormal alert banner */
function _renderAbnormalAlert() {
  const ab  = _data.abnormal_usage || {};
  const el  = document.getElementById('anAbnormalAlert');
  const txt = document.getElementById('anAbnormalText');
  if (!el || !txt) return;

  if (ab.flagged_count > 0) {
    txt.textContent = `${ab.flagged_count} abnormal usage day${ab.flagged_count !== 1 ? 's' : ''} detected across meals, rice consumption, and cost metrics.`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/* Low-stock table */
function _renderLowStockTable() {
  const sa   = _data.stock_analysis || {};
  const rows = sa.low_stock_records || [];
  const meta = document.getElementById('lowStockMeta');
  const tbody = document.getElementById('lowStockTbody');
  if (!tbody) return;

  if (meta) meta.textContent = `${sa.low_stock_days || 0} day${sa.low_stock_days !== 1 ? 's' : ''} below ${sa.low_stock_threshold} kg`;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1.5rem">✅ No low-stock days recorded</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${_fmtDate(r.date)}</strong></td>
      <td>${_badge(r.status)}</td>
      <td>${Number(r.meals_served).toLocaleString()}</td>
      <td class="stock-low">${Number(r.stock_balance).toFixed(2)} kg</td>
    </tr>`).join('');
}

/* Abnormal usage table */
function _renderAbnormalTable() {
  const ab    = _data.abnormal_usage || {};
  const rows  = ab.flagged || [];
  const meta  = document.getElementById('abnormalMeta');
  const tbody = document.getElementById('abnormalTbody');
  if (!tbody) return;

  if (meta) meta.textContent = `${ab.flagged_count || 0} flag${ab.flagged_count !== 1 ? 's' : ''}`;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">✅ No abnormal usage detected</td></tr>';
    return;
  }

  const typeLabel = { high_meals: 'High Meals', high_rice_pm: 'High Rice/Meal', high_cost_pm: 'High Cost/Meal' };
  const typeCls   = { high_meals: 'flag-badge--meals', high_rice_pm: 'flag-badge--rice', high_cost_pm: 'flag-badge--cost' };

  const flat = rows.flatMap(r => r.flags.map(f => ({ date: r.date, ...f })));

  tbody.innerHTML = flat.map(f => `
    <tr>
      <td><strong>${_fmtDate(f.date)}</strong></td>
      <td><span class="flag-badge ${typeCls[f.type] || ''}">${typeLabel[f.type] || f.type}</span></td>
      <td>${Number(f.value).toLocaleString()}</td>
      <td>${Number(f.avg).toLocaleString()}</td>
      <td>${Number(f.threshold).toLocaleString()}</td>
    </tr>`).join('');
}

/* Period breakdown table */
function _renderPeriodTable() {
  const pd     = _getPeriodData();
  const title  = document.getElementById('periodTableTitle');
  const head   = document.getElementById('periodTableHead');
  const tbody  = document.getElementById('periodTableBody');
  if (!tbody || !head) return;

  const label = _periodLabel();
  if (title) title.textContent = `📅 ${label} Breakdown`;

  const key = _periodKey();

  head.innerHTML = `<tr>
    <th scope="col">${label}</th>
    <th scope="col">Op Days</th>
    <th scope="col">Total Meals</th>
    <th scope="col">Avg Meals/Day</th>
    <th scope="col">Rice (kg)</th>
    <th scope="col">Dal (kg)</th>
    <th scope="col">Veg (kg)</th>
    <th scope="col">₹/Meal Avg</th>
  </tr>`;

  if (!pd.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:1.5rem">No data</td></tr>';
    return;
  }

  tbody.innerHTML = pd.map(r => `
    <tr>
      <td><strong>${r[key]}</strong></td>
      <td>${Number(r.operational_days || 0)}</td>
      <td>${Number(r.total_meals || 0).toLocaleString()}</td>
      <td>${Number(r.avg_meals || 0).toFixed(1)}</td>
      <td>${Number(r.total_rice_kg || 0).toFixed(2)}</td>
      <td>${Number(r.total_dal_kg || 0).toFixed(2)}</td>
      <td>${Number(r.total_vegetables_kg || 0).toFixed(2)}</td>
      <td>₹${Number(r.avg_cost_per_meal || 0).toFixed(2)}</td>
    </tr>`).join('');
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function _getPeriodData() {
  if (!_data) return [];
  if (_period === 'weekly')  return _data.weekly_breakdown  || [];
  if (_period === 'yearly')  return _data.yearly_breakdown  || [];
  return _data.monthly_breakdown || [];
}

function _periodKey() {
  if (_period === 'weekly')  return 'week';
  if (_period === 'yearly')  return 'year';
  return 'month';
}

function _periodLabel() {
  if (_period === 'weekly')  return 'Week';
  if (_period === 'yearly')  return 'Year';
  return 'Month';
}

function _showSkeletons() {
  const grid = document.getElementById('anCards');
  if (grid) grid.innerHTML = Array(6).fill('<div class="card skeleton" aria-hidden="true"></div>').join('');
  ['lowStockTbody','abnormalTbody','periodTableBody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<tr class="skeleton-row"><td colspan="8"><div class="skeleton-line"></div></td></tr>';
  });
}

function _showError(msg) {
  const grid = document.getElementById('anCards');
  if (grid) grid.innerHTML = `
    <div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--muted)">
      <div style="font-size:2rem;margin-bottom:.5rem">⚠️</div>
      <p>Could not load analytics.</p>
      <p style="font-size:.82rem;margin-top:.25rem">${_esc(msg)}</p>
    </div>`;
  // Clear skeleton state in all table bodies so they don't remain stuck
  const empty = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:1.5rem">—</td></tr>';
  ['lowStockTbody','abnormalTbody','periodTableBody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = empty;
  });
}

function _badge(status) {
  const icons = { open: '🟢', closed: '🔴', holiday: '🟡' };
  return `<span class="badge badge--${status}">${icons[status] || '⚪'} ${status}</span>`;
}

function _fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════ */
window.Analytics = { init: initAnalytics, reload: reloadAnalytics };
})();
