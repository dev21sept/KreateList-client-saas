const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  sku: String,
  brand: String,
  images: [String],
  selling_price: Number,
  source: {
    type: String,
    default: 'ebay'
  },
  status: {
    type: String,
    enum: ['draft', 'live'],
    default: 'draft'
  },
  ebayListingId: String,
  ebayUrl: String,
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
