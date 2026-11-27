const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getTrends, getComparables, getBrands, refresh } = require('../controllers/marketPulseController');

// Deterministic DB reads, not LLM calls - no AI token gate, per the spec's
// "AI must not generate trend percentages, sold prices or sample counts" rule.
router.get('/trends', protect, getTrends);
router.get('/prices/comparables', protect, getComparables);
router.get('/brands', protect, getBrands);
router.post('/refresh', protect, refresh);

module.exports = router;
