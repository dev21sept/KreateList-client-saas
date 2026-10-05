const test = require('node:test');
const assert = require('node:assert/strict');
const { poshmarkStateOf } = require('../services/externalImportService');

// Builds the inputs the scraper computes from a raw Poshmark post.
const state = (post, qty) => {
  const rawPostStatus = String(post.status || post.listing_status || '').toLowerCase();
  const rawInvStatus = String(post.inventory?.status || post.inventory_status || post.inventory?.status_v2 || '').toLowerCase();
  const isZeroQty = typeof qty === 'number' && qty <= 0;
  return poshmarkStateOf({ rawPostStatus, rawInvStatus, isZeroQty, post });
};

test('available and visible is active', () => {
  assert.equal(state({ status: 'published', inventory: { status: 'available' }, active_item: true }), 'active');
});

test('sold_out inventory is sold, even when the flag says hidden', () => {
  assert.equal(state({ status: 'published', inventory: { status: 'sold_out' }, active_item: true }), 'sold');
  assert.equal(state({ status: 'published', inventory: { status: 'sold_out' }, active_item: false }), 'sold');
});

test('available but active_item=false is hidden, not active', () => {
  assert.equal(state({ status: 'published', inventory: { status: 'available' }, active_item: false }), 'hidden');
});

test('not_for_sale inventory is not_for_sale', () => {
  assert.equal(state({ status: 'published', inventory: { status: 'not_for_sale' }, active_item: true }), 'not_for_sale');
});

test('zero available quantity counts as sold', () => {
  assert.equal(state({ status: 'published', inventory: { status: 'available', available_quantity: 0 }, active_item: true }, 0), 'sold');
});

test('deleted post is removed', () => {
  assert.equal(state({ status: 'deleted', inventory: { status: 'available' } }), 'removed');
});

const { stripInvisible } = require('../services/externalImportService');

test('invisible marks are removed from titles so search matches', () => {
  const raw = 'Bonobos Jeans Mens 35x34 Blue Denim‎ Straight Leg';
  assert.equal(stripInvisible(raw), 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg');
  assert.equal(stripInvisible('plain title'), 'plain title');
});
