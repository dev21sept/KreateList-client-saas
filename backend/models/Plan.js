const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  stripePriceId: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  features: [String],
  limits: {
    listingsPerMonth: Number,
    ebayAccounts: Number,
    isRuleEngineEnabled: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Plan', planSchema);
