const mongoose = require('mongoose');

const webhookDeliverySchema = new mongoose.Schema({
  endpoint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WebhookEndpoint',
    required: true
  },
  eventId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending'
  },
  responseCode: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Delivery worker scans for due, pending deliveries.
webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
webhookDeliverySchema.index({ endpoint: 1, createdAt: -1 });

module.exports = mongoose.models.WebhookDelivery || mongoose.model('WebhookDelivery', webhookDeliverySchema);
