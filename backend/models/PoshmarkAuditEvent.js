const mongoose = require('mongoose');

// Security/operational audit trail for the automation module. Auto-deletes after 7 days via the TTL
// index below (MongoDB's own background task removes expired docs - no cron/cleanup script needed),
// so this can log generously without becoming the next disk-full incident.
const poshmarkAuditEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PoshmarkAutomationJob',
    default: null
  },
  actorType: {
    type: String,
    enum: ['user', 'system', 'worker'],
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  // Never store cookies, tokens, or raw HTML here - status codes, counts, and IDs only.
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

poshmarkAuditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
poshmarkAuditEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('PoshmarkAuditEvent', poshmarkAuditEventSchema);
