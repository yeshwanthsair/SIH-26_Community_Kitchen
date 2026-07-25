'use strict';
/**
 * register.js — Daily Register Module (Phase 5)
 *
 * Responsibilities:
 *  - Render the "Add Record" form with full client-side validation
 *  - Auto-calculate rice_per_meal from rice_kg ÷ meals_served
 *  - Show/hide operational fields based on status (closed/holiday = zeros)
 *  - Submit to POST /api/records with proper error handling
 *  - Display success / error / conflict toasts
 *  - Load + paginate record history table
 *  - Live search/filter on the history table
 *  - Highlight newly added rows
 */

/* ─── Constants ──────────────────────────────────────────────────── */
const HISTORY_PAGE_SIZE = 15;

/* ─── Module state ───────────────────────────────────────────────── */
let _historyPage  = 1;
let _historyTotal = 0;
let _historyAll   = [];   // full dataset for client-side search
let _searchTerm   = '';
let _submitInProgress = false;

/* ─── DOM refs (populated in init) ──────────────────────────────── */
let _form, _submitBtn, _resetBtn, _toast, _toastIcon, _toastMsg, _toastClose;
let _fDate, _fStatus, _fMeals, _fRice, _fDal, _fVeg, _fStock, _fCost;
let _operationalFields, _calcValue;
let _historyTbody, _historyCount, _historySearch, _historyRefreshBtn;
let _prevBtn, _nextBtn, _pageInfo;

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */

async function initRegister() {
  _bindDomRefs();
  _bindFormEvents();
  _bindHistoryEvents();
  _setDefaultDate();
  await _loadHistory();
}

/* ═══════════════════════════════════════════════════════════════════
   DOM BINDINGS
   ═══════════════════════════════════════════════════════════════════ */

function _bindDomRefs() {
  _form         = document.getElementById('registerForm');
  _submitBtn    = document.getElementById('submitBtn');
  _resetBtn     = document.getElementById('resetFormBtn');
  _toast        = document.getElementById('registerToast');
  _toastIcon    = document.getElementById('toastIcon');
  _toastMsg     = document.getElementById('toastMsg');
  _toastClose   = document.getElementById('toastClose');

  _fDate        = document.getElementById('f-date');
  _fStatus      = document.getElementById('f-status');
  _fMeals       = document.getElementById('f-meals');
  _fRice        = document.getElementById('f-rice');
  _fDal         = document.getElementById('f-dal');
  _fVeg         = document.getElementById('f-veg');
  _fStock       = document.getElementById('f-stock');
  _fCost        = document.getElementById('f-cost');

  _operationalFields = document.getElementById('operationalFields');
  _calcValue         = document.getElementById('calcRicePerMeal');

  _historyTbody      = document.getElementById('historyTbody');
  _historyCount      = document.getElementById('historyCount');
  _historySearch     = document.getElementById('historySearch');
  _historyRefreshBtn = document.getElementById('historyRefreshBtn');

  _prevBtn   = document.getElementById('prevPageBtn');
  _nextBtn   = document.getElementById('nextPageBtn');
  _pageInfo  = document.getElementById('pageInfo');
}

function _bindFormEvents() {
  if (!_form) return;

  // Form submit
  _form.addEventListener('submit', _handleSubmit);

  // Reset button
  _resetBtn?.addEventListener('click', _resetForm);

  // Toast dismiss
  _toastClose?.addEventListener('click', _hideToast);

  // Status change — toggle operational fields
  _fStatus?.addEventListener('change', _onStatusChange);

  // Live validation on blur
  const blurFields = [
    { el: _fDate,   validate: _validateDate },
    { el: _fStatus, validate: _validateStatus },
    { el: _fMeals,  validate: _validateMeals },
    { el: _fRice,   validate: () => _validateNonNeg(_fRice, 'err-rice', 'Rice used') },
    { el: _fDal,    validate: () => _validateNonNeg(_fDal, 'err-dal', 'Dal used') },
    { el: _fVeg,    validate: () => _validateNonNeg(_fVeg, 'err-veg', 'Vegetables') },
    { el: _fStock,  validate: () => _validateNonNeg(_fStock, 'err-stock', 'Stock balance') },
    { el: _fCost,   validate: () => _validateNonNeg(_fCost, 'err-cost', 'Cost per meal') },
  ];
  blurFields.forEach(({ el, validate }) => {
    el?.addEventListener('blur', validate);
    el?.addEventListener('input', () => { _clearFieldError(el); });
  });

  // Auto-calculate rice_per_meal whenever meals or rice changes
  _fMeals?.addEventListener('input', _updateCalcPreview);
  _fRice?.addEventListener('input',  _updateCalcPreview);
}

function _bindHistoryEvents() {
  _historySearch?.addEventListener('input', e => {
    _searchTerm  = e.target.value.trim().toLowerCase();
    _historyPage = 1;
    _renderHistoryTable();
  });

  _historyRefreshBtn?.addEventListener('click', async () => {
    _historyRefreshBtn.classList.add('spinning');
    await _loadHistory();
    _historyRefreshBtn.classList.remove('spinning');
  });

  _prevBtn?.addEventListener('click', () => {
    if (_historyPage > 1) { _historyPage--; _renderHistoryTable(); }
  });
  _nextBtn?.addEventListener('click', () => {
    const filtered = _getFiltered();
    const totalPages = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
    if (_historyPage < totalPages) { _historyPage++; _renderHistoryTable(); }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   FORM LOGIC
   ═══════════════════════════════════════════════════════════════════ */

function _setDefaultDate() {
  if (!_fDate) return;
  _fDate.value = new Date().toISOString().slice(0, 10);
}

function _onStatusChange() {
  const status = _fStatus?.value;
  if (!_operationalFields) return;

  const isNonOp = status === 'closed' || status === 'holiday';
  _operationalFields.style.opacity        = isNonOp ? '.45' : '1';
  _operationalFields.style.pointerEvents  = isNonOp ? 'none' : '';

  if (isNonOp) {
    // Zero-fill all operational inputs
    [_fMeals, _fRice, _fDal, _fVeg, _fStock, _fCost].forEach(el => {
      if (el) el.value = '0';
    });
    _updateCalcPreview();
    _clearAllErrors();
  }

  _clearFieldError(_fStatus);
}

/* ─── Auto-calculate rice_per_meal ───────────────────────────────── */
function _updateCalcPreview() {
  if (!_calcValue) return;
  const meals = parseFloat(_fMeals?.value);
  const rice  = parseFloat(_fRice?.value);

  if (meals > 0 && rice >= 0) {
    const ricePerMeal = rice / meals;
    _calcValue.textContent = `${ricePerMeal.toFixed(4)} kg`;
    _calcValue.style.color = 'var(--primary)';
  } else {
    _calcValue.textContent = '—';
    _calcValue.style.color = 'var(--muted)';
  }
}

/* ─── Submit handler ─────────────────────────────────────────────── */
async function _handleSubmit(e) {
  e.preventDefault();
  if (_submitInProgress) return;

  _hideToast();

  const valid = _validateAll();
  if (!valid) {
    // Scroll to first error
    const firstErr = _form.querySelector('.is-invalid');
    firstErr?.focus();
    return;
  }

  const payload = _buildPayload();

  _setSubmitting(true);

  try {
    const res  = await fetch('/api/records', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.status === 201 && json.success) {
      _showToast('success', '✅', `Record for ${_formatDate(payload.date)} saved successfully!`);
      _resetForm();
      // Reload history and highlight new row
      await _loadHistory();
      _highlightRow(json.data?.id);
      return;
    }

    if (res.status === 409) {
      _showToast('conflict', '⚠️', json.message || `A record for ${payload.date} already exists.`);
      _markFieldInvalid(_fDate, 'err-date', 'A record for this date already exists');
      return;
    }

    if (res.status === 400 && json.errors) {
      _applyServerErrors(json.errors);
      _showToast('error', '❌', 'Please fix the highlighted fields.');
      return;
    }

    // Generic server error
    _showToast('error', '❌', json.message || 'Server error. Please try again.');

  } catch (err) {
    _showToast('error', '❌', 'Network error — could not reach the server.');
  } finally {
    _setSubmitting(false);
  }
}

function _buildPayload() {
  const status  = _fStatus.value;
  const isNonOp = status === 'closed' || status === 'holiday';

  const meals = isNonOp ? 0 : parseInt(_fMeals.value, 10);
  const rice  = isNonOp ? 0 : parseFloat(_fRice.value);
  const ricePerMeal = (meals > 0 && rice >= 0) ? parseFloat((rice / meals).toFixed(4)) : 0;

  return {
    date:          _fDate.value,
    meals_served:  meals,
    rice_kg:       isNonOp ? 0 : parseFloat(_fRice.value),
    dal_kg:        isNonOp ? 0 : parseFloat(_fDal.value),
    vegetables_kg: isNonOp ? 0 : parseFloat(_fVeg.value),
    stock_balance: isNonOp ? 0 : parseFloat(_fStock.value),
    cost_per_meal: isNonOp ? 0 : parseFloat(_fCost.value),
    rice_per_meal: ricePerMeal,
    status,
  };
}

function _resetForm() {
  _form?.reset();
  _setDefaultDate();
  _clearAllErrors();
  _hideToast();
  _updateCalcPreview();
  if (_operationalFields) {
    _operationalFields.style.opacity       = '1';
    _operationalFields.style.pointerEvents = '';
  }
}

function _setSubmitting(busy) {
  _submitInProgress = busy;
  if (!_submitBtn) return;
  _submitBtn.disabled = busy;
  const spinner = _submitBtn.querySelector('.btn-spinner');
  const text    = _submitBtn.querySelector('.btn-text');
  spinner?.classList.toggle('hidden', !busy);
  if (text) text.style.opacity = busy ? '.5' : '1';
}

/* ─── Server-side error mapping ──────────────────────────────────── */
function _applyServerErrors(errors) {
  const map = {
    date:          { el: _fDate,  errId: 'err-date' },
    meals_served:  { el: _fMeals, errId: 'err-meals' },
    rice_kg:       { el: _fRice,  errId: 'err-rice' },
    dal_kg:        { el: _fDal,   errId: 'err-dal' },
    vegetables_kg: { el: _fVeg,   errId: 'err-veg' },
    stock_balance: { el: _fStock, errId: 'err-stock' },
    cost_per_meal: { el: _fCost,  errId: 'err-cost' },
    status:        { el: _fStatus,errId: 'err-status' },
  };
  for (const [field, msg] of Object.entries(errors)) {
    const m = map[field];
    if (m) _markFieldInvalid(m.el, m.errId, msg);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CLIENT-SIDE VALIDATION
   ═══════════════════════════════════════════════════════════════════ */

function _validateAll() {
  const status  = _fStatus?.value;
  const isNonOp = status === 'closed' || status === 'holiday';
  let ok = true;

  if (!_validateDate())   ok = false;
  if (!_validateStatus()) ok = false;

  if (!isNonOp) {
    if (!_validateMeals())                                         ok = false;
    if (!_validateNonNeg(_fRice,  'err-rice',  'Rice used'))      ok = false;
    if (!_validateNonNeg(_fDal,   'err-dal',   'Dal used'))       ok = false;
    if (!_validateNonNeg(_fVeg,   'err-veg',   'Vegetables'))     ok = false;
    if (!_validateNonNeg(_fStock, 'err-stock', 'Stock balance'))  ok = false;
    if (!_validateNonNeg(_fCost,  'err-cost',  'Cost per meal'))  ok = false;
  }

  return ok;
}

function _validateDate() {
  const v = _fDate?.value?.trim();
  if (!v) {
    _markFieldInvalid(_fDate, 'err-date', 'Date is required');
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    _markFieldInvalid(_fDate, 'err-date', 'Enter a valid date (YYYY-MM-DD)');
    return false;
  }
  const [year, month, day] = v.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    _markFieldInvalid(_fDate, 'err-date', 'Enter a valid calendar date');
    return false;
  }
  _markFieldValid(_fDate, 'err-date');
  return true;
}

function _validateStatus() {
  const v = _fStatus?.value;
  if (!v) {
    _markFieldInvalid(_fStatus, 'err-status', 'Status is required');
    return false;
  }
  _markFieldValid(_fStatus, 'err-status');
  return true;
}

function _validateMeals() {
  const raw = _fMeals?.value;
  if (raw === '' || raw === null || raw === undefined) {
    _markFieldInvalid(_fMeals, 'err-meals', 'Meals served is required');
    return false;
  }
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0) {
    _markFieldInvalid(_fMeals, 'err-meals', 'Must be a non-negative whole number');
    return false;
  }
  _markFieldValid(_fMeals, 'err-meals');
  return true;
}

function _validateNonNeg(el, errId, label) {
  const raw = el?.value;
  if (raw === '' || raw === null || raw === undefined) {
    _markFieldInvalid(el, errId, `${label} is required`);
    return false;
  }
  const v = parseFloat(raw);
  if (isNaN(v) || v < 0) {
    _markFieldInvalid(el, errId, `${label} must be ≥ 0`);
    return false;
  }
  _markFieldValid(el, errId);
  return true;
}

/* ─── Field state helpers ────────────────────────────────────────── */
function _markFieldInvalid(el, errId, msg) {
  el?.classList.add('is-invalid');
  el?.classList.remove('is-valid');
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = msg;
}

function _markFieldValid(el, errId) {
  el?.classList.remove('is-invalid');
  el?.classList.add('is-valid');
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = '';
}

function _clearFieldError(el) {
  el?.classList.remove('is-invalid', 'is-valid');
}

function _clearAllErrors() {
  _form?.querySelectorAll('.form-control').forEach(el => {
    el.classList.remove('is-invalid', 'is-valid');
  });
  _form?.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
  });
}

/* ═══════════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════════ */

let _toastTimer = null;

function _showToast(type, icon, message, autoDismissMs = 6000) {
  if (!_toast) return;
  _toast.className = `toast toast--${type}`;
  if (_toastIcon) _toastIcon.textContent = icon;
  if (_toastMsg)  _toastMsg.textContent  = message;
  _toast.classList.remove('hidden');

  // Scroll toast into view
  _toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-dismiss
  clearTimeout(_toastTimer);
  if (autoDismissMs > 0) {
    _toastTimer = setTimeout(_hideToast, autoDismissMs);
  }
}

function _hideToast() {
  clearTimeout(_toastTimer);
  _toast?.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORY TABLE
   ═══════════════════════════════════════════════════════════════════ */

async function _loadHistory() {
  _showHistorySkeleton();
  try {
    const res  = await fetch('/api/records?sort=date&order=DESC&limit=200');
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    _historyAll   = json.data.data || [];
    _historyTotal = _historyAll.length;
    _historyPage  = 1;
    _renderHistoryTable();
  } catch (err) {
    if (_historyTbody) {
      _historyTbody.innerHTML = `
        <tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem">
          ⚠️ Could not load records: ${_escHtml(err.message)}
        </td></tr>`;
    }
  }
}

function _getFiltered() {
  if (!_searchTerm) return _historyAll;
  return _historyAll.filter(r =>
    r.date.includes(_searchTerm) ||
    r.status.includes(_searchTerm)
  );
}

function _renderHistoryTable() {
  if (!_historyTbody) return;

  const filtered   = _getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  if (_historyPage > totalPages) _historyPage = totalPages;

  const start = (_historyPage - 1) * HISTORY_PAGE_SIZE;
  const page  = filtered.slice(start, start + HISTORY_PAGE_SIZE);

  // Count badge
  if (_historyCount) {
    _historyCount.textContent = _searchTerm
      ? `${filtered.length} of ${_historyAll.length} records`
      : `${_historyAll.length} record${_historyAll.length !== 1 ? 's' : ''}`;
  }

  // Pagination controls
  if (_pageInfo) _pageInfo.textContent = `Page ${_historyPage} of ${totalPages}`;
  if (_prevBtn)  _prevBtn.disabled  = _historyPage <= 1;
  if (_nextBtn)  _nextBtn.disabled  = _historyPage >= totalPages;

  if (!page.length) {
    _historyTbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem">
        ${_searchTerm ? 'No records match your filter.' : 'No records found.'}
      </td></tr>`;
    return;
  }

  _historyTbody.innerHTML = page.map(r => `
    <tr id="row-${r.id}">
      <td><strong>${_formatDate(r.date)}</strong></td>
      <td>${_statusBadge(r.status)}</td>
      <td>${Number(r.meals_served).toLocaleString()}</td>
      <td>${Number(r.rice_kg).toFixed(2)}</td>
      <td>${Number(r.dal_kg).toFixed(2)}</td>
      <td>${Number(r.vegetables_kg).toFixed(2)}</td>
      <td>${Number(r.stock_balance).toFixed(2)}</td>
      <td>₹${Number(r.cost_per_meal).toFixed(2)}</td>
      <td>${Number(r.rice_per_meal).toFixed(4)}</td>
    </tr>`).join('');
}

function _showHistorySkeleton() {
  if (!_historyTbody) return;
  _historyTbody.innerHTML = Array(5).fill(
    '<tr class="skeleton-row"><td colspan="9"><div class="skeleton-line"></div></td></tr>'
  ).join('');
}

function _highlightRow(id) {
  if (!id) return;
  const row = document.getElementById(`row-${id}`);
  if (row) {
    row.classList.add('row-new');
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function _formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function _statusBadge(status) {
  const icons = { open: '🟢', closed: '🔴', holiday: '🟡' };
  const icon  = icons[status] || '⚪';
  return `<span class="badge badge--${status}">${icon} ${status}</span>`;
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════ */
window.Register = { init: initRegister, reload: _loadHistory };
