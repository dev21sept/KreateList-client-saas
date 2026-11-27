const mongoose = require('mongoose');

const webhookEndpointSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: true
  },
  // The signing secret itself - never return this once set after creation.
  secret: {
    type: String,
    required: true
  },
  subscribedEvents: {
    type: [String],
    default: ['listing.status_changed']
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

webhookEndpointSchema.index({ user: 1, status: 1 });

module.exports = mongoose.models.WebhookEndpoint || mongoose.model('WebhookEndpoint', webhookEndpointSchema);
