const mongoose = require('mongoose');

// One row per listing or target (a follow target, an offer recipient) within a job.
const automationJobItemSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutomationJob',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    enum: ['poshmark', 'ebay', 'mercari', 'etsy', 'amazon'],
    required: true,
    default: 'poshmark'
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  // Only set for Follow (a platform username/id, not one of our own listings).
  targetUsername: String,
  action: {
    type: String,
    enum: ['share', 'follow', 'relist', 'offer'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'skipped', 'unsupported', 'uncertain'],
    default: 'pending'
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  errorCode: String,
  // Safe response metadata only (status codes, counts) - never raw cookies/tokens/full HTML.
  resultMeta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  processedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

automationJobItemSchema.index({ job: 1, status: 1 });
automationJobItemSchema.index({ job: 1, listing: 1 });

module.exports = mongoose.model('AutomationJobItem', automationJobItemSchema);
