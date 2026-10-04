const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveItem } = require('../services/pricing/itemResolver');
const { matchAndFilterComparables } = require('../services/pricing/comparableMatcher');
const { removePriceOutliers, calculatePriceDistribution } = require('../services/pricing/pricingCalculator');

const comp = (title, price, condition = 'New') => ({
  title,
  total_price: price,
  item_price: price,
  shipping_price: 0,
  condition,
  source_type: 'ACTIVE',
  item_id: title.slice(0, 12),
  categories: []
});

test('kit pricing ignores parts, bare tools and used listings', () => {
  const target = resolveItem({
    title: 'Bostitch BTFP2350K 23 Gauge Pin Nailer Kit',
    brand: 'Bostitch',
    model: 'BTFP2350K',
    condition: 'NEW'
  }).normalized;

  const pool = [
    comp('BOSTITCH BTFP2350K 23 Gauge Pin Nailer Kit, 100 PSI Straight Nailer', 110),
    comp('[NEW] (BTFP2350K) Bostitch 23 Gauge Pin Nailer Kit', 179.03),
    comp('New Bostitch BTFP2350K 23ga Pin Nailer Kit 100 PSI', 118),
    comp('Bostitch BTFP2350K 23 Gauge Pin Nailer Kit with 2 batteries', 129.5),
    comp('Bostitch BTFP2350K nose part replacement for pin nailer', 11.37),
    comp('Bostitch BTFP2350K pin nailer pins 23ga 1000ct', 14.99),
    comp('Bostitch BTFP2350K 23 Gauge Pin Nailer Tool Only', 22.5),
    comp('New, OPEN BOX - Bostitch 23ga Pin Nailer Kit BTFP2350K', 137.9, 'Used')
  ];

  const { accepted } = matchAndFilterComparables(target, pool, 30);
  const strong = accepted.filter(c => c.match_score >= 60);
  const prices = removePriceOutliers(strong).map(c => c.total_price);

  assert.ok(accepted.every(c => !/nose part|pins 23ga|tool only/i.test(c.title)));
  assert.equal(calculatePriceDistribution(prices).median, 129.5);
});
