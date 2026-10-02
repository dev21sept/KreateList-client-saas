/**
 * Pricing Service (Stage 5 Orchestrator)
 * Coordinates the full 5-stage pricing workflow:
 * 1. Identify Item (itemResolver)
 * 2. Collect Data (ebayBrowseConnector + soldDataConnector)
 * 3. Filter Comparables (comparableMatcher)
 * 4. Calculate Price (pricingCalculator)
 * 5. Recommend Price & Confidence Scoring
 */

const crypto = require('crypto');
const { resolveItem } = require('./itemResolver');
const { fetchActiveListings } = require('./ebayBrowseConnector');
const { fetchSoldListings } = require('./soldDataConnector');
const { matchAndFilterComparables } = require('./comparableMatcher');
const { calculatePriceDistribution, applySellerObjective } = require('./pricingCalculator');

const PRICING_ALGORITHM_VERSION = 'pricing-v1.0';

// Simple in-memory cache with 30-minute TTL
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(item, marketplace, objective) {
  const norm = `${marketplace}_${item.upc || ''}_${item.brand || ''}_${item.model || ''}_${item.title || ''}_${item.condition || ''}_${objective || ''}`;
  return crypto.createHash('md5').update(norm.toLowerCase()).digest('hex');
}

/**
 * Calculates evidence-grounded confidence score (0–100)
 */
function scoreConfidence({
  identityQuality,
  acceptedComps,
  sampleSize,
  distribution,
  hasSoldData
}) {
  // 1. Identity Quality (0-100)
  const idScore = identityQuality || 50;

  // 2. Match Quality (average match score of accepted comps)
  let matchQuality = 40;
  if (acceptedComps.length > 0) {
    const totalMatch = acceptedComps.reduce((acc, c) => acc + (c.match_score || 0), 0);
    matchQuality = totalMatch / acceptedComps.length;
  }

  // 3. Sample Quality (0-100)
  let sampleQuality = 20;
  if (sampleSize >= 10) sampleQuality = 100;
  else if (sampleSize >= 6) sampleQuality = 85;
  else if (sampleSize >= 3) sampleQuality = 60;
  else if (sampleSize >= 1) sampleQuality = 35;

  // 4. Recency Quality (0-100)
  // Current live active listings are fresh by definition
  const recencyQuality = 90;

  // 5. Price Consistency (Narrow IQR relative to median is better)
  let consistencyQuality = 70;
  if (distribution && distribution.median > 0) {
    const spreadRatio = distribution.iqr / distribution.median;
    if (spreadRatio < 0.20) consistencyQuality = 95;
    else if (spreadRatio < 0.40) consistencyQuality = 80;
    else if (spreadRatio < 0.70) consistencyQuality = 60;
    else consistencyQuality = 40; // Wide price spread
  }

  // 6. Source Quality (Sold data vs active asking price only)
  const sourceQuality = hasSoldData ? 95 : 65;

  // Weighted combination
  let rawScore = (
    0.25 * idScore +
    0.25 * matchQuality +
    0.15 * sampleQuality +
    0.15 * recencyQuality +
    0.10 * consistencyQuality +
    0.10 * sourceQuality
  );

  let finalScore = Math.round(Math.min(Math.max(rawScore, 10), 99));

  // GATES:
  // Gate 1: If no sold data, confidence CANNOT be HIGH (cap at 74 - Medium)
  if (!hasSoldData && finalScore > 74) {
    finalScore = 74;
  }

  // Gate 2: If fewer than 3 comps, cap at Medium (max 65)
  if (sampleSize < 3 && finalScore > 65) {
    finalScore = 65;
  }

  // Determine Label
  let label = 'LOW';
  if (finalScore >= 80) label = 'HIGH';
  else if (finalScore >= 55) label = 'MEDIUM';

  return {
    score: finalScore,
    label,
    components: {
      identity: Math.round(idScore),
      match_quality: Math.round(matchQuality),
      sample_quality: Math.round(sampleQuality),
      price_consistency: Math.round(consistencyQuality),
      source_quality: Math.round(sourceQuality)
    }
  };
}

/**
 * Builds user-facing caveats and guidance
 */
function buildCaveats(resolvedItem, hasSoldData, sampleCount, basis) {
  const caveats = [];
  const norm = resolvedItem.normalized;

  if (!hasSoldData) {
    caveats.push('Recommendation is based on active competitor asking prices. Actual sold prices may vary.');
  }

  if (norm.isBare) {
    caveats.push('Matched as bare item/tool only. Confirm that no batteries, chargers, or accessories are included.');
  } else if (norm.isKit) {
    caveats.push('Matched as full kit/bundle. Ensure all advertised accessories are included.');
  }

  if (sampleCount < 4) {
    caveats.push('Low number of comparable listings found. Consider reviewing suggested price manually.');
  }

  if (norm.missingFields && norm.missingFields.length > 0) {
    caveats.push(`Adding missing fields (${norm.missingFields.join(', ')}) will improve match precision.`);
  }

  return caveats;
}

/**
 * Primary Pricing Recommendation Function
 * @param {Object} request - { item: {...}, marketplace: 'EBAY_US', objective: 'MARKET_MATCHED', options: {} }
 */
async function recommendPrice(request = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const marketplace = request.marketplace || 'EBAY_US';
  const currency = request.currency || 'USD';
  const objective = request.objective || 'MARKET_MATCHED';
  const rawItem = request.item || {};

  // Check Cache
  const cacheKey = getCacheKey(rawItem, marketplace, objective);
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
    return {
      ...cachedEntry.data,
      from_cache: true,
      request_id: requestId
    };
  }

  // STAGE 1: IDENTIFY ITEM
  const resolved = resolveItem(rawItem);
  if (resolved.identityConflict) {
    return {
      status: 'insufficient_evidence',
      reason: 'CONFLICTING_IDENTITY',
      message: 'Conflicting product identity attributes detected. Please verify brand and model.',
      missing_fields: resolved.missingFields,
      algorithm_version: PRICING_ALGORITHM_VERSION,
      request_id: requestId
    };
  }

  // STAGE 2: COLLECT MARKET DATA
  // Run active and sold data retrieval in parallel
  const [activeRes, soldRes] = await Promise.all([
    fetchActiveListings(resolved.normalized, marketplace, 30),
    fetchSoldListings(resolved.normalized, marketplace, 20)
  ]);

  const candidatePool = [...(soldRes.items || []), ...(activeRes.items || [])];

  if (candidatePool.length === 0) {
    return {
      status: 'insufficient_evidence',
      reason: 'NO_CANDIDATE_LISTINGS',
      message: 'No comparable listings could be found on eBay for this item.',
      missing_fields: resolved.missingFields,
      algorithm_version: PRICING_ALGORITHM_VERSION,
      request_id: requestId
    };
  }

  // STAGE 3: FILTER & MATCH COMPARABLES
  const { accepted, rejected } = matchAndFilterComparables(resolved.normalized, candidatePool, 30);

  const soldComps = accepted.filter(c => c.source_type === 'SOLD');
  const activeComps = accepted.filter(c => c.source_type === 'ACTIVE');

  // STAGE 4: DETERMINE PRICE BASIS & CALCULATE
  let relevantComps = [];
  let basis = 'ACTIVE_ASKING_PRICE_ESTIMATE';
  let hasSoldData = false;

  const MIN_SOLD_MATCHES = 3;
  const MIN_ACTIVE_MATCHES = 1;

  if (soldComps.length >= MIN_SOLD_MATCHES) {
    relevantComps = soldComps;
    basis = 'SOLD_COMPS_MEDIAN';
    hasSoldData = true;
  } else if (activeComps.length >= MIN_ACTIVE_MATCHES) {
    relevantComps = activeComps;
    basis = 'ACTIVE_ASKING_PRICE_ESTIMATE';
    hasSoldData = false;
  } else {
    return {
      status: 'insufficient_evidence',
      reason: 'NO_VALID_COMPARABLES_AFTER_FILTERING',
      message: 'Found candidate listings, but none passed strict model and condition compatibility checks.',
      rejected_reasons: rejected.slice(0, 5).map(r => r.reasons),
      missing_fields: resolved.missingFields,
      algorithm_version: PRICING_ALGORITHM_VERSION,
      request_id: requestId
    };
  }

  // Extract prices for distribution
  const priceList = relevantComps.map(c => c.total_price);
  const distribution = calculatePriceDistribution(priceList);

  if (!distribution) {
    return {
      status: 'insufficient_evidence',
      reason: 'CALCULATION_FAILED',
      message: 'Could not calculate valid price distribution from comparable listings.',
      algorithm_version: PRICING_ALGORITHM_VERSION,
      request_id: requestId
    };
  }

  // STAGE 5: RECOMMEND LISTING PRICE & CONFIDENCE
  const objectiveResult = applySellerObjective(distribution.median, objective, distribution);
  const confidence = scoreConfidence({
    identityQuality: resolved.identityScore,
    acceptedComps: relevantComps,
    sampleSize: relevantComps.length,
    distribution,
    hasSoldData
  });

  const caveats = buildCaveats(resolved, hasSoldData, relevantComps.length, basis);

  // Return clean representative evidence (top 5 comps for user review)
  const representativeEvidence = accepted.slice(0, 5).map(c => ({
    item_id: c.item_id,
    title: c.title,
    price: c.item_price,
    shipping: c.shipping_price,
    total_price: c.total_price,
    currency: c.currency,
    condition: c.condition,
    source_type: c.source_type,
    match_score: c.match_score,
    match_reasons: c.match_reasons,
    item_url: c.item_url,
    thumbnail_url: c.thumbnail_url,
    observed_at: c.observed_at
  }));

  const responsePayload = {
    status: 'ok',
    recommendation: {
      suggested_price: objectiveResult.final_price,
      raw_price: objectiveResult.raw_adjusted,
      currency,
      expected_range: distribution.range,
      basis,
      basis_explanation: objectiveResult.explanation,
      confidence,
      sample_counts: {
        sold: soldComps.length,
        active: activeComps.length,
        used_in_calculation: relevantComps.length
      },
      data_as_of: new Date().toISOString(),
      caveats
    },
    evidence: representativeEvidence,
    normalized_item: {
      brand: resolved.normalized.brand,
      model: resolved.normalized.model,
      condition: resolved.normalized.condition,
      configType: resolved.normalized.configType
    },
    algorithm_version: PRICING_ALGORITHM_VERSION,
    request_id: requestId
  };

  // Cache result
  cache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });

  return responsePayload;
}

module.exports = {
  recommendPrice,
  scoreConfidence,
  PRICING_ALGORITHM_VERSION
};
