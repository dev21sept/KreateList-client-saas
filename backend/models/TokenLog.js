const mongoose = require('mongoose');

const tokenLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  feature: {
    type: String,
    required: true
  },
  itemTitle: {
    type: String,
    default: ''
  },
  sku: {
    type: String,
    default: ''
  },
  platform: {
    type: String,
    default: 'universal'
  },
  tokensDeducted: {
    type: Number,
    default: 1
  },
  tokensRemaining: {
    type: Number,
    required: true
  },
  billingMonth: {
    type: String, // format 'YYYY-MM', e.g. '2026-09'
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.models.TokenLog || mongoose.model('TokenLog', tokenLogSchema);
