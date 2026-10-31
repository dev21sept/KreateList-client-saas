const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  ebayOrderId: String,
  sellerId: String,
  buyerUsername: String,
  totalAmount: Number,
  currency: String,
  status: String,
  // Profit breakdown. grossAmount/platformFeeAmount/salesTaxAmount/itemPriceAmount/buyerShippingAmount
  // come from each platform's own order API where available (real numbers, never estimated) - see
  // each platform's sync code for exactly which field they're read from. cogsAmount is never exposed
  // by any platform (a seller's own private cost), so it's always seller-entered and defaults to 0
  // until edited. shippingLabelCost (what the seller actually paid for postage) also isn't exposed by
  // any platform, but is pre-filled from buyerShippingAmount on first sync as the closest real number
  // available, and stays editable/seller-correctable after that.
  grossAmount: Number,
  itemPriceAmount: Number,
  buyerShippingAmount: Number,
  platformFeeAmount: Number,
  salesTaxAmount: Number,
  shippingLabelCost: {
    type: Number,
    default: 0
  },
  cogsAmount: {
    type: Number,
    default: 0
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  paidDate: Date,
  lineItems: [{
    lineItemId: String,
    title: String,
    sku: String,
    quantity: Number,
    price: Number,
    thumbnail: String
  }],
  shippingStep: mongoose.Schema.Types.Mixed,
  platform: {
    type: String,
    enum: ['ebay', 'depop', 'poshmark', 'etsy', 'mercari', 'amazon'],
    default: 'ebay'
  },
  orderUrl: String,
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing'
  },
  delistActions: mongoose.Schema.Types.Mixed,
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updated_at' } });

orderSchema.index({ user: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
