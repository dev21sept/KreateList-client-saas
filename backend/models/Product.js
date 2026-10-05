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
  // Real Poshmark state (Poshmark only). "removed" = no longer in the closet; kept out of the lists.
  poshmarkState: {
    type: String,
    enum: ['active', 'hidden', 'sold', 'not_for_sale', 'removed'],
    default: null
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

productSchema.pre('validate', function() {
  if (!this.sku || !String(this.sku).trim()) {
    this.sku = `AUTO-P-${this._id.toString().slice(-12).toUpperCase()}`;
  }
});

productSchema.index({ user: 1, sku: 1 });
productSchema.index({ user: 1, source: 1, status: 1 });
productSchema.index({ user: 1, ebayListingId: 1 });
productSchema.index({ user: 1, poshmarkListingId: 1 });
productSchema.index({ user: 1, mercariListingId: 1 });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
