const mongoose = require('mongoose');

const sellerInsightSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  insightType: {
    type: String,
    required: true
  },
  relatedItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  evidence: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  score: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'dismissed', 'expired'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  }
});

sellerInsightSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.SellerInsight || mongoose.model('SellerInsight', sellerInsightSchema);
