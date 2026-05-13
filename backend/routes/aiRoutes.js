const express = require('express');
const router = express.Router();
const { analyzeListing, saveAiListing, searchCategories } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.post('/analyze', protect, analyzeListing);
router.post('/save', protect, saveAiListing);
router.get('/categories', protect, searchCategories);

module.exports = router;
