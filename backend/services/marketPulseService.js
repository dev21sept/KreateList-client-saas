const Listing = require('../models/Listing');
const MarketObservation = require('../models/MarketObservation');
const MarketAggregate = require('../models/MarketAggregate');

// Below this many comparable observations, a trend is not asserted - "insufficient
// data" is a real, displayed state, never a fabricated trend (spec section 6/12).
const MIN_EVIDENCE_COUNT = 5;
const RISING_THRESHOLD_PCT = 8;
const DECLINING_THRESHOLD_PCT = -8;

/**
 * Ingests this seller's own sold + currently-published listings into
 * MarketObservation. This is the only evidence source available in this slice
 * (no licensed cross-seller sold-price feed is configured - see MarketObservation.js).
 */
async function ingestUserObservations(userId) {
  let upserted = 0;

  const soldListings = await Listing.find({ user: userId, status: 'sold', soldPrice: { $ne: null } }).lean();
  for (const listing of soldListings) {
    const value = parseFloat(listing.soldPrice);
    if (!value || Number.isNaN(value)) continue;
    await MarketObservation.findOneAndUpdate(
      { user: userId, listingRef: listing._id, metricType: 'sold_price' },
      {
        $set: {
          sourcePlatform: listing.soldPlatform || listing.platform || 'unknown',
          observedAt: listing.soldAt || listing.createdAt,
          category: listing.category || 'Uncategorized',
          brand: listing.brand || '',
          condition: listing.selectedCondition || '',
          value
        }
      },
      { upsert: true }
    );
    upserted++;
  }

  // An active listing's asking price is a live, ongoing fact, not a point-in-time
  // one like a sale: stamp it with "now" on every ingestion run so it always falls
  // into the current period, instead of being pinned to the listing's original
  // (possibly months-old) createdAt and silently dropping out of every aggregate.
  const now = new Date();
  const activeListings = await Listing.find({ user: userId, status: 'published', mergedInto: null }).lean();
  for (const listing of activeListings) {
    const value = parseFloat(listing.price);
    if (!value || Number.isNaN(value)) continue;
    await MarketObservation.findOneAndUpdate(
      { user: userId, listingRef: listing._id, metricType: 'asking_price' },
      {
        $set: {
          sourcePlatform: listing.platform || 'unknown',
          observedAt: now,
          category: listing.category || 'Uncategorized',
          brand: listing.brand || '',
          condition: listing.selectedCondition || '',
          value
        }
      },
      { upsert: true }
    );
    upserted++;
  }

  return { upserted, soldCount: soldListings.length, activeCount: activeListings.length };
}

function median(sortedValues) {
  const n = sortedValues.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

function percentile(sortedValues, p) {
  const n = sortedValues.length;
  if (n === 0) return null;
  const idx = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
  return sortedValues[idx];
}

function classifyTrend(trendPct, sampleCount) {
  if (sampleCount < MIN_EVIDENCE_COUNT || trendPct == null) return 'insufficient_data';
  if (trendPct >= RISING_THRESHOLD_PCT) return 'rising';
  if (trendPct <= DECLINING_THRESHOLD_PCT) return 'declining';
  return 'stable';
}

/**
 * Recomputes this period's MarketAggregate rows from MarketObservation data,
 * grouped by category+brand+metric, comparing against the prior period for trendPct.
 */
async function computeAggregates(userId, { period = currentPeriod(), priorPeriod = previousPeriod(period) } = {}) {
  const [periodStart, periodEnd] = periodBounds(period);

  const observations = await MarketObservation.find({
    user: userId,
    observedAt: { $gte: periodStart, $lt: periodEnd }
  }).lean();

  const groups = new Map();
  for (const obs of observations) {
    const key = `${obs.category}||${obs.brand}||${obs.metricType}`;
    if (!groups.has(key)) groups.set(key, { category: obs.category, brand: obs.brand, metric: obs.metricType, values: [] });
    groups.get(key).values.push(obs.value);
  }

  const priorAggregates = await MarketAggregate.find({ user: userId, period: priorPeriod }).lean();
  const priorByKey = new Map(priorAggregates.map(a => [`${a.category}||${a.brand}||${a.metric}`, a]));

  let written = 0;
  for (const [key, group] of groups) {
    const sorted = [...group.values].sort((a, b) => a - b);
    const sampleCount = sorted.length;
    const med = median(sorted);

    const prior = priorByKey.get(key);
    let trendPct = null;
    if (prior && prior.median) {
      trendPct = ((med - prior.median) / prior.median) * 100;
    }

    await MarketAggregate.findOneAndUpdate(
      { user: userId, period, category: group.category, brand: group.brand, metric: group.metric },
      {
        $set: {
          sampleCount,
          median: med,
          p25: percentile(sorted, 0.25),
          p75: percentile(sorted, 0.75),
          trendPct,
          trendClassification: classifyTrend(trendPct, sampleCount),
          computedAt: new Date()
        }
      },
      { upsert: true }
    );
    written++;
  }

  return { period, groupsComputed: written };
}

function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  const d = new Date(year, month - 2, 1); // month is 1-indexed in `period`
  return currentPeriod(d);
}

function periodBounds(period) {
  const [year, month] = period.split('-').map(Number);
  return [new Date(year, month - 1, 1), new Date(year, month, 1)];
}

async function getTrends(userId, { category, marketplace } = {}) {
  const query = { user: userId };
  if (category) query.category = category;
  if (marketplace) query.marketplace = marketplace;
  return MarketAggregate.find(query).sort({ period: -1 }).limit(100).lean();
}

async function getComparables(userId, { category, brand } = {}) {
  const query = { user: userId, metricType: 'sold_price' };
  if (category) query.category = category;
  if (brand) query.brand = brand;
  const observations = await MarketObservation.find(query).sort({ observedAt: -1 }).limit(50).lean();
  if (observations.length < MIN_EVIDENCE_COUNT) {
    return { status: 'insufficient_data', sampleCount: observations.length, observations };
  }
  const values = observations.map(o => o.value).sort((a, b) => a - b);
  return {
    status: 'ok',
    sampleCount: values.length,
    median: median(values),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    observations
  };
}

async function getBrandSummaries(userId) {
  return MarketAggregate.aggregate([
    { $match: { user: userId, metric: 'sold_price' } },
    { $sort: { period: -1 } },
    { $group: {
      _id: { brand: '$brand', category: '$category' },
      latestMedian: { $first: '$median' },
      latestTrend: { $first: '$trendClassification' },
      latestSampleCount: { $first: '$sampleCount' }
    } },
    { $project: { _id: 0, brand: '$_id.brand', category: '$_id.category', median: '$latestMedian', trend: '$latestTrend', sampleCount: '$latestSampleCount' } }
  ]);
}

module.exports = {
  MIN_EVIDENCE_COUNT,
  ingestUserObservations,
  computeAggregates,
  getTrends,
  getComparables,
  getBrandSummaries,
  currentPeriod,
  previousPeriod
};
