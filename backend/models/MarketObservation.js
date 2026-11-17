const mongoose = require('mongoose');

// Scoped to the owning seller: this app currently has no cross-tenant licensed
// market-data feed (services/pricing/soldDataConnector.js reports sold data as
// unavailable unless EBAY_SOLD_DATA_PROVIDER_URL is configured), so Market Pulse's
// only legitimately-sourced evidence in this slice is the seller's own already-synced
// listing/sold data. A `user` field is therefore required, unlike the spec's
// tenant-agnostic global market_observation table.
const marketObservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourcePlatform: {
    type: String,
    required: true
  },
  listingRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  observedAt: {
    type: Date,
    required: true
  },
  ingestedAt: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    default: 'Uncategorized'
  },
  brand: {
    type: String,
    default: ''
  },
  condition: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: 'USD'
  },
  metricType: {
    type: String,
    enum: ['sold_price', 'asking_price'],
    required: true
  },
  value: {
    type: Number,
    required: true
  }
});

// One observation per listing+metricType: re-ingestion must update, not duplicate.
marketObservationSchema.index({ user: 1, listingRef: 1, metricType: 1 }, { unique: true, sparse: true });
marketObservationSchema.index({ user: 1, category: 1, brand: 1, metricType: 1, observedAt: -1 });

module.exports = mongoose.models.MarketObservation || mongoose.model('MarketObservation', marketObservationSchema);
