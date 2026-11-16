const SellerBehaviorEvent = require('../models/SellerBehaviorEvent');

/**
 * Records a seller behavior event. Never throws - a logging failure must not
 * break the listing/offer/crosslist action that triggered it.
 */
async function recordEvent({ userId, eventType, entityType = 'listing', entityId = null, source = 'web_app', metadata = {}, idempotencyKey = null }) {
  if (!userId || !eventType) return null;
  try {
    return await SellerBehaviorEvent.create({
      user: userId,
      eventType,
      entityType,
      entityId,
      source,
      metadata,
      idempotencyKey
    });
  } catch (err) {
    // Duplicate idempotencyKey is expected and not an error.
    if (err.code === 11000) return null;
    console.error('[behaviorEventService] recordEvent failed:', err.message);
    return null;
  }
}

async function getRecentEvents(userId, eventType, sinceDays = 90) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return SellerBehaviorEvent.find({
    user: userId,
    eventType,
    occurredAt: { $gte: since }
  }).sort({ occurredAt: -1 }).lean();
}

module.exports = { recordEvent, getRecentEvents };
