const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');
const {
  createApiCredential,
  listApiCredentials,
  revokeApiCredential,
  createListingOperation,
  getOperation,
  setInventory,
  getInventory,
  getOrders,
  registerWebhookEndpoint
} = require('../controllers/connectController');

// Developer portal (session-authenticated tenant admin manages their own keys/webhooks).
router.post('/credentials', protect, createApiCredential);
router.get('/credentials', protect, listApiCredentials);
router.post('/credentials/:id/revoke', protect, revokeApiCredential);

// Public v1 API (API-key authenticated external integrations).
router.post('/v1/listings', apiKeyAuth, requireScope('listings:write'), createListingOperation);
router.get('/v1/operations/:id', apiKeyAuth, getOperation);
router.put('/v1/inventory/:sku', apiKeyAuth, requireScope('inventory:write'), setInventory);
router.get('/v1/inventory/:sku', apiKeyAuth, requireScope('inventory:read'), getInventory);
router.get('/v1/orders', apiKeyAuth, requireScope('orders:read'), getOrders);
router.post('/v1/webhooks/endpoints', apiKeyAuth, requireScope('webhooks:manage'), registerWebhookEndpoint);

module.exports = router;
