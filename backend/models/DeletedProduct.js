const mongoose = require('mongoose');

const deletedProductSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sku: String,
  title: String,
  source: {
    type: String,
    default: 'ebay'
  },
  deleted_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DeletedProduct', deletedProductSchema);
