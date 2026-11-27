const test = require('node:test');
const assert = require('node:assert/strict');
const { stateForEbayId } = require('../services/ebayStateSync');

const lists = { active: new Set(['1']), sold: new Set(['2']), unsold: new Set(['3']) };

test('an ID in ActiveList is active', () => {
  assert.equal(stateForEbayId('1', lists), 'active');
});

test('an ID in SoldList is sold', () => {
  assert.equal(stateForEbayId('2', lists), 'sold');
});

test('an ID in UnsoldList is ended', () => {
  assert.equal(stateForEbayId('3', lists), 'ended');
});

test('an ID in no list is removed (not on eBay any more)', () => {
  assert.equal(stateForEbayId('999', lists), 'removed');
});
