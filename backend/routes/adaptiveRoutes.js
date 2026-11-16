const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');
const {
  ingestEvent,
  getLearningProfile,
  updatePreferences,
  getRecommendations,
  submitRecommendationFeedback,
  refreshRecommendations
} = require('../controllers/aiAdaptiveController');

router.post('/events', protect, ingestEvent);
router.get('/learning-profile', protect, getLearningProfile);
router.patch('/preferences', protect, updatePreferences);
router.get('/recommendations', protect, getRecommendations);
router.post('/recommendations/:id/feedback', protect, submitRecommendationFeedback);
router.post('/recommendations/refresh', protect, requireActiveSubscription, refreshRecommendations);

module.exports = router;
