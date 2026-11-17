const User = require('../models/User');
const { ingestUserObservations, computeAggregates } = require('./marketPulseService');

async function runMarketPulseAggregationCycle() {
  const users = await User.find({ 'subscription.status': 'active' }).select('_id').lean();
  let usersProcessed = 0;
  let observationsIngested = 0;
  let groupsAggregated = 0;

  for (const { _id: userId } of users) {
    try {
      const ingestResult = await ingestUserObservations(userId);
      const aggregateResult = await computeAggregates(userId);
      observationsIngested += ingestResult.upserted;
      groupsAggregated += aggregateResult.groupsComputed;
      usersProcessed++;
    } catch (err) {
      console.error(`[MarketPulse] cycle failed for user ${userId}:`, err.message);
    }
  }

  return { usersProcessed, observationsIngested, groupsAggregated };
}

module.exports = { runMarketPulseAggregationCycle };
