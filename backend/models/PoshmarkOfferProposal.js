const mongoose = require('mongoose');

const poshmarkOfferProposalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  targetUsername: {
    type: String,
    required: true
  },
  originalPrice: {
    type: Number,
    required: true
  },
  proposedPrice: {
    type: Number,
    required: true
  },
  shippingDiscount: {
    type: Number,
    default: 0
  },
  estimatedEarnings: {
    type: Number,
    required: true
  },
  minimumEarnings: {
    type: Number,
    required: true
  },
  ruleVersion: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'blocked', 'submitted', 'confirmed', 'failed', 'uncertain'],
    default: 'pending_approval'
  },
  blockedReason: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  submittedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

poshmarkOfferProposalSchema.index({ user: 1, status: 1 });
poshmarkOfferProposalSchema.index({ listing: 1, targetUsername: 1 });

module.exports = mongoose.model('PoshmarkOfferProposal', poshmarkOfferProposalSchema);
