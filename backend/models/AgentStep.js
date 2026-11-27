const mongoose = require('mongoose');

const agentStepSchema = new mongoose.Schema({
  planVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentPlanVersion',
    required: true
  },
  sequence: {
    type: Number,
    required: true
  },
  toolName: {
    type: String,
    required: true
  },
  inputJson: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'succeeded', 'failed', 'skipped'],
    default: 'pending'
  },
  outputRef: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  startedAt: Date,
  finishedAt: Date
});

agentStepSchema.index({ planVersion: 1, sequence: 1 });

module.exports = mongoose.models.AgentStep || mongoose.model('AgentStep', agentStepSchema);
