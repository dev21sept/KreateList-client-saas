const express = require('express');
const {
  getEbayAuthUrl,
  ebayCallback,
  getEbayStatus,
  disconnectEbay,
  getEbayPolicies
} = require('../controllers/ebayController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/auth', protect, getEbayAuthUrl);
router.post('/callback', protect, ebayCallback);
router.get('/status', protect, getEbayStatus);
router.get('/policies', protect, getEbayPolicies);
router.delete('/disconnect', protect, disconnectEbay);

module.exports = router;
