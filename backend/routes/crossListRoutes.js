const express = require('express');
const router = express.Router();
const { prepareCrossList } = require('../controllers/crossListController');
const { protect } = require('../middleware/auth');

router.get('/:id/cross-list-prep', protect, prepareCrossList);

module.exports = router;
