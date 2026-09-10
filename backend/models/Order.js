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
    enum: ['ebay', 'depop', 'poshmark', 'etsy', 'mercari'],
    default: 'ebay'
  },
  orderUrl: String,
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updated_at' } });

orderSchema.index({ user: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
