const express = require('express');
const { apply, getMe, getCommissions } = require('../controllers/affiliateController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/apply', apply);
router.get('/me', getMe);
router.get('/commissions', getCommissions);

module.exports = router;
