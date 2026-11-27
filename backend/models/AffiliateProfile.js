const mongoose = require('mongoose');

// One affiliate profile per eLister user - reuses the existing account/auth system instead of
// building a separate affiliate signup/login (the developer guide's standalone-portal design assumes
// a brand new auth stack; any existing eLister user can apply to become an affiliate from their own
// dashboard instead).
const affiliateProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'suspended', 'rejected'],
    default: 'pending'
  },
  statusReason: String,
  // Denormalized counters, updated alongside each AffiliateCommission write - keeps the affiliate's
  // own dashboard and the admin list fast without summing the ledger on every page load.
  totalReferred: {
    type: Number,
    default: 0
  },
  totalCommissionEarned: {
    type: Number,
    default: 0
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AffiliateProfile', affiliateProfileSchema);
