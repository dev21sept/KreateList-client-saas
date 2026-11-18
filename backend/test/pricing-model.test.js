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
    title: 'Rockmount Ranch Wear Unisex Brown Vintage Western Shirt Size M',
    brand: 'Rockmount Ranch Wear',
    model: '677',
    condition: 'USED'
  }).normalized;
  const { accepted, rejected } = matchAndFilterComparables(target, shirtPool, 35);
  // The Size L candidate is a real size mismatch against the target's Size M, not an MPN issue -
  // it is correctly rejected on its own ground. The no-size-stated "677" title (unrelated to MPN
  // rejection here since model "677" is a bare number and not required in candidate titles) and
  // the matching Size M candidate are both still accepted.
  assert.equal(accepted.length, 2);
  const sizeMismatch = rejected.find(r => r.candidate.title.includes('Size L'));
  assert.ok(sizeMismatch.reasons.includes('size_mismatch'));
});

test('a different garment size is rejected as a comparable, even with a near-identical title', () => {
  const target = resolveItem({
    title: 'Rue21 Real Sizing Plus Skinny Jeans 22 Light Wash Stretch Distressed',
    brand: 'Rue21',
    condition: 'USED'
  }).normalized;
  const { accepted, rejected } = matchAndFilterComparables(target, [
    comp('Rue21 Real Sizing Plus Skinny Jeans 22 Light Wash Stretch Distressed', 14),
    comp('Rue21 Skinny Jeans Juniors 13/14 Long Blue Dark Wash Low Rise Stretch', 22.99)
  ], 35);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].total_price, 14);
  assert.ok(rejected[0].reasons.includes('size_mismatch') || rejected[0].reasons.includes('age_group_mismatch'));
});

test('a different gender/age group (mens vs womens) is rejected even with a matching size number', () => {
  const target = resolveItem({
    title: 'Nike Mens Running Shoes Size 10',
    brand: 'Nike',
    condition: 'USED'
  }).normalized;
  const { accepted, rejected } = matchAndFilterComparables(target, [
    comp('Nike Womens Running Shoes Size 10', 40)
  ], 35);
  assert.equal(accepted.length, 0);
  assert.ok(rejected[0].reasons.includes('age_group_mismatch'));
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
