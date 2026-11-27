const mongoose = require('mongoose');

const sellerBehaviorEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  entityType: {
    type: String,
    default: 'listing'
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  occurredAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'web_app'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  idempotencyKey: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

sellerBehaviorEventSchema.index({ user: 1, eventType: 1, occurredAt: -1 });
// Prevents a duplicate-delivered event from being recorded twice; most events omit
// idempotencyKey, so this is sparse rather than unique-on-null.
sellerBehaviorEventSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.SellerBehaviorEvent || mongoose.model('SellerBehaviorEvent', sellerBehaviorEventSchema);
