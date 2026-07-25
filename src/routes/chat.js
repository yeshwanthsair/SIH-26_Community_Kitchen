'use strict';

const { Router } = require('express');
const { postChat } = require('../controllers/chatController');

const router = Router();

// POST /api/chat
router.post('/', postChat);

module.exports = router;
