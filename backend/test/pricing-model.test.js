const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveItem } = require('../services/pricing/itemResolver');
const { matchAndFilterComparables } = require('../services/pricing/comparableMatcher');

const comp = (title, price, condition = 'Used') => ({
  title,
  total_price: price,
  item_price: price,
  shipping_price: 0,
  condition,
  source_type: 'ACTIVE',
  item_id: title.slice(0, 12),
  categories: []
});

const shirtPool = [
  comp('Rockmount Ranch Wear Western Shirt Brown Pearl Snap Size M', 45),
  comp('Vintage Rockmount Ranch Wear Western Button Shirt Size L', 60),
  comp('Rockmount Ranch Wear 677 Western Shirt Brown', 52)
];

test('a bare numeric MPN like 677 does not reject comparables', () => {
  const target = resolveItem({
    title: 'Rockmount Ranch Wear Unisex Brown Vintage Western Shirt Size 16 M',
    brand: 'Rockmount Ranch Wear',
    model: '677',
    condition: 'USED'
  }).normalized;
  const { accepted } = matchAndFilterComparables(target, shirtPool, 35);
  assert.equal(accepted.length, 3);
});

test('a strong model number still requires the model in the candidate title', () => {
  const target = resolveItem({
    title: 'Bostitch BTFP2350K 23 Gauge Pin Nailer Kit',
    brand: 'Bostitch',
    model: 'BTFP2350K',
    condition: 'NEW'
  }).normalized;
  const { accepted, rejected } = matchAndFilterComparables(target, [
    comp('Bostitch BTFP2350K 23 Gauge Pin Nailer Kit', 120, 'New'),
    comp('Bostitch 23 Gauge Pin Nailer Kit', 99, 'New')
  ], 35);
  assert.equal(accepted.length, 1);
  assert.ok(rejected[0].reasons.includes('model_not_found_in_candidate_title'));
});
