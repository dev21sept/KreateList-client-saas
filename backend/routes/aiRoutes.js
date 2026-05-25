const express = require('express');
const router = express.Router();
const { analyzeListing, saveAiListing, searchCategories } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

router.post('/analyze', protect, requireActiveSubscription, analyzeListing);
router.post('/save', protect, requireActiveSubscription, saveAiListing);
router.get('/categories', protect, searchCategories);

module.exports = router;
