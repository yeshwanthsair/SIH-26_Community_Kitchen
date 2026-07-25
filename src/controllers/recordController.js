'use strict';

const service  = require('../services/recordService');
const { validateCreateRecord, validateUpdateRecord, validateListQuery } = require('../utils/validate');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound } = require('../utils/response');

/**
 * GET /api/records
 * Query params: date, month, status, sort, order, page, limit
 */
function getRecords(req, res, next) {
  try {
    const errors = validateListQuery(req.query);
    if (errors) return sendBadRequest(res, 'Invalid query parameters', errors);

    const { date, month, status, sort, order, page, limit } = req.query;
    const result = service.listRecords({ date, month, status, sort, order, page, limit });
    return sendSuccess(res, result, 'Records retrieved');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/records
 */
function createRecord(req, res, next) {
  try {
    const errors = validateCreateRecord(req.body);
    if (errors) return sendBadRequest(res, 'Validation failed', errors);

    const record = service.createRecord(req.body);
    return sendCreated(res, record, 'Record created');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

/**
 * PUT /api/records/:id
 */
function updateRecord(req, res, next) {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
      return sendBadRequest(res, 'id must be a positive integer');
    }
    const id = Number(req.params.id);

    if (Object.keys(req.body).length === 0) {
      return sendBadRequest(res, 'Request body must not be empty');
    }

    const errors = validateUpdateRecord(req.body);
    if (errors) return sendBadRequest(res, 'Validation failed', errors);

    const record = service.updateRecord(id, req.body);
    return sendSuccess(res, record, 'Record updated');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

/**
 * DELETE /api/records/:id
 */
function deleteRecord(req, res, next) {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
      return sendBadRequest(res, 'id must be a positive integer');
    }
    const id = Number(req.params.id);

    const result = service.deleteRecord(id);
    return sendSuccess(res, result, 'Record deleted');
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

module.exports = { getRecords, createRecord, updateRecord, deleteRecord };
