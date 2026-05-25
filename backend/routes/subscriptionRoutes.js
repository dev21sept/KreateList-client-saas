const express = require('express');
const {
  getPlans,
  createCheckoutSession,
  handleWebhook,
  createRazorpayOrder,
  verifyRazorpayPayment
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/plans', getPlans);
router.post('/checkout', express.json(), protect, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Razorpay routes
router.post('/razorpay/order', protect, createRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);

module.exports = router;
