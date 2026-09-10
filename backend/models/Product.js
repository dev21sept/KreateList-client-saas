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
  size: String,
  color: String,
  categoryId: String,
  itemSpecifics: mongoose.Schema.Types.Mixed,
  images: [String],
  selling_price: Number,
  source: {
    type: String,
    default: 'ebay'
  },
  status: {
    type: String,
    enum: ['draft', 'live', 'active', 'inactive'],
    default: 'draft'
  },
  ebayListingId: String,
  ebayUrl: String,
  poshmarkListingId: String,
  poshmarkUrl: String,
  depopListingId: String,
  depopUrl: String,
  etsyListingId: String,
  etsyUrl: String,
  mercariListingId: String,
  mercariUrl: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
