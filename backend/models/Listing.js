const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  price: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: [true, 'Please add an SKU'],
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  categoryId: String,
  images: [String],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed'],
    default: 'draft'
  },
  ebayListingId: String,
  ebayUrl: String,
  errorMessage: String,
  selectedRule: String,
  selectedCondition: String,
  conditionId: String,
  selectedModel: String,
  itemSpecifics: {
    type: Map,
    of: [String]
  },
  conditionNote: String,
  packageWeight: {
    lbs: Number,
    oz: Number
  },
  packageDimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  platform: {
    type: String,
    enum: ['ebay', 'poshmark', 'vinted', 'depop'],
    default: 'ebay'
  },
  poshmarkListingId: String,
  poshmarkUrl: String,
  vintedListingId: String,
  vintedUrl: String,
  depopListingId: String,
  depopUrl: String,
  brand: String,
  originalPrice: String,
  color: String,
  styleTag: String,
  quantity: {
    type: Number,
    default: 1
  },
  size: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Listing', listingSchema);
