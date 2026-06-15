const express = require('express');
const { 
  importExternalCloset, 
  connectPlatform, 
  publishListingToPlatform 
} = require('../controllers/externalImportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All import routes are protected (require authentication)
router.use(protect);

router.post('/import', importExternalCloset);
router.post('/connect', connectPlatform);
router.post('/publish/:id', publishListingToPlatform);

module.exports = router;
