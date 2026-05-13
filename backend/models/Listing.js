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
  sku: String,
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Listing', listingSchema);
