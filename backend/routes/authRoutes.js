const express = require('express');
const {
  register,
  login,
  getMe,
  updateSubscription,
  verifyOtp,
  resendOtp,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  resetPasswordWithOtp
} = require('../controllers/authController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);
router.post('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);
// Subscription state may only be changed by an administrator. Customer
// upgrades are handled by the verified payment endpoints/webhooks.
router.put('/subscription', protect, authorize('admin'), updateSubscription);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;
