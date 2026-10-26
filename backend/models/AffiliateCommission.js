const mongoose = require('mongoose');

// Append-only commission ledger (per the developer guide's "never store only an editable balance"
// rule) - one entry per qualifying payment event. The affiliate's/admin's running totals are read
// from this collection or the denormalized counters on AffiliateProfile, never written to directly.
const affiliateCommissionSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateProfile',
    required: true
  },
  affiliateUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Denormalized so the admin/affiliate list reads fast without a populate on every row.
  referredUserName: String,
  referredUserEmail: String,
  plan: String,
  paymentAmount: {
    type: Number,
    required: true
  },
  commissionRate: {
    type: Number,
    default: 0.10
  },
  commissionAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['approved', 'reversed'],
    default: 'approved'
  },
  // The Stripe subscription id (+period) or Razorpay payment id that earned this entry - a unique
  // index on (affiliate, sourceRef) stops a webhook retry from double-crediting the same payment.
  sourceRef: {
    type: String,
    required: true
  },
  reversedReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

affiliateCommissionSchema.index({ affiliate: 1, sourceRef: 1 }, { unique: true });
affiliateCommissionSchema.index({ affiliate: 1, createdAt: -1 });

module.exports = mongoose.model('AffiliateCommission', affiliateCommissionSchema);
