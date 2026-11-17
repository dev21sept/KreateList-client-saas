const mongoose = require('mongoose');

const integrationOperationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  idempotencyKey: {
    type: String,
    default: null
  },
  operationType: {
    type: String,
    required: true
  },
  payloadHash: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'succeeded', 'partial', 'failed', 'cancelled'],
    default: 'queued'
  },
  resultJson: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Lets a repeated request with the same idempotency key return the original operation instead of a duplicate.
integrationOperationSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
integrationOperationSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.IntegrationOperation || mongoose.model('IntegrationOperation', integrationOperationSchema);
