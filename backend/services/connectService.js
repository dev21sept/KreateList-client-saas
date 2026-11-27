const crypto = require('crypto');
const Listing = require('../models/Listing');
const IntegrationOperation = require('../models/IntegrationOperation');
const { recordEvent } = require('./behaviorEventService');
const { enqueueWebhookEvent } = require('./webhookDeliveryService');

const hashPayload = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

/**
 * Creates (or returns the existing) IntegrationOperation for an idempotency key,
 * so a retried request never double-creates a listing or double-moves stock.
 */
async function createOperation(userId, { idempotencyKey, operationType, payload }) {
  const payloadHash = hashPayload(payload);

  if (idempotencyKey) {
    const existing = await IntegrationOperation.findOne({ user: userId, idempotencyKey });
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        const err = new Error('Idempotency key reused with a different payload.');
        err.code = 'IDEMPOTENCY_KEY_CONFLICT';
        throw err;
      }
      return existing;
    }
  }

  return IntegrationOperation.create({
    user: userId,
    idempotencyKey: idempotencyKey || null,
    operationType,
    payloadHash,
    status: 'queued'
  });
}

/**
 * Maps an external listing-create/update payload onto the canonical Listing model.
 * Runs asynchronously (fire-and-forget from the controller's point of view) so the
 * public API request returns immediately with an operation_id, per the spec's
 * "do not keep public requests open while marketplaces process work" rule.
 */
async function processListingOperation(operation, externalPayload) {
  operation.status = 'processing';
  operation.updatedAt = new Date();
  await operation.save();

  try {
    let listing;
    if (externalPayload.item_id) {
      listing = await Listing.findOne({ user: operation.user, 'platformData.connectItemId': externalPayload.item_id });
    }

    const fields = {
      user: operation.user,
      title: externalPayload.title,
      description: externalPayload.description || externalPayload.title,
      price: String(externalPayload.price ?? (listing ? listing.price : '0')),
      category: externalPayload.category || (listing ? listing.category : 'General'),
      sku: externalPayload.sku || (listing ? listing.sku : ''),
      images: externalPayload.images || (listing ? listing.images : []),
      status: externalPayload.publish_mode === 'draft' ? 'draft' : (listing ? listing.status : 'draft'),
      platformData: { ...(listing ? listing.platformData : {}), connectItemId: externalPayload.item_id, connectStoreId: externalPayload.store_id }
    };

    if (listing) {
      Object.assign(listing, fields);
      await listing.save();
    } else {
      listing = await Listing.create(fields);
    }

    recordEvent({
      userId: operation.user,
      eventType: listing.status === 'published' ? 'listing.published' : 'listing.created',
      entityId: listing._id,
      source: 'connect_api'
    });

    operation.status = 'succeeded';
    operation.resultJson = { listing_id: listing._id, status: listing.status };
    await operation.save();

    await enqueueWebhookEvent(operation.user, 'listing.status_changed', {
      listing_id: listing._id,
      marketplace: externalPayload.marketplace || null,
      status: listing.status
    });
  } catch (err) {
    operation.status = 'failed';
    operation.resultJson = { error: err.message };
    await operation.save();
  }
}

/**
 * Sets/adjusts inventory with a simple optimistic-concurrency check via platformData.syncVersion,
 * matching the spec's "use version guard" rule without adding a new top-level field to the
 * shared Listing schema.
 */
async function setInventory(userId, sku, { quantity, expectedVersion }) {
  const listing = await Listing.findOne({ user: userId, sku, mergedInto: null });
  if (!listing) {
    const err = new Error('No listing found for this SKU.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const currentVersion = listing.platformData?.syncVersion || 0;
  if (expectedVersion != null && expectedVersion !== currentVersion) {
    const err = new Error('Inventory changed since the supplied version.');
    err.code = 'INVENTORY_VERSION_CONFLICT';
    err.currentVersion = currentVersion;
    throw err;
  }

  listing.quantity = quantity;
  listing.platformData = { ...(listing.platformData || {}), syncVersion: currentVersion + 1 };
  await listing.save();

  recordEvent({ userId, eventType: 'inventory.quantity_changed', entityId: listing._id, source: 'connect_api' });

  return { sku, quantity: listing.quantity, version: currentVersion + 1 };
}

async function getInventory(userId, sku) {
  const listing = await Listing.findOne({ user: userId, sku, mergedInto: null }).lean();
  if (!listing) return null;
  return { sku, quantity: listing.quantity, version: listing.platformData?.syncVersion || 0 };
}

module.exports = { createOperation, processListingOperation, setInventory, getInventory, hashPayload };
