const mongoose = require('mongoose');

// Per-user, per-platform, per-feature settings for the Automation module (Share, Follow, Relist, Offers
// across eBay/Poshmark/Mercari/Etsy/Amazon). One document per (user, platform, feature) triple -
// connecting a platform account does not enable any feature; each one has its own
// enabled/schedule/rules state, matching the "independent feature toggles" rule.
const automationSettingsSchema = new mongoose.Schema({
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
  // across every platform/feature combination instead of one collection per feature).
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

automationSettingsSchema.index({ user: 1, platform: 1, feature: 1 }, { unique: true });

module.exports = mongoose.model('AutomationSettings', automationSettingsSchema);
