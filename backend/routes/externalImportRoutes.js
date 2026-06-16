const express = require('express');
const { 
  importExternalCloset, 
  connectPlatform, 
  publishListingToPlatform,
  getLiveChannelInventory,
  getDebugListing
} = require('../controllers/externalImportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/debug-listing/:id', getDebugListing);

// All import routes are protected (require authentication)
router.use(protect);

router.post('/import', importExternalCloset);
router.post('/connect', connectPlatform);
router.post('/publish/:id', publishListingToPlatform);
router.get('/live', getLiveChannelInventory);

module.exports = router;
