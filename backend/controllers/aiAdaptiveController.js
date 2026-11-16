const crypto = require('crypto');
const { recordEvent } = require('../services/behaviorEventService');
const { getLearningProfile, setExplicitPreference } = require('../services/sellerProfileService');
const {
  generatePriceReviewRecommendations,
  generateListingQualityRecommendations,
  listRecommendations,
  recordFeedback
} = require('../services/recommendationService');

exports.ingestEvent = async (req, res) => {
  try {
    const { eventType, entityType, entityId, source, metadata, idempotencyKey } = req.body;
    if (!eventType) {
      return res.status(400).json({ success: false, message: 'eventType is required' });
    }

    const event = await recordEvent({
      userId: req.user.id,
      eventType,
      entityType,
      entityId: entityId || null,
      source,
      metadata,
      idempotencyKey: idempotencyKey || crypto.randomUUID()
    });

    res.status(202).json({ success: true, eventId: event ? event._id : null });
  } catch (err) {
    console.error('[aiAdaptiveController] ingestEvent error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to record event' });
  }
};

exports.getLearningProfile = async (req, res) => {
  try {
    const preferences = await getLearningProfile(req.user.id);
    res.json({ success: true, preferences });
  } catch (err) {
    console.error('[aiAdaptiveController] getLearningProfile error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load learning profile' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required' });
    }
    const preference = await setExplicitPreference(req.user.id, key, value);
    res.json({ success: true, preference });
  } catch (err) {
    console.error('[aiAdaptiveController] updatePreferences error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update preference' });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { status } = req.query;
    const recommendations = await listRecommendations(req.user.id, { status });
    res.json({ success: true, recommendations });
  } catch (err) {
    console.error('[aiAdaptiveController] getRecommendations error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load recommendations' });
  }
};

exports.submitRecommendationFeedback = async (req, res) => {
  try {
    const { action, editedPayload } = req.body;
    const recommendation = await recordFeedback(req.user.id, req.params.id, { action, editedPayload });
    if (!recommendation) {
      return res.status(404).json({ success: false, message: 'Recommendation not found' });
    }
    res.json({ success: true, recommendation });
  } catch (err) {
    console.error('[aiAdaptiveController] submitRecommendationFeedback error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Failed to record feedback' });
  }
};

// Generates fresh recommendations on demand (also run daily by adaptiveProfileCron).
exports.refreshRecommendations = async (req, res) => {
  try {
    const [priceReviews, qualityIssues] = await Promise.all([
      generatePriceReviewRecommendations(req.user.id),
      generateListingQualityRecommendations(req.user.id)
    ]);
    res.json({ success: true, created: priceReviews.length + qualityIssues.length });
  } catch (err) {
    console.error('[aiAdaptiveController] refreshRecommendations error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to refresh recommendations' });
  }
};
