const crypto = require('crypto');
const ApiCredential = require('../models/ApiCredential');
const User = require('../models/User');

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Parallel to auth.js's `protect`, but for eLister Connect's public API: validates
// a Bearer API key instead of a user JWT.
exports.apiKeyAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'MISSING_API_KEY', message: 'Authorization: Bearer <api_key> is required.' } });
  }
  const key = header.slice(7).trim();
  const keyPrefix = key.slice(0, 12);

  try {
    const credential = await ApiCredential.findOne({ keyPrefix, revokedAt: null });
    if (!credential || credential.secretHash !== hashKey(key)) {
      return res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'API key is invalid or revoked.' } });
    }
    if (credential.expiresAt && credential.expiresAt <= new Date()) {
      return res.status(401).json({ error: { code: 'EXPIRED_API_KEY', message: 'API key has expired.' } });
    }

    const user = await User.findById(credential.user);
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'API key owner no longer exists.' } });
    }

    req.user = user;
    req.apiCredential = credential;
    req.apiScopes = credential.scopes || [];
    credential.lastUsedAt = new Date();
    credential.save().catch(() => {});

    next();
  } catch (err) {
    console.error('[apiKeyAuth] error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to validate API key.' } });
  }
};

exports.requireScope = (scope) => (req, res, next) => {
  if (!req.apiScopes || !req.apiScopes.includes(scope)) {
    return res.status(403).json({ error: { code: 'INSUFFICIENT_SCOPE', message: `This key does not have the '${scope}' scope.` } });
  }
  next();
};

exports.hashKey = hashKey;
