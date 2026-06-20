const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a rule name']
  },
  title_sequence: {
    type: [String],
    default: []
  },
  description_prompt: {
    type: String,
    default: ''
  },
  description_template: {
    type: String,
    default: ''
  },
  condition_note: {
    type: String,
    default: ''
  },
  fulfillmentPolicyId: {
    type: String,
    default: ''
  },
  paymentPolicyId: {
    type: String,
    default: ''
  },
  returnPolicyId: {
    type: String,
    default: ''
  },
  locationKey: {
    type: String,
    default: ''
  },
  packageWeight: {
    lbs: { type: Number, default: 0 },
    oz: { type: Number, default: 0 }
  },
  packageDimensions: {
    length: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Rule', ruleSchema);

