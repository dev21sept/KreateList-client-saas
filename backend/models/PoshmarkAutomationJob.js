const mongoose = require('mongoose');

// One run of one feature for one user. SQS/Fargate aren't part of this app's infra (single GCP VM,
// node-cron) - this collection IS the queue: a worker polls for status:'queued' jobs whose
// scheduledAt has passed, claims one atomically (findOneAndUpdate), and works through it. See
// services/poshmarkAutomationWorker.js for the claim logic that keeps two worker ticks from
// grabbing the same job.
const poshmarkAutomationJobSchema = new mongoose.Schema({
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
  mode: {
    type: String,
    enum: ['preview', 'execute'],
    default: 'preview'
  },
  status: {
    type: String,
    enum: ['draft', 'queued', 'running', 'awaiting_approval', 'completed', 'partially_completed', 'failed', 'cancelled', 'blocked'],
    default: 'draft'
  },
  // One run key per user+feature+scheduled occurrence prevents a cron tick from double-queuing the
  // same day's run if the worker is slow or the process restarts mid-cycle.
  runKey: {
    type: String,
    required: true
  },
  scheduledAt: Date,
  claimedAt: Date,
  startedAt: Date,
  completedAt: Date,
  attemptCount: {
    type: Number,
    default: 0
  },
  // Filled in once the eligible/excluded/unsupported/invalid counts are known (the "preview" step).
  counts: {
    eligible: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
    unsupported: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  errorMessage: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

poshmarkAutomationJobSchema.index({ user: 1, feature: 1, runKey: 1 }, { unique: true });
poshmarkAutomationJobSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('PoshmarkAutomationJob', poshmarkAutomationJobSchema);
