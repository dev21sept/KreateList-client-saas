const mongoose = require('mongoose');

const agentTaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  goalText: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: [
      'draft', 'awaiting_approval', 'approved', 'queued', 'running', 'verifying',
      'completed', 'partially_completed', 'failed', 'cancelled', 'rejected', 'expired'
    ],
    default: 'draft'
  },
  riskLevel: {
    type: String,
    enum: ['read_only', 'draft_only', 'low_impact_write', 'external_write', 'financial', 'irreversible'],
    default: 'read_only'
  },
  activePlanVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentPlanVersion',
    default: null
  },
  resultSummary: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  deadlineAt: {
    type: Date,
    default: null
  }
});

agentTaskSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.AgentTask || mongoose.model('AgentTask', agentTaskSchema);
