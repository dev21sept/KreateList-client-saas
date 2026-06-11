const express = require('express');
const { saveDrafts, publishListings, analyzeBulk } = require('../controllers/bulkListingEbayController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);

router.post('/analyze', analyzeBulk);
router.post('/save-drafts', saveDrafts);
router.post('/publish', requireActiveSubscription, publishListings);

module.exports = router;
