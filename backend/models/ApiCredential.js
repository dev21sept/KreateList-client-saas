const mongoose = require('mongoose');

const apiCredentialSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    default: 'Default key'
  },
  keyPrefix: {
    type: String,
    required: true
  },
  secretHash: {
    type: String,
    required: true
  },
  scopes: {
    type: [String],
    default: ['products:read', 'listings:read']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  }
});

apiCredentialSchema.index({ keyPrefix: 1 }, { unique: true });
apiCredentialSchema.index({ user: 1, revokedAt: 1 });

module.exports = mongoose.models.ApiCredential || mongoose.model('ApiCredential', apiCredentialSchema);
