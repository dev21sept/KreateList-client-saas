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
  delistAllPlatforms,
  deletePlatformListing,
  moveToNewItem,
  mergeChannel,
  getActiveChannelImportPreview,
  importActiveChannelsToLocal,
  getLocalMergePreview,
  bulkMergeListings,
  forceDelistPoshmark,
  forceRelistPoshmark,
  cleanDuplicatePoshmarkListings,
  reconcileChannelInventory,
  cleanGhostChannels,
  syncAllInventory,
  getSyncSummary,
  dismissSyncSummary
} = require('../controllers/listingController');
const { protect, authorize } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);

// Operational maintenance endpoints are intentionally kept on their existing
// paths for compatibility, but they must never be callable by normal users.
router.get('/admin/force-delist-poshmark', authorize('admin'), forceDelistPoshmark);
router.get('/admin/force-relist-poshmark', authorize('admin'), forceRelistPoshmark);
router.get('/admin/clean-duplicates', authorize('admin'), cleanDuplicatePoshmarkListings);
router.get('/admin/reconcile-all', authorize('admin'), reconcileChannelInventory);
router.get('/admin/clean-ghost-channels', authorize('admin'), cleanGhostChannels);

router.get('/sync-summary', getSyncSummary);
router.post('/sync-summary/dismiss', dismissSyncSummary);
router.post('/sync-all', requireActiveSubscription, syncAllInventory);
router.post('/check-duplicate', checkDuplicateListing);
router.get('/stats', getDashboardStats);
router.post('/merge-channel', requireActiveSubscription, mergeChannel);
router.get('/active-channel-preview', getActiveChannelImportPreview);
router.post('/import-active-channels', requireActiveSubscription, importActiveChannelsToLocal);
router.get('/local-merge-preview', getLocalMergePreview);
router.post('/bulk-merge', requireActiveSubscription, bulkMergeListings);

// Background merge scan: start returns at once; poll the GET for suggestions (suggestions only, nothing is merged).
const { startMergeScan, getMergeScan } = require('../services/mergeScanJob');
router.post('/merge-scan', (req, res) => res.status(202).json({ success: true, data: startMergeScan(req.user.id) }));
router.get('/merge-scan', (req, res) => res.json({ success: true, data: getMergeScan(req.user.id) }));

router.route('/')
  .get(getListings)
  .post(requireActiveSubscription, createListing);

router.route('/:id')
  .get(getListing)
  .put(updateListing)
  .delete(deleteListing);

router.post('/:id/publish', requireActiveSubscription, publishListing);
router.post('/:id/delist', requireActiveSubscription, delistListing);
router.post('/:id/delist-all', requireActiveSubscription, delistAllPlatforms);
router.post('/:id/delete-platform', requireActiveSubscription, deletePlatformListing);
router.post('/:id/move-to-new-item', requireActiveSubscription, moveToNewItem);
router.post('/:id/verify-live', verifyListingLive);
router.get('/:id/cross-list-prep', require('../controllers/crossListController').prepareCrossList);

module.exports = router;
