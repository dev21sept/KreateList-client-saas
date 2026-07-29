const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  etsyConnect,
  etsyCallback,
  etsyDisconnect,
  syncEtsyInventory,
  etsyPublish,
  getEtsyShippingProfiles,
  getEtsyCategoryProperties,
  resolveEtsyCategory
} = require('../controllers/etsyController');

router.get('/connect', protect, etsyConnect);
router.get('/callback', etsyCallback); // OAuth callback must be public
router.post('/disconnect', protect, etsyDisconnect);
router.post('/sync', protect, syncEtsyInventory);
router.post('/publish/:id', protect, etsyPublish);
router.get('/shipping-profiles', protect, getEtsyShippingProfiles);
router.get('/categories/:id/properties', protect, getEtsyCategoryProperties);
router.get('/resolve-category', protect, resolveEtsyCategory);

module.exports = router;
