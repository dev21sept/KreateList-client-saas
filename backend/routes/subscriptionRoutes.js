const express = require('express');
const {
  getPlans,
  createCheckoutSession,
  handleWebhook
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/plans', getPlans);
router.post('/checkout', express.json(), protect, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
