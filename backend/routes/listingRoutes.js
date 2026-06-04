const express = require('express');
const {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  publishListing,
  getDashboardStats,
  checkDuplicateListing,
  verifyListingLive
} = require('../controllers/listingController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);

router.post('/check-duplicate', checkDuplicateListing);
router.get('/stats', getDashboardStats);

router.route('/')
  .get(getListings)
  .post(requireActiveSubscription, createListing);

router.route('/:id')
  .get(getListing)
  .put(updateListing)
  .delete(deleteListing);

router.post('/:id/publish', requireActiveSubscription, publishListing);
router.post('/:id/verify-live', verifyListingLive);

module.exports = router;
