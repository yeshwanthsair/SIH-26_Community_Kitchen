'use strict';

const { Router } = require('express');
const {
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} = require('../controllers/recordController');

const router = Router();

// GET    /api/records
router.get('/',    getRecords);

// POST   /api/records
router.post('/',   createRecord);

// PUT    /api/records/:id
router.put('/:id', updateRecord);

// DELETE /api/records/:id
router.delete('/:id', deleteRecord);

module.exports = router;
