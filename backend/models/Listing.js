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
    default: '',
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  categoryId: String,
  departmentId: String,
  subcategoryIds: [String],
  images: [String],
  thumbnail: String,
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed', 'delisted', 'sold'],
    default: 'draft'
  },
  ebayListingId: String,
  // Background sync to other marketplaces runs only when the user turns it on for this listing.
  poshmarkAutoSync: { type: Boolean, default: false },
  depopAutoSync: { type: Boolean, default: false },
  ebayUrl: String,
  errorMessage: String,
  selectedRule: String,
  selectedCondition: String,
  conditionId: String,
  selectedModel: String,
  fulfillmentPolicyId: String,
  paymentPolicyId: String,
  returnPolicyId: String,
  locationKey: String,
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
    enum: ['ebay', 'poshmark', 'etsy', 'depop', 'mercari', 'amazon'],
    default: 'ebay'
  },
  poshmarkListingId: String,
  // Visual hash (dHash) of the first photo, cached by the merge scan so each photo is downloaded once.
  imageHash: String,
  // Set when a verified merge folds this record into another one (mergedInto). The record is kept,
  // not deleted, and is hidden from the Master list; unsetting this field restores it.
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  poshmarkUrl: String,
  etsyListingId: String,
  etsyUrl: String,
  depopListingId: String,
  depopUrl: String,
  mercariListingId: String,
  mercariUrl: String,
  amazonListingId: String,
  amazonAsin: String,
  amazonUrl: String,
  amazonProductType: String,
  amazonBulletPoints: [String],
  amazonGenericKeywords: [String],
  amazonCondition: String,
  amazonStandardProductId: {
    idType: String,
    value: String
  },
  brand: String,
  brandId: String,
  shippingPayer: String,
  shippingMethod: String,
  shippingWeightLbs: Number,
  shippingWeightOz: Number,
  shippingFitsShoebox: Boolean,
  shippingLength: Number,
  shippingWidth: Number,
  shippingHeight: Number,
  shippingCarrier: String,
  shippingPrice: String,
  originalPrice: String,
  color: String,
  gender: String,
  styleTag: String,
  age: String,
  source: String,
  quantity: {
    type: Number,
    default: 1
  },
  size: String,
  sizeId: String,
  isbn: String,
  author: String,
  bookTitle: String,
  videoGameRating: String,
  measurements: String,
  material: String,
  bodyFit: String,
  occasion: String,
  depopType: String,
  fastening: String,
  fit: String,
  etsyWhoMade: {
    type: String,
    default: 'i_did'
  },
  etsyWhenMade: {
    type: String,
    default: '2020_2026'
  },
  etsyIsSupply: {
    type: Boolean,
    default: false
  },
  etsyRenewal: {
    type: String,
    default: 'manual'
  },
  etsyShippingProfileId: String,
  etsyAttributes: {
    type: Map,
    of: [String]
  },
  country: {
    type: String,
    default: 'India'
  },
  shippingPrice: {
    type: String,
    default: '0.00'
  },
  worldwideShipping: {
    type: Boolean,
    default: false
  },
  // Last time the status tracker checked this listing against the marketplaces.
  statusCheckedAt: Date,
  ebayStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  poshmarkStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  depopStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  etsyStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  mercariStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  amazonStatus: {
    type: String,
    enum: ['draft', 'published', 'failed', 'none', 'delisted', 'sold'],
    default: 'none'
  },
  soldOn: String,
  soldPlatform: String,
  soldAt: Date,
  soldPrice: String,
  soldOrderId: String,
  autoDelistLog: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  platformData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

listingSchema.pre('validate', function() {
  if (!this.sku || !String(this.sku).trim()) {
    this.sku = `AUTO-L-${this._id.toString().slice(-12).toUpperCase()}`;
  }
});

listingSchema.index({ user: 1, sku: 1 });
listingSchema.index({ user: 1, status: 1 });
listingSchema.index({ user: 1, ebayListingId: 1 });
listingSchema.index({ user: 1, poshmarkListingId: 1 });
listingSchema.index({ user: 1, mercariListingId: 1 });
// The main inventory list query filters on exactly these two fields and sorts by createdAt - without
// this, Mongo falls back to a broader user-only scan plus an in-memory sort, examining roughly twice
// as many documents as it returns once a user's listing count gets into the thousands.
listingSchema.index({ user: 1, mergedInto: 1, createdAt: -1 });

module.exports = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
