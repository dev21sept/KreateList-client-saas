const express = require('express');
const { 
  importExternalCloset, 
  connectPlatform, 
  publishListingToPlatform,
  getLiveChannelInventory
} = require('../controllers/externalImportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All import routes are protected (require authentication)
router.use(protect);

router.post('/import', importExternalCloset);
router.post('/connect', connectPlatform);
router.post('/publish/:id', publishListingToPlatform);
router.get('/live', getLiveChannelInventory);

module.exports = router;
