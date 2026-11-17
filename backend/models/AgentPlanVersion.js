const mongoose = require('mongoose');

// Immutable once created: a new plan revision is always a new document, never an
// edit to an existing one, so an AgentApproval can safely bind to a (planVersionId, planHash) pair.
const agentPlanVersionSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentTask',
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  planJson: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  planHash: {
    type: String,
    required: true
  },
  modelVersion: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

agentPlanVersionSchema.index({ task: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.AgentPlanVersion || mongoose.model('AgentPlanVersion', agentPlanVersionSchema);
