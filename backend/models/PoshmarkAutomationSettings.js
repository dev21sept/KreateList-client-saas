const mongoose = require('mongoose');

// Per-user, per-feature settings for the Poshmark Automation module (Share, Follow, Relist, Offers).
// One document per (user, feature) pair - connecting a Poshmark account does not enable any feature;
// each one has its own enabled/schedule/rules state, matching the "independent feature toggles" rule.
const poshmarkAutomationSettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  feature: {
    type: String,
    enum: ['share_closet', 'follow_users', 'relist', 'offers_to_likers'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  paused: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  // Human-readable cron-like schedule, e.g. { hour: 10, minute: 0 } for a daily run at 10:00 local time.
  schedule: {
    hour: { type: Number, default: 10, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 }
  },
  approvalMode: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual'
  },
  // Feature-specific config (filters, limits, discount rules, etc). Validated by the controller against
  // a per-feature shape before save, not enforced at the schema level (keeps this one model reusable
  // across all 4 features instead of one collection per feature).
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastRunAt: Date,
  nextRunAt: Date,
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

poshmarkAutomationSettingsSchema.index({ user: 1, feature: 1 }, { unique: true });

module.exports = mongoose.model('PoshmarkAutomationSettings', poshmarkAutomationSettingsSchema);
