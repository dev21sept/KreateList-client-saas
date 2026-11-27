const SellerPreference = require('../models/SellerPreference');
const { getRecentEvents } = require('./behaviorEventService');

// A learned pattern is not shown to the seller until this many supporting events exist.
const MIN_EVIDENCE_COUNT = 5;

/**
 * Infers the seller's most common listing-publish hour from recent
 * listing.published events. Returns null (not a guess) below the evidence threshold.
 */
async function inferListingCadence(userId) {
  const events = await getRecentEvents(userId, 'listing.published');
  if (events.length < MIN_EVIDENCE_COUNT) {
    return { evidenceCount: events.length, sufficientEvidence: false };
  }

  const hourCounts = {};
  for (const e of events) {
    const hour = new Date(e.occurredAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const [peakHour, peakCount] = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    evidenceCount: events.length,
    sufficientEvidence: true,
    peakHour: Number(peakHour),
    confidence: Math.min(peakCount / events.length, 1)
  };
}

async function upsertPreference(userId, key, { inferredValue, confidence, evidenceCount }) {
  const existing = await SellerPreference.findOne({ user: userId, key });
  if (existing && existing.source === 'explicit') {
    // ADP-09: an inferred value must never silently override an explicit seller setting.
    return existing;
  }
  return SellerPreference.findOneAndUpdate(
    { user: userId, key },
    {
      $set: {
        inferredValue,
        confidence,
        evidenceCount,
        source: 'inferred',
        updatedAt: new Date()
      },
      $setOnInsert: { explicitValue: null, version: 1 }
    },
    { upsert: true, new: true }
  );
}

async function setExplicitPreference(userId, key, value) {
  return SellerPreference.findOneAndUpdate(
    { user: userId, key },
    {
      $set: { explicitValue: value, source: 'explicit', updatedAt: new Date() },
      $inc: { version: 1 },
      $setOnInsert: { inferredValue: null, confidence: 0, evidenceCount: 0 }
    },
    { upsert: true, new: true }
  );
}

async function getLearningProfile(userId) {
  const preferences = await SellerPreference.find({ user: userId }).lean();
  return preferences;
}

/**
 * Recomputes inferred preferences from recent behavior. Called by the daily cron
 * and safe to call on demand.
 */
async function recomputeProfile(userId) {
  const cadence = await inferListingCadence(userId);
  if (cadence.sufficientEvidence) {
    await upsertPreference(userId, 'listing_cadence_peak_hour', {
      inferredValue: cadence.peakHour,
      confidence: cadence.confidence,
      evidenceCount: cadence.evidenceCount
    });
  }
  return { listingCadence: cadence };
}

module.exports = {
  MIN_EVIDENCE_COUNT,
  inferListingCadence,
  upsertPreference,
  setExplicitPreference,
  getLearningProfile,
  recomputeProfile
};
