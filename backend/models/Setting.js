const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  setting_key: {
    type: String,
    required: true,
    unique: true
  },
  setting_value: {
    type: String,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Setting', settingSchema);
