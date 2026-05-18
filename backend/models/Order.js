const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  ebayOrderId: String,
  sellerId: String,
  buyerUsername: String,
  totalAmount: Number,
  currency: String,
  status: String,
  paymentStatus: String,
  createdDate: Date,
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
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);
