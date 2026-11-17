const Listing = require('../models/Listing');
const AiRecommendation = require('../models/AiRecommendation');
const { getComparables } = require('./marketPulseService');

// Risk level drives the policy engine's approval requirement (agentPolicyService.js).
// External-write tools are defined here so the typed-tool contract is stable across
// releases, but they are not enabled in this slice - see the spec's own release gate
// ("no autonomous external write should ship until ... pass security and QA review").
const TOOL_CATALOG = {
  'inventory.search': { riskLevel: 'read_only' },
  'listing.get': { riskLevel: 'read_only' },
  'market.compare_price': { riskLevel: 'read_only' },
  'listing.draft_update': { riskLevel: 'draft_only' },
  'listing.publish_update': { riskLevel: 'external_write', enabled: false },
  'listing.delist': { riskLevel: 'external_write', enabled: false },
  'crosslist.execute': { riskLevel: 'external_write', enabled: false }
};

async function inventorySearch(userId, input) {
  const query = { user: userId, mergedInto: null };
  if (input.status) query.status = input.status;
  if (input.category) query.category = input.category;
  if (input.age_days_gte) {
    query.createdAt = { $lte: new Date(Date.now() - input.age_days_gte * 24 * 60 * 60 * 1000) };
  }
  const limit = Math.min(input.max_items || 25, 50);
  const items = await Listing.find(query).select('_id title price category status createdAt').limit(limit).lean();
  return { items: items.map(i => ({ item_ref: i._id, title: i.title, price: i.price, category: i.category, status: i.status })) };
}

async function listingGet(userId, input) {
  const listing = await Listing.findOne({ _id: input.item_ref, user: userId }).lean();
  if (!listing) return { found: false };
  return { found: true, listing: { id: listing._id, title: listing.title, price: listing.price, status: listing.status, category: listing.category, platform: listing.platform } };
}

async function marketComparePrice(userId, input) {
  const result = await getComparables(userId, { category: input.category, brand: input.brand });
  return result;
}

async function listingDraftUpdate(userId, input) {
  const listing = await Listing.findOne({ _id: input.item_ref, user: userId });
  if (!listing) {
    const err = new Error('Listing not found for this tenant.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const recommendation = await AiRecommendation.create({
    user: userId,
    type: 'agent_draft_update',
    entityId: listing._id,
    payload: { change: input.change || {} },
    rationale: input.rationale || 'Proposed by AI Agent task.',
    confidence: input.confidence || 0.5
  });
  // Draft-only: nothing is published. The seller reviews this like any other recommendation.
  return { recommendation_id: recommendation._id, status: 'proposed' };
}

async function notYetEnabled(toolName) {
  const err = new Error(`Tool '${toolName}' is defined but not enabled in this release.`);
  err.code = 'TOOL_NOT_YET_ENABLED';
  err.httpStatus = 501;
  throw err;
}

const TOOL_IMPLEMENTATIONS = {
  'inventory.search': inventorySearch,
  'listing.get': listingGet,
  'market.compare_price': marketComparePrice,
  'listing.draft_update': listingDraftUpdate,
  'listing.publish_update': () => notYetEnabled('listing.publish_update'),
  'listing.delist': () => notYetEnabled('listing.delist'),
  'crosslist.execute': () => notYetEnabled('crosslist.execute')
};

async function runTool(userId, toolName, input) {
  const impl = TOOL_IMPLEMENTATIONS[toolName];
  if (!impl) {
    const err = new Error(`Unknown tool '${toolName}'. Only allowlisted tools may be invoked.`);
    err.code = 'TOOL_NOT_ALLOWLISTED';
    throw err;
  }
  return impl(userId, input || {});
}

module.exports = { TOOL_CATALOG, runTool };
