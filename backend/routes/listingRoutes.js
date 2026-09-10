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
  verifyListingLive,
  delistListing,
  deletePlatformListing,
  moveToNewItem,
  mergeChannel,
  getActiveChannelImportPreview,
  importActiveChannelsToLocal,
  getLocalMergePreview,
  bulkMergeListings
} = require('../controllers/listingController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);

router.post('/check-duplicate', checkDuplicateListing);
router.get('/stats', getDashboardStats);
router.post('/merge-channel', requireActiveSubscription, mergeChannel);
router.get('/active-channel-preview', getActiveChannelImportPreview);
router.post('/import-active-channels', requireActiveSubscription, importActiveChannelsToLocal);
router.get('/local-merge-preview', getLocalMergePreview);
router.post('/bulk-merge', requireActiveSubscription, bulkMergeListings);

router.route('/')
  .get(getListings)
  .post(requireActiveSubscription, createListing);

router.route('/:id')
  .get(getListing)
  .put(updateListing)
  .delete(deleteListing);

router.post('/:id/publish', requireActiveSubscription, publishListing);
router.post('/:id/delist', requireActiveSubscription, delistListing);
router.post('/:id/delete-platform', requireActiveSubscription, deletePlatformListing);
router.post('/:id/move-to-new-item', requireActiveSubscription, moveToNewItem);
router.post('/:id/verify-live', verifyListingLive);
router.get('/:id/cross-list-prep', require('../controllers/crossListController').prepareCrossList);

module.exports = router;
