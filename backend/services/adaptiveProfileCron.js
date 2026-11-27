const User = require('../models/User');
const AiRecommendation = require('../models/AiRecommendation');
const { recomputeProfile } = require('./sellerProfileService');
const { generatePriceReviewRecommendations, generateListingQualityRecommendations } = require('./recommendationService');

/**
 * Daily: recompute each active user's inferred preferences and generate fresh
 * recommendations, then expire anything past its expiresAt.
 */
async function runAdaptiveProfileCycle() {
  const users = await User.find({ 'subscription.status': 'active' }).select('_id').lean();
  let profilesUpdated = 0;
  let recommendationsCreated = 0;

  for (const { _id: userId } of users) {
    try {
      await recomputeProfile(userId);
      profilesUpdated++;

      const [priceReviews, qualityIssues] = await Promise.all([
        generatePriceReviewRecommendations(userId),
        generateListingQualityRecommendations(userId)
      ]);
      recommendationsCreated += priceReviews.length + qualityIssues.length;
    } catch (err) {
      console.error(`[AdaptiveAI] cycle failed for user ${userId}:`, err.message);
    }
  }

  const { modifiedCount: expired } = await AiRecommendation.updateMany(
    { status: 'proposed', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );

  return { profilesUpdated, recommendationsCreated, expired };
}

module.exports = { runAdaptiveProfileCycle };
