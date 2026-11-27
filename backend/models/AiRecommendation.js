const mongoose = require('mongoose');

const aiRecommendationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  rationale: {
    type: String,
    default: ''
  },
  evidence: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  confidence: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['proposed', 'accepted', 'rejected', 'dismissed', 'executed', 'expired'],
    default: 'proposed'
  },
  feedback: {
    action: String,
    editedPayload: mongoose.Schema.Types.Mixed,
    respondedAt: Date
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

aiRecommendationSchema.index({ user: 1, status: 1, createdAt: -1 });
aiRecommendationSchema.index({ user: 1, entityId: 1, type: 1 });

module.exports = mongoose.models.AiRecommendation || mongoose.model('AiRecommendation', aiRecommendationSchema);
