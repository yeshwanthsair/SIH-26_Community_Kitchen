'use strict';

/**
 * Field-level validation helpers.
 * Each validator returns null on success or an error string on failure.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ['open', 'closed', 'holiday'];
const RECORD_FIELDS = ['date', 'meals_served', 'rice_kg', 'dal_kg', 'vegetables_kg', 'stock_balance', 'cost_per_meal', 'rice_per_meal', 'status'];
const SORT_FIELDS = ['id', 'date', 'meals_served', 'stock_balance', 'cost_per_meal', 'created_at'];

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function unknownFieldErrors(body) {
  return Object.keys(body)
    .filter(field => !RECORD_FIELDS.includes(field))
    .reduce((errors, field) => ({ ...errors, [field]: 'is not allowed' }), {});
}

function isValidDate(value) {
  if (typeof value !== 'string') return 'must be YYYY-MM-DD';
  if (!DATE_RE.test(value)) return 'must be YYYY-MM-DD';
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return 'invalid calendar date';
  }
  return null;
}

function isNonNegativeInteger(value) {
  if (!Number.isInteger(value) || value < 0) return 'must be a non-negative integer';
  return null;
}

function isNonNegativeNumber(value) {
  if (typeof value !== 'number' || isNaN(value) || value < 0) return 'must be a non-negative number';
  return null;
}

function isValidStatus(value) {
  if (!VALID_STATUSES.includes(value)) return `must be one of: ${VALID_STATUSES.join(', ')}`;
  return null;
}

/**
 * Validate fields required for creating a DailyRecord.
 * Returns an object of { field: errorMessage } or null if valid.
 */
function validateCreateRecord(body) {
  body = safeObject(body);
  const errors = unknownFieldErrors(body);

  const dateErr = isValidDate(body.date);
  if (dateErr) errors.date = dateErr;

  if (body.meals_served === undefined) {
    errors.meals_served = 'required';
  } else {
    const e = isNonNegativeInteger(body.meals_served);
    if (e) errors.meals_served = e;
  }

  const numericFields = ['rice_kg', 'dal_kg', 'vegetables_kg', 'stock_balance', 'cost_per_meal', 'rice_per_meal'];
  for (const field of numericFields) {
    if (body[field] === undefined) {
      errors[field] = 'required';
    } else {
      const e = isNonNegativeNumber(body[field]);
      if (e) errors[field] = e;
    }
  }

  if (body.status === undefined) {
    errors.status = 'required';
  } else {
    const e = isValidStatus(body.status);
    if (e) errors.status = e;
  }

  return Object.keys(errors).length ? errors : null;
}

/**
 * Validate fields allowed for updating a DailyRecord (all optional).
 * Returns an object of { field: errorMessage } or null if valid.
 */
function validateUpdateRecord(body) {
  body = safeObject(body);
  const errors = unknownFieldErrors(body);

  if (body.date !== undefined) {
    const e = isValidDate(body.date);
    if (e) errors.date = e;
  }

  if (body.meals_served !== undefined) {
    const e = isNonNegativeInteger(body.meals_served);
    if (e) errors.meals_served = e;
  }

  const numericFields = ['rice_kg', 'dal_kg', 'vegetables_kg', 'stock_balance', 'cost_per_meal', 'rice_per_meal'];
  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const e = isNonNegativeNumber(body[field]);
      if (e) errors[field] = e;
    }
  }

  if (body.status !== undefined) {
    const e = isValidStatus(body.status);
    if (e) errors.status = e;
  }

  return Object.keys(errors).length ? errors : null;
}

/**
 * Validate query params for GET /records
 * Returns an object of { field: errorMessage } or null if valid.
 */
function validateListQuery(query) {
  const errors = {};

  if (query.date) {
    const e = isValidDate(query.date);
    if (e) errors.date = e;
  }

  if (query.month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) errors.month = 'must be YYYY-MM';
  }

  if (query.status) {
    const e = isValidStatus(query.status);
    if (e) errors.status = e;
  }

  if (query.sort && !SORT_FIELDS.includes(query.sort)) errors.sort = 'is not sortable';
  if (query.order && !['ASC', 'DESC'].includes(query.order.toUpperCase())) errors.order = 'must be ASC or DESC';

  if (query.page !== undefined) {
    if (!/^\d+$/.test(query.page) || Number(query.page) < 1) errors.page = 'must be a positive integer';
  }

  if (query.limit !== undefined) {
    if (!/^\d+$/.test(query.limit) || Number(query.limit) < 1 || Number(query.limit) > 200) {
      errors.limit = 'must be between 1 and 200';
    }
  }

  return Object.keys(errors).length ? errors : null;
}

/**
 * Validate POST /chat body.
 */
function validateChatMessage(body) {
  body = safeObject(body);
  const errors = {};
  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    errors.message = 'required, must be a non-empty string';
  } else if (body.message.trim().length > 1000) {
    errors.message = 'must be 1000 characters or fewer';
  }
  return Object.keys(errors).length ? errors : null;
}

module.exports = {
  validateCreateRecord,
  validateUpdateRecord,
  validateListQuery,
  validateChatMessage,
};
