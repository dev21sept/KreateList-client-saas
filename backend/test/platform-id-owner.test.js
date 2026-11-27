const test = require('node:test');
const assert = require('node:assert/strict');
const { pickOwners } = require('../utils/platformIdOwner');

test('a unique ID has one owner and no extras', () => {
  const r = pickOwners([{ id: 'a', createdAt: '2026-09-16', platformId: '111' }]);
  assert.ok(r.owners.has('a'));
  assert.equal(r.extras.size, 0);
  assert.equal(r.duplicates.length, 0);
});

test('two records with the same ID: the oldest owns it, the newer is an extra', () => {
  const r = pickOwners([
    { id: 'new', createdAt: '2026-10-01', platformId: '6a7' },
    { id: 'old', createdAt: '2026-09-16', platformId: '6a7' },
  ]);
  assert.ok(r.owners.has('old'));
  assert.ok(r.extras.has('new'));
  assert.equal(r.duplicates[0].owner, 'old');
});

test('empty and placeholder IDs are ignored', () => {
  const r = pickOwners([{ id: 'a', platformId: '' }, { id: 'b', platformId: 'undefined' }, { id: 'c', platformId: null }]);
  assert.equal(r.owners.size, 0);
  assert.equal(r.extras.size, 0);
});
