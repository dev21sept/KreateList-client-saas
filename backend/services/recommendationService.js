const Listing = require('../models/Listing');
const AiRecommendation = require('../models/AiRecommendation');
const { recommendPrice } = require('./pricing/pricingService');

const STALE_LISTING_DAYS = 60;
const WEAK_TITLE_MIN_WORDS = 4;

/**
 * Finds published listings older than STALE_LISTING_DAYS and proposes a price
 * review using the existing evidence-grounded pricing engine. Never invents a
 * price - if the engine returns insufficient_evidence, no recommendation is created.
 */
async function generatePriceReviewRecommendations(userId, { maxItems = 25 } = {}) {
  const staleSince = new Date(Date.now() - STALE_LISTING_DAYS * 24 * 60 * 60 * 1000);
  const staleListings = await Listing.find({
    user: userId,
    mergedInto: null,
    status: 'published',
    createdAt: { $lte: staleSince }
  }).limit(maxItems).lean();

  const created = [];
  for (const listing of staleListings) {
    const existing = await AiRecommendation.findOne({
      user: userId,
      entityId: listing._id,
      type: 'review_price',
      status: 'proposed'
    });
    if (existing) continue;

    const result = await recommendPrice({
      item: {
        title: listing.title,
        brand: listing.brand,
        condition: listing.selectedCondition
      },
      marketplace: 'EBAY_US'
    }).catch(() => null);

    if (!result || result.status === 'insufficient_evidence') continue;

    const rec = await AiRecommendation.create({
      user: userId,
      type: 'review_price',
      entityId: listing._id,
      payload: { currentPrice: listing.price, suggested: result.recommended_price || result.price_range },
      rationale: `Listing is ${Math.floor((Date.now() - new Date(listing.createdAt)) / 86400000)} days old; comparable sold/active evidence suggests a different price.`,
      evidence: result.comparables_used || [],
      confidence: result.confidence != null ? result.confidence / 100 : 0.5,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });
    created.push(rec);
  }
  return created;
}

/**
 * Finds listings missing item specifics or with a weak (too-short) title and
 * proposes a draft-only listing-quality recommendation.
 */
async function generateListingQualityRecommendations(userId, { maxItems = 25 } = {}) {
  const listings = await Listing.find({
    user: userId,
    mergedInto: null,
    status: { $in: ['published', 'draft'] }
  }).limit(maxItems).lean();

  const created = [];
  for (const listing of listings) {
    const wordCount = String(listing.title || '').trim().split(/\s+/).filter(Boolean).length;
    const specifics = listing.itemSpecifics instanceof Map
      ? listing.itemSpecifics
      : new Map(Object.entries(listing.itemSpecifics || {}));
    const hasFewSpecifics = specifics.size < 2;
    const hasWeakTitle = wordCount < WEAK_TITLE_MIN_WORDS;

    if (!hasFewSpecifics && !hasWeakTitle) continue;

    const existing = await AiRecommendation.findOne({
      user: userId,
      entityId: listing._id,
      type: 'improve_listing_quality',
      status: 'proposed'
    });
    if (existing) continue;

    const issues = [];
    if (hasWeakTitle) issues.push('title is shorter than recommended');
    if (hasFewSpecifics) issues.push('missing item specifics');

    const rec = await AiRecommendation.create({
      user: userId,
      type: 'improve_listing_quality',
      entityId: listing._id,
      payload: { issues },
      rationale: `Listing quality gap detected: ${issues.join(', ')}.`,
      confidence: 0.8,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    created.push(rec);
  }
  return created;
}

async function listRecommendations(userId, { status } = {}) {
  const query = { user: userId };
  if (status) query.status = status;
  return AiRecommendation.find(query).sort({ createdAt: -1 }).limit(100).lean();
}

async function recordFeedback(userId, recommendationId, { action, editedPayload }) {
  const statusMap = { accept: 'accepted', reject: 'rejected', edit: 'accepted', dismiss: 'dismissed' };
  const status = statusMap[action];
  if (!status) throw new Error('Invalid feedback action');

  return AiRecommendation.findOneAndUpdate(
    { _id: recommendationId, user: userId },
    {
      $set: {
        status,
        feedback: { action, editedPayload: editedPayload || null, respondedAt: new Date() }
      }
    },
    { new: true }
  );
}

module.exports = {
  generatePriceReviewRecommendations,
  generateListingQualityRecommendations,
  listRecommendations,
  recordFeedback
};
