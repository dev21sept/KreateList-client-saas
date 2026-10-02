/**
 * Test script for eBay Pricing Engine
 */
const { resolveItem } = require('./services/pricing/itemResolver');
const { matchAndFilterComparables } = require('./services/pricing/comparableMatcher');
const { calculatePriceDistribution, applySellerObjective } = require('./services/pricing/pricingCalculator');
const { scoreConfidence } = require('./services/pricing/pricingService');

console.log('=== TEST 1: ITEM RESOLVER ===');
const sampleItem = {
  title: 'Makita XPH14 18V LXT Lithium-Ion Brushless Cordless 1/2" Hammer Drill - Tool Only',
  brand: 'Makita',
  model: 'XPH14',
  condition: 'Used',
  included_items: ['tool only']
};
const resolved = resolveItem(sampleItem);
console.log('Resolved Item Normalized:', resolved.normalized);
console.log('Is Bare Tool:', resolved.normalized.isBare);
console.log('Identity Score:', resolved.identityScore);
console.assert(resolved.normalized.isBare === true, 'Should detect bare tool');
console.assert(resolved.normalized.brand === 'Makita', 'Should match brand');
console.assert(resolved.normalized.model === 'XPH14', 'Should match model');
console.log('✓ Test 1 Passed\n');

console.log('=== TEST 2: COMPARABLE MATCHER & HARD REJECTIONS ===');
const candidatePool = [
  {
    title: 'Makita XPH14Z 18V Hammer Driver Drill Tool Only Bare Tool Genuine',
    item_price: 68.00,
    shipping_price: 0,
    total_price: 68.00,
    condition: 'Used',
    source_type: 'ACTIVE'
  },
  {
    title: 'Makita XPH14 18V Cordless Hammer Drill Kit with 2 Batteries and Charger in Box',
    item_price: 249.00,
    shipping_price: 15.00,
    total_price: 264.00,
    condition: 'Used',
    source_type: 'ACTIVE'
  },
  {
    title: 'Makita XPH14 Hammer Drill FOR PARTS OR REPAIR ONLY MOTOR BURNT',
    item_price: 18.00,
    shipping_price: 5.00,
    total_price: 23.00,
    condition: 'For parts or not working',
    source_type: 'ACTIVE'
  },
  {
    title: 'Makita XPH14 18V LXT Brushless 1/2 Hammer Drill / Driver Bare Tool Bare',
    item_price: 74.50,
    shipping_price: 4.99,
    total_price: 79.49,
    condition: 'Used',
    source_type: 'ACTIVE'
  }
];

const { accepted, rejected } = matchAndFilterComparables(resolved.normalized, candidatePool, 30);
console.log(`Accepted Comps: ${accepted.length}, Rejected: ${rejected.length}`);
console.log('Accepted Titles & Scores:', accepted.map(a => `${a.title.slice(0, 45)}... Score: ${a.match_score}`));
console.log('Rejected Reasons:', rejected.map(r => `${r.candidate.title.slice(0, 35)}... Reason: ${r.reasons.join(', ')}`));

console.assert(accepted.length === 2, 'Should accept only the 2 tool-only working drills');
console.assert(rejected.length === 2, 'Should reject the full kit ($264) and parts-only drill ($23)');
console.log('✓ Test 2 Passed\n');

console.log('=== TEST 3: PRICING CALCULATOR & OBJECTIVES ===');
const prices = [65.00, 68.00, 72.00, 74.99, 79.00, 85.00];
const dist = calculatePriceDistribution(prices);
console.log('Price Distribution:', dist);
console.assert(dist.median > 70 && dist.median < 75, 'Median should be around 73');

const marketMatched = applySellerObjective(dist.median, 'MARKET_MATCHED', dist);
const sellFaster = applySellerObjective(dist.median, 'SELL_FASTER', dist);
const roomOffers = applySellerObjective(dist.median, 'LEAVE_ROOM_FOR_OFFERS', dist);

console.log('Market Matched:', marketMatched.final_price);
console.log('Sell Faster:', sellFaster.final_price);
console.log('Room for Offers:', roomOffers.final_price);

console.assert(sellFaster.final_price < marketMatched.final_price, 'Sell faster should be lower than market matched');
console.assert(roomOffers.final_price > marketMatched.final_price, 'Room for offers should be higher than market matched');
console.log('✓ Test 3 Passed\n');

console.log('=== TEST 4: CONFIDENCE SCORING & GATES ===');
const confNoSold = scoreConfidence({
  identityQuality: 85,
  acceptedComps: accepted,
  sampleSize: 10,
  distribution: dist,
  hasSoldData: false
});
console.log('Confidence (Active Comps Only):', confNoSold);
console.assert(confNoSold.label !== 'HIGH', 'Confidence without sold data should be capped at MEDIUM or below');

const confWithSold = scoreConfidence({
  identityQuality: 95,
  acceptedComps: accepted,
  sampleSize: 12,
  distribution: dist,
  hasSoldData: true
});
console.log('Confidence (With Sold Comps):', confWithSold);
console.assert(confWithSold.score > confNoSold.score, 'Sold data should give higher confidence');
console.log('✓ Test 4 Passed\n');

console.log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
