'use strict';
/**
 * records-view.js — Records Management Page (Phase 6)
 *
 * Features:
 *  - Full table with server-side pagination, sort, filter
 *  - Search by date, filter by status, filter by month
 *  - Sortable columns (date, meals_served, stock_balance, cost_per_meal)
 *  - Configurable page-size (10 / 20 / 50 / 100)
 *  - Edit row via modal (PUT /api/records/:id)
 *  - Delete row via confirmation modal (DELETE /api/records/:id)
 *  - CSV export of current filtered result set
 *  - Loading / Error / Empty states
 */

/* ─── State ──────────────────────────────────────────────────────── */
const _s = {
  page:        1,
  pageSize:    20,
  sort:        'date',
  order:       'DESC',
  search:      '',
  status:      '',
  month:       '',
  total:       0,
  totalPages:  1,
  rows:        [],        // current page rows
  allRows:     [],        // full dataset for CSV export
  editId:      null,
  deleteId:    null,
  deleteDate:  null,
  busy:        false,
};

/* ─── DOM refs ───────────────────────────────────────────────────── */
let _el = {};

/* ─── Init guard ─────────────────────────────────────────────── */
let _initialized = false;

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */
async function initRecordsView() {
  if (!_initialized) {
    _bindRefs();
    _bindToolbarEvents();
    _bindTableEvents();
    _bindPaginationEvents();
    _bindEditModal();
    _bindDeleteModal();
    _initialized = true;
  }
  await _load();
}

async function reloadRecordsView() {
  _s.page = 1;
  await _load();
}

/* ═══════════════════════════════════════════════════════════════════
   DOM BINDING
   ═══════════════════════════════════════════════════════════════════ */
function _bindRefs() {
  const $ = id => document.getElementById(id);
  _el = {
    search:       $('rvSearch'),
    filterStatus: $('rvFilterStatus'),
    filterMonth:  $('rvFilterMonth'),
    clearFilters: $('rvClearFilters'),
    exportBtn:    $('rvExportBtn'),
    refreshBtn:   $('rvRefreshBtn'),
    count:        $('rvCount'),

    tableWrap: $('rvTableWrap'),
    tbody:     $('rvTbody'),
    loading:   $('rvLoading'),
    error:     $('rvError'),
    errorMsg:  $('rvErrorMsg'),
    retryBtn:  $('rvRetryBtn'),
    empty:     $('rvEmpty'),
    emptyMsg:  $('rvEmptyMsg'),

    pageSize:  $('rvPageSize'),
    first:     $('rvFirst'),
    prev:      $('rvPrev'),
    pageInfo:  $('rvPageInfo'),
    next:      $('rvNext'),
    last:      $('rvLast'),

    // Edit modal
    editBackdrop:  $('editModalBackdrop'),
    editModal:     $('editModal'),
    editClose:     $('editModalClose'),
    editCancel:    $('editCancelBtn'),
    editSave:      $('editSaveBtn'),
    editToast:     $('editToast'),
    editToastIcon: $('editToastIcon'),
    editToastMsg:  $('editToastMsg'),
    editToastClose:$('editToastClose'),
    efId:     $('ef-id'),
    efDate:   $('ef-date'),
    efStatus: $('ef-status'),
    efMeals:  $('ef-meals'),
    efRice:   $('ef-rice'),
    efDal:    $('ef-dal'),
    efVeg:    $('ef-veg'),
    efStock:  $('ef-stock'),
    efCost:   $('ef-cost'),
    efRpm:    $('ef-rpm'),

    // Delete modal
    deleteBackdrop:  $('deleteModalBackdrop'),
    deleteClose:     $('deleteModalClose'),
    deleteCancel:    $('deleteCancelBtn'),
    deleteConfirm:   $('deleteConfirmBtn'),
    deleteDate:      $('deleteRecordDate'),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   EVENT BINDING
   ═══════════════════════════════════════════════════════════════════ */
function _bindToolbarEvents() {
  let _searchTimer;
  _el.search?.addEventListener('input', e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _s.search = e.target.value.trim();
      _s.page   = 1;
      _load();
    }, 320);
  });

  _el.filterStatus?.addEventListener('change', e => {
    _s.status = e.target.value;
    _s.page   = 1;
    _load();
  });

  _el.filterMonth?.addEventListener('change', e => {
    _s.month = e.target.value;
    _s.page  = 1;
    _load();
  });

  _el.clearFilters?.addEventListener('click', () => {
    _s.search = ''; _s.status = ''; _s.month = ''; _s.page = 1;
    if (_el.search)       _el.search.value       = '';
    if (_el.filterStatus) _el.filterStatus.value = '';
    if (_el.filterMonth)  _el.filterMonth.value  = '';
    _load();
  });

  _el.exportBtn?.addEventListener('click',  _exportCSV);
  _el.refreshBtn?.addEventListener('click', () => { _s.page = 1; _load(); });
  _el.retryBtn?.addEventListener('click',   () => _load());
}

function _bindTableEvents() {
  // Column sort (delegated to thead)
  const thead = document.getElementById('rvTable')?.querySelector('thead');
  thead?.addEventListener('click', e => {
      const th = e.target.closest('.th-sortable');
      if (!th) return;
      const col = th.dataset.col;
      if (_s.sort === col) {
        _s.order = _s.order === 'ASC' ? 'DESC' : 'ASC';
      } else {
        _s.sort  = col;
        _s.order = 'DESC';
      }
      _s.page = 1;
      _load();
    });

  // Edit / Delete (delegated to tbody)
  _el.tbody?.addEventListener('click', e => {
    const editBtn   = e.target.closest('.act-btn--edit');
    const deleteBtn = e.target.closest('.act-btn--delete');
    if (editBtn)   _openEditModal(Number(editBtn.dataset.id));
    if (deleteBtn) _openDeleteModal(Number(deleteBtn.dataset.id), deleteBtn.dataset.date);
  });
}

function _bindPaginationEvents() {
  _el.pageSize?.addEventListener('change', e => {
    _s.pageSize = Number(e.target.value);
    _s.page     = 1;
    _load();
  });

  _el.first?.addEventListener('click', () => { _s.page = 1;           _load(); });
  _el.prev?.addEventListener('click',  () => { _s.page--;             _load(); });
  _el.next?.addEventListener('click',  () => { _s.page++;             _load(); });
  _el.last?.addEventListener('click',  () => { _s.page = _s.totalPages; _load(); });
}

/* ═══════════════════════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════════════════════ */
async function _load() {
  _setState('loading');

  // Build query string
  const params = new URLSearchParams({
    sort:  _s.sort,
    order: _s.order,
    page:  _s.page,
    limit: _s.pageSize,
  });
  if (_s.status) params.set('status', _s.status);
  if (_s.month)  params.set('month',  _s.month);
  // Date search: if user typed a date-like string, use date param; otherwise ignore
  if (_s.search && /^\d{4}-\d{2}-\d{2}$/.test(_s.search)) {
    params.set('date', _s.search);
  } else if (_s.search && /^\d{4}-\d{2}$/.test(_s.search)) {
    params.set('month', _s.search);
  }

  try {
    const res  = await fetch(`/api/records?${params}`);
    const json = await res.json();

    if (!res.ok || !json.success) throw new Error(json.message || `Error ${res.status}`);

    const { data, pagination } = json.data;
    _s.rows       = data || [];
    _s.total      = pagination.total;
    _s.totalPages = pagination.totalPages;

    // Also fetch all rows (lightweight: dates + status only) for CSV
    // We re-use the full dataset by fetching limit=200 separately only on CSV click
    // For now just keep current page rows; CSV will re-fetch all.

    if (_s.rows.length === 0 && _s.total === 0 && !_s.search && !_s.status && !_s.month) {
      _setState('empty');
      _el.emptyMsg.textContent = 'No records in the database yet.';
      _updateCount(0, 0);
      return;
    }

    if (_s.rows.length === 0) {
      _setState('empty');
      _el.emptyMsg.textContent = 'No records match your filters.';
      _updateCount(0, _s.total);
      _updatePagination();
      return;
    }

    _setState('table');
    _renderRows();
    _updatePagination();
    _updateCount(_s.rows.length, _s.total);
    _updateSortHeaders();

  } catch (err) {
    _setState('error');
    if (_el.errorMsg) _el.errorMsg.textContent = `Could not load records: ${err.message}`;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════════════════════════════ */
function _renderRows() {
  if (!_el.tbody) return;
  _el.tbody.innerHTML = _s.rows.map(r => `
    <tr id="rvrow-${r.id}">
      <td><strong>${_fmtDate(r.date)}</strong></td>
      <td>${_badge(r.status)}</td>
      <td>${Number(r.meals_served).toLocaleString()}</td>
      <td>${Number(r.rice_kg).toFixed(2)}</td>
      <td>${Number(r.dal_kg).toFixed(2)}</td>
      <td>${Number(r.vegetables_kg).toFixed(2)}</td>
      <td>${Number(r.stock_balance).toFixed(2)}</td>
      <td>₹${Number(r.cost_per_meal).toFixed(2)}</td>
      <td>${Number(r.rice_per_meal).toFixed(4)}</td>
      <td>
        <div class="rv-actions">
          <button class="act-btn act-btn--edit"   data-id="${r.id}" title="Edit record"   aria-label="Edit ${r.date}">✏️</button>
          <button class="act-btn act-btn--delete" data-id="${r.id}" data-date="${r.date}" title="Delete record" aria-label="Delete ${r.date}">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function _updatePagination() {
  const { page, totalPages } = _s;
  if (_el.pageInfo) _el.pageInfo.textContent = `Page ${page} of ${Math.max(1, totalPages)}`;
  if (_el.first) _el.first.disabled = page <= 1;
  if (_el.prev)  _el.prev.disabled  = page <= 1;
  if (_el.next)  _el.next.disabled  = page >= totalPages;
  if (_el.last)  _el.last.disabled  = page >= totalPages;
}

function _updateCount(shown, total) {
  if (!_el.count) return;
  if (total === 0) { _el.count.textContent = ''; return; }
  const hasFilter = _s.search || _s.status || _s.month;
  _el.count.textContent = hasFilter
    ? `${total} matching record${total !== 1 ? 's' : ''}`
    : `${total} record${total !== 1 ? 's' : ''} total`;
}

function _updateSortHeaders() {
  document.querySelectorAll('.th-sortable').forEach(th => {
    if (th.dataset.col === _s.sort) {
      th.setAttribute('aria-sort', _s.order === 'ASC' ? 'ascending' : 'descending');
    } else {
      th.setAttribute('aria-sort', 'none');
    }
  });
}

/* ── State switcher ──────────────────────────────────────────────── */
function _setState(state) {
  // state: 'loading' | 'error' | 'empty' | 'table'
  const show = id => _el[id]?.classList.remove('hidden');
  const hide = id => _el[id]?.classList.add('hidden');

  hide('loading'); hide('error'); hide('empty');

  if (state === 'loading') {
    show('loading');
    hide('tableWrap');
    _showTableSkeleton();
    return;
  }
  if (state === 'error')  { show('error');  hide('tableWrap'); return; }
  if (state === 'empty')  { show('empty');  hide('tableWrap'); return; }
  if (state === 'table')  { show('tableWrap'); }
}

function _showTableSkeleton() {
  if (_el.tbody) {
    _el.tbody.innerHTML = Array(6).fill(
      '<tr class="skeleton-row"><td colspan="10"><div class="skeleton-line"></div></td></tr>'
    ).join('');
  }
  _el.tableWrap?.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════════════
   CSV EXPORT
   ═══════════════════════════════════════════════════════════════════ */
async function _exportCSV() {
  _el.exportBtn.disabled = true;
  _el.exportBtn.textContent = '⏳ Exporting…';

  try {
    // Fetch ALL matching records (up to 200) for the current filters
    const params = new URLSearchParams({
      sort: _s.sort, order: _s.order, limit: 200, page: 1,
    });
    if (_s.status) params.set('status', _s.status);
    if (_s.month)  params.set('month',  _s.month);
    if (_s.search && /^\d{4}-\d{2}-\d{2}$/.test(_s.search)) params.set('date', _s.search);
    else if (_s.search && /^\d{4}-\d{2}$/.test(_s.search)) params.set('month', _s.search);

    const res  = await fetch(`/api/records?${params}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const rows = json.data.data || [];
    if (!rows.length) { alert('No records to export.'); return; }

    const COLS = ['id','date','status','meals_served','rice_kg','dal_kg',
                  'vegetables_kg','stock_balance','cost_per_meal','rice_per_meal','created_at'];

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      COLS.join(','),
      ...rows.map(r => COLS.map(c => escape(r[c])).join(',')),
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const ts   = new Date().toISOString().slice(0,10);
    a.download = `community-kitchen-records-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    alert(`Export failed: ${err.message}`);
  } finally {
    _el.exportBtn.disabled   = false;
    _el.exportBtn.innerHTML  = '<span aria-hidden="true">⬇</span> Export CSV';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   EDIT MODAL
   ═══════════════════════════════════════════════════════════════════ */
function _bindEditModal() {
  _el.editClose?.addEventListener('click',  _closeEditModal);
  _el.editCancel?.addEventListener('click', _closeEditModal);
  _el.editToastClose?.addEventListener('click', () => _el.editToast?.classList.add('hidden'));
  _el.editSave?.addEventListener('click',   _submitEdit);
  _el.editBackdrop?.addEventListener('click', e => {
    if (e.target === _el.editBackdrop) _closeEditModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !_el.editBackdrop?.classList.contains('hidden')) _closeEditModal();
  });
}

function _openEditModal(id) {
  const row = _s.rows.find(r => r.id === id);
  if (!row) return;
  _s.editId = id;

  // Populate fields
  _el.efId.value     = row.id;
  _el.efDate.value   = row.date;
  _el.efStatus.value = row.status;
  _el.efMeals.value  = row.meals_served;
  _el.efRice.value   = row.rice_kg;
  _el.efDal.value    = row.dal_kg;
  _el.efVeg.value    = row.vegetables_kg;
  _el.efStock.value  = row.stock_balance;
  _el.efCost.value   = row.cost_per_meal;
  _el.efRpm.value    = row.rice_per_meal;

  _clearEditErrors();
  _el.editToast?.classList.add('hidden');
  _el.editBackdrop?.classList.remove('hidden');
  _el.editBackdrop?.removeAttribute('aria-hidden');
  _el.efDate?.focus();
  document.body.style.overflow = 'hidden';
}

function _closeEditModal() {
  _el.editBackdrop?.classList.add('hidden');
  _el.editBackdrop?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  _s.editId = null;
}

async function _submitEdit() {
  if (_s.busy) return;

  _clearEditErrors();

  // Validate
  const errors = _validateEditForm();
  if (Object.keys(errors).length) {
    _applyEditErrors(errors);
    return;
  }

  // Build payload — only changed fields
  const meals  = parseInt(_el.efMeals.value, 10);
  const rice   = parseFloat(_el.efRice.value);
  const rpmRaw = _el.efRpm.value.trim();
  const rpm    = rpmRaw !== '' ? parseFloat(rpmRaw)
               : (meals > 0 ? parseFloat((rice / meals).toFixed(4)) : 0);

  const payload = {
    date:          _el.efDate.value,
    status:        _el.efStatus.value,
    meals_served:  meals,
    rice_kg:       rice,
    dal_kg:        parseFloat(_el.efDal.value),
    vegetables_kg: parseFloat(_el.efVeg.value),
    stock_balance: parseFloat(_el.efStock.value),
    cost_per_meal: parseFloat(_el.efCost.value),
    rice_per_meal: rpm,
  };

  _setBusy(_el.editSave, true);

  try {
    const res  = await fetch(`/api/records/${_s.editId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.ok && json.success) {
      const savedId = _s.editId;
      _closeEditModal();
      await _load();
      _flashRow(savedId, 'edit');
      return;
    }

    if (res.status === 400 && json.errors) {
      _applyEditErrors(json.errors);
      _showEditToast('error', '❌', 'Please fix the highlighted fields.');
      return;
    }
    if (res.status === 409) {
      _showEditToast('conflict', '⚠️', json.message);
      return;
    }
    _showEditToast('error', '❌', json.message || 'Save failed.');

  } catch (err) {
    _showEditToast('error', '❌', 'Network error.');
  } finally {
    _setBusy(_el.editSave, false);
  }
}

function _validateEditForm() {
  const errors = {};
  const dateVal = _el.efDate.value?.trim();
  if (!dateVal) {
    errors.date = 'Required';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    errors.date = 'Must be YYYY-MM-DD';
  } else {
    const [year, month, day] = dateVal.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      errors.date = 'Invalid calendar date';
    }
  }
  if (!_el.efStatus.value) errors.status        = 'Required';
  const meals = Number(_el.efMeals.value);
  if (_el.efMeals.value === '' || !Number.isInteger(meals) || meals < 0)
    errors.meals_served = 'Must be a non-negative integer';
  ['efRice','efDal','efVeg','efStock','efCost'].forEach(k => {
    const v = parseFloat(_el[k]?.value);
    if (_el[k]?.value === '' || isNaN(v) || v < 0)
      errors[{ efRice:'rice_kg',efDal:'dal_kg',efVeg:'vegetables_kg',efStock:'stock_balance',efCost:'cost_per_meal' }[k]] = 'Must be ≥ 0';
  });
  return errors;
}

function _applyEditErrors(errors) {
  const map = {
    date:          'ef-err-date',
    status:        'ef-err-status',
    meals_served:  'ef-err-meals',
    rice_kg:       'ef-err-rice',
    dal_kg:        'ef-err-dal',
    vegetables_kg: 'ef-err-veg',
    stock_balance: 'ef-err-stock',
    cost_per_meal: 'ef-err-cost',
    rice_per_meal: 'ef-err-rpm',
  };
  for (const [field, msg] of Object.entries(errors)) {
    const el = document.getElementById(map[field]);
    if (el) el.textContent = msg;
    // Also mark corresponding input
    const inputMap = {
      date:'ef-date',status:'ef-status',meals_served:'ef-meals',
      rice_kg:'ef-rice',dal_kg:'ef-dal',vegetables_kg:'ef-veg',
      stock_balance:'ef-stock',cost_per_meal:'ef-cost',rice_per_meal:'ef-rpm',
    };
    document.getElementById(inputMap[field])?.classList.add('is-invalid');
  }
}

function _clearEditErrors() {
  document.querySelectorAll('#editForm .form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('#editForm .form-control').forEach(el => el.classList.remove('is-invalid','is-valid'));
}

function _showEditToast(type, icon, msg) {
  if (!_el.editToast) return;
  _el.editToast.className = `toast toast--${type}`;
  if (_el.editToastIcon) _el.editToastIcon.textContent = icon;
  if (_el.editToastMsg)  _el.editToastMsg.textContent  = msg;
  _el.editToast.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════════════
   DELETE MODAL
   ═══════════════════════════════════════════════════════════════════ */
function _bindDeleteModal() {
  _el.deleteClose?.addEventListener('click',   _closeDeleteModal);
  _el.deleteCancel?.addEventListener('click',  _closeDeleteModal);
  _el.deleteConfirm?.addEventListener('click', _confirmDelete);
  _el.deleteBackdrop?.addEventListener('click', e => {
    if (e.target === _el.deleteBackdrop) _closeDeleteModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !_el.deleteBackdrop?.classList.contains('hidden')) _closeDeleteModal();
  });
}

function _openDeleteModal(id, date) {
  _s.deleteId   = id;
  _s.deleteDate = date;
  if (_el.deleteDate) _el.deleteDate.textContent = _fmtDate(date);
  _el.deleteBackdrop?.classList.remove('hidden');
  _el.deleteBackdrop?.removeAttribute('aria-hidden');
  _el.deleteConfirm?.focus();
  document.body.style.overflow = 'hidden';
}

function _closeDeleteModal() {
  _el.deleteBackdrop?.classList.add('hidden');
  _el.deleteBackdrop?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  _s.deleteId   = null;
  _s.deleteDate = null;
}

async function _confirmDelete() {
  if (_s.busy || !_s.deleteId) return;
  _setBusy(_el.deleteConfirm, true);

  try {
    const res  = await fetch(`/api/records/${_s.deleteId}`, { method: 'DELETE' });
    const json = await res.json();

    if (res.ok && json.success) {
      _closeDeleteModal();
      // If last item on page, go back one page
      if (_s.rows.length === 1 && _s.page > 1) _s.page--;
      await _load();
      return;
    }
    alert(json.message || 'Delete failed.');
  } catch (err) {
    alert('Network error. Could not delete.');
  } finally {
    _setBusy(_el.deleteConfirm, false);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function _setBusy(btn, busy) {
  _s.busy     = busy;
  if (!btn) return;
  btn.disabled = busy;
  const spinner = btn.querySelector('.btn-spinner');
  const text    = btn.querySelector('.btn-text');
  spinner?.classList.toggle('hidden', !busy);
  if (text) text.style.opacity = busy ? '.5' : '1';
}

function _flashRow(id, type) {
  // Small highlight on the edited row after reload
  const row = document.getElementById(`rvrow-${id}`);
  if (!row) return;
  row.classList.add('row-new');
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _badge(status) {
  const icons = { open: '🟢', closed: '🔴', holiday: '🟡' };
  return `<span class="badge badge--${status}">${icons[status] || '⚪'} ${status}</span>`;
}

function _fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════ */
window.RecordsView = { init: initRecordsView, reload: reloadRecordsView };
