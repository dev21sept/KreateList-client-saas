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
  resetPassword
} = require('../controllers/authController');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);
router.put('/subscription', protect, updateSubscription);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;
