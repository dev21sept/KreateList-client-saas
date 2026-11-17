const mongoose = require('mongoose');

// Append-only: nothing in this codebase ever updates or deletes an AgentAuditEvent.
const agentAuditEventSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentTask',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actor: {
    type: String, // 'user' | 'agent' | 'system'
    required: true
  },
  action: {
    type: String,
    required: true
  },
  beforeRef: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  afterRef: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  occurredAt: {
    type: Date,
    default: Date.now
  }
});

agentAuditEventSchema.index({ task: 1, occurredAt: 1 });

module.exports = mongoose.models.AgentAuditEvent || mongoose.model('AgentAuditEvent', agentAuditEventSchema);
