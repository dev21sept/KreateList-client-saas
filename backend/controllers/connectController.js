const crypto = require('crypto');
const ApiCredential = require('../models/ApiCredential');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const IntegrationOperation = require('../models/IntegrationOperation');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const { hashKey } = require('../middleware/apiKeyAuth');
const { createOperation, processListingOperation, setInventory, getInventory } = require('../services/connectService');
const { assertSafeWebhookUrl } = require('../services/webhookUrlValidator');

// --- Developer credentials (JWT-authenticated, tenant admin only) ---

exports.createApiCredential = async (req, res) => {
  try {
    const { name, scopes } = req.body;
    const rawKey = `ec_${crypto.randomBytes(24).toString('hex')}`;
    const credential = await ApiCredential.create({
      user: req.user.id,
      name: name || 'Default key',
      keyPrefix: rawKey.slice(0, 12),
      secretHash: hashKey(rawKey),
      scopes: Array.isArray(scopes) && scopes.length ? scopes : ['products:read', 'listings:read']
    });
    // The plaintext key is shown exactly once; only its hash is ever stored.
    res.status(201).json({ success: true, apiKey: rawKey, credential: { id: credential._id, name: credential.name, scopes: credential.scopes, createdAt: credential.createdAt } });
  } catch (err) {
    console.error('[connectController] createApiCredential error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create API credential' });
  }
};

exports.listApiCredentials = async (req, res) => {
  const credentials = await ApiCredential.find({ user: req.user.id }).select('-secretHash').sort({ createdAt: -1 });
  res.json({ success: true, credentials });
};

exports.revokeApiCredential = async (req, res) => {
  const credential = await ApiCredential.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!credential) return res.status(404).json({ success: false, message: 'Credential not found' });
  res.json({ success: true, credential: { id: credential._id, revokedAt: credential.revokedAt } });
};

// --- Public v1 API (apiKeyAuth-authenticated) ---

exports.createListingOperation = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || null;
    const operation = await createOperation(req.user.id, {
      idempotencyKey,
      operationType: 'listing.create',
      payload: req.body
    });

    if (operation.status === 'queued') {
      processListingOperation(operation, req.body).catch(e => console.error('[connect] async listing op failed:', e.message));
    }

    res.status(202).json({
      operation_id: operation._id,
      status: operation.status,
      resource: `/api/connect/v1/operations/${operation._id}`,
      request_id: `req_${crypto.randomUUID()}`
    });
  } catch (err) {
    if (err.code === 'IDEMPOTENCY_KEY_CONFLICT') {
      return res.status(409).json({ error: { code: err.code, message: err.message } });
    }
    console.error('[connectController] createListingOperation error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to queue listing operation.' } });
  }
};

exports.getOperation = async (req, res) => {
  const operation = await IntegrationOperation.findOne({ _id: req.params.id, user: req.user.id });
  if (!operation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Operation not found.' } });
  res.json({
    operation_id: operation._id,
    status: operation.status,
    operation_type: operation.operationType,
    result: operation.resultJson
  });
};

exports.setInventory = async (req, res) => {
  try {
    const { quantity, expected_version: expectedVersion } = req.body;
    const result = await setInventory(req.user.id, req.params.sku, { quantity, expectedVersion });
    res.json(result);
  } catch (err) {
    if (err.code === 'INVENTORY_VERSION_CONFLICT') {
      return res.status(409).json({ error: { code: err.code, message: err.message, request_id: `req_${crypto.randomUUID()}`, retryable: false, details: { current_version: err.currentVersion } } });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { code: err.code, message: err.message } });
    }
    console.error('[connectController] setInventory error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update inventory.' } });
  }
};

exports.getInventory = async (req, res) => {
  const result = await getInventory(req.user.id, req.params.sku);
  if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No listing found for this SKU.' } });
  res.json(result);
};

exports.getOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ orders });
};

exports.registerWebhookEndpoint = async (req, res) => {
  try {
    const { url, subscribed_events: subscribedEvents } = req.body;
    await assertSafeWebhookUrl(url);
    const secret = crypto.randomBytes(32).toString('hex');
    const endpoint = await WebhookEndpoint.create({
      user: req.user.id,
      url,
      secret,
      subscribedEvents: Array.isArray(subscribedEvents) && subscribedEvents.length ? subscribedEvents : ['listing.status_changed']
    });
    // Signing secret is shown exactly once, matching the API-key pattern above.
    res.status(201).json({ id: endpoint._id, url: endpoint.url, signing_secret: secret, subscribed_events: endpoint.subscribedEvents });
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_WEBHOOK_URL', message: err.message } });
  }
};
