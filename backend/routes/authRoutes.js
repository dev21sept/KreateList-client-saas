const express = require('express');
const {
  register,
  login,
  getMe,
  updateSubscription
} = require('../controllers/authController');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/subscription', protect, updateSubscription);

module.exports = router;
