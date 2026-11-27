const mongoose = require('mongoose');

const agentApprovalSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentTask',
    required: true
  },
  planVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentPlanVersion',
    required: true
  },
  // The exact plan hash this approval was granted for. A newer plan version or any
  // change to the plan's content invalidates it - re-checked at execution time, not
  // just at approval time (mirrors the Poshmark connected-flag consistency rule).
  payloadHash: {
    type: String,
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedAt: {
    type: Date,
    default: Date.now
  }
});

agentApprovalSchema.index({ task: 1, planVersionId: 1 }, { unique: true });

module.exports = mongoose.models.AgentApproval || mongoose.model('AgentApproval', agentApprovalSchema);
