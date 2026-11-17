const mongoose = require('mongoose');

const marketAggregateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String, // e.g. '2026-11' (YYYY-MM) - the window this aggregate summarizes
    required: true
  },
  marketplace: {
    type: String,
    default: 'all'
  },
  category: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    default: ''
  },
  metric: {
    type: String,
    enum: ['sold_price', 'asking_price'],
    required: true
  },
  sampleCount: {
    type: Number,
    default: 0
  },
  median: Number,
  p25: Number,
  p75: Number,
  sellThroughProxy: Number,
  trendPct: Number,
  trendClassification: {
    type: String,
    enum: ['rising', 'stable', 'declining', 'insufficient_data'],
    default: 'insufficient_data'
  },
  computedAt: {
    type: Date,
    default: Date.now
  }
});

marketAggregateSchema.index({ user: 1, period: 1, category: 1, brand: 1, metric: 1 }, { unique: true });

module.exports = mongoose.models.MarketAggregate || mongoose.model('MarketAggregate', marketAggregateSchema);
