const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  etsyConnect,
  etsyCallback,
  etsyDisconnect,
  syncEtsyInventory,
  etsyPublish
} = require('../controllers/etsyController');

router.get('/connect', protect, etsyConnect);
router.get('/callback', etsyCallback); // OAuth callback must be public
router.post('/disconnect', protect, etsyDisconnect);
router.post('/sync', protect, syncEtsyInventory);
router.post('/publish/:id', protect, etsyPublish);

module.exports = router;
