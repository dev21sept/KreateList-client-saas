const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  amazonConnect,
  amazonCallback,
  amazonDisconnect,
  amazonPublish,
  syncAmazonInventory,
  getSyncedInventory
} = require('../controllers/amazonController');

router.get('/connect', protect, amazonConnect);
router.get('/callback', amazonCallback); // Public OAuth callback
router.post('/disconnect', protect, amazonDisconnect);
router.post('/publish/:id', protect, amazonPublish);
router.post('/sync', protect, syncAmazonInventory);
router.get('/inventory', protect, getSyncedInventory);

module.exports = router;
