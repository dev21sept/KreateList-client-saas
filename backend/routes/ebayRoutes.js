const express = require('express');
const {
  getEbayAuthUrl,
  ebayCallback,
  getEbayStatus,
  disconnectEbay,
  getEbayPolicies,
  handleDeletionNotification,
  syncOrders,
  syncInventory,
  getInventoryLocations,
  getCategoryConditions,
  suggestCategories,
  getCategoryAspects,
  getSyncedInventory
} = require('../controllers/ebayController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public Compliance Webhook for eBay Deletion
router.get('/deletion', handleDeletionNotification);
router.post('/deletion', handleDeletionNotification);

// Protected eBay Connection Routes
router.get('/auth', protect, getEbayAuthUrl);
router.get('/callback', ebayCallback); // Public GET for direct eBay redirects
router.post('/callback', protect, ebayCallback); // Protected POST for React callbacks
router.get('/status', protect, getEbayStatus);
router.get('/policies', protect, getEbayPolicies);
router.delete('/disconnect', protect, disconnectEbay);

// Sync and Auxiliary Routes
router.post('/sync/orders', protect, syncOrders);
router.post('/sync/inventory', protect, syncInventory);
router.get('/inventory', protect, getSyncedInventory);
router.get('/locations', protect, getInventoryLocations);
router.get('/conditions', protect, getCategoryConditions);
router.get('/categories/suggest', protect, suggestCategories);
router.get('/categories/:id/aspects', protect, getCategoryAspects);

module.exports = router;
