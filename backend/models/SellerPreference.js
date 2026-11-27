const mongoose = require('mongoose');

const sellerPreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  key: {
    type: String,
    required: true
  },
  explicitValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  inferredValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  confidence: {
    type: Number,
    default: 0
  },
  evidenceCount: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    enum: ['explicit', 'inferred'],
    default: 'inferred'
  },
  version: {
    type: Number,
    default: 1
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

sellerPreferenceSchema.index({ user: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.SellerPreference || mongoose.model('SellerPreference', sellerPreferenceSchema);
