const express = require('express');
const {
  getPlans,
  createCheckoutSession,
  handleWebhook,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getTokenUsage,
  getTokenRecords
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/plans', getPlans);
router.post('/checkout', express.json(), protect, createCheckoutSession);
// Raw body parsing is mounted in server.js before the global JSON parser so
// Stripe can verify the webhook signature.
router.post('/webhook', handleWebhook);

// Token routes
router.get('/token-usage', protect, getTokenUsage);
router.get('/token-records', protect, getTokenRecords);

// Razorpay routes
router.post('/razorpay/order', protect, createRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);

module.exports = router;

