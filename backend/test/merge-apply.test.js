const test = require('node:test');
const assert = require('node:assert/strict');
const { clusterPairs, resolveConflicts } = require('../services/mergeApply');

test('two independent pairs stay in separate clusters', () => {
  const clusters = clusterPairs([
    { a: 'a1', b: 'a2', score: 90 },
    { a: 'b1', b: 'b2', score: 85 },
  ]);
  assert.equal(clusters.length, 2);
  const sets = clusters.map(c => c.sort());
  assert.deepEqual(sets.sort(), [['a1', 'a2'], ['b1', 'b2']]);
});

test('a chain of pairs (A-B, B-C) becomes one cluster of three', () => {
  const clusters = clusterPairs([
    { a: 'x1', b: 'x2', score: 90 },
    { a: 'x2', b: 'x3', score: 85 },
  ]);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].sort(), ['x1', 'x2', 'x3']);
});

test('no pairs means no clusters', () => {
  assert.deepEqual(clusterPairs([]), []);
});

test('resolveConflicts: two same-platform holders are ranked by price closeness to the rest', () => {
  // Real production example: a seller with two Poshmark units of the same item, one eBay listing.
  // $33 is almost exactly the eBay price ($32.92); $28 is not.
  const members = [
    { _id: 'ebay1', ebayListingId: '123', ebayStatus: 'published', price: '32.92', createdAt: new Date('2026-08-01') },
    { _id: 'posh1', poshmarkListingId: 'A', poshmarkStatus: 'published', price: '28', createdAt: new Date('2026-07-15') },
    { _id: 'posh2', poshmarkListingId: 'B', poshmarkStatus: 'published', price: '33', createdAt: new Date('2026-08-02') },
  ];
  const r = resolveConflicts(members);
  assert.deepEqual(r.members.map(m => m._id).sort(), ['ebay1', 'posh2']);
  assert.deepEqual(r.setAside.map(m => m._id), ['posh1']);
});

test('resolveConflicts: listing date breaks the tie when price is unavailable on either side', () => {
  const members = [
    { _id: 'ebay1', ebayListingId: '1', ebayStatus: 'published', createdAt: new Date('2026-08-01') },
    { _id: 'posh1', poshmarkListingId: 'A', poshmarkStatus: 'published', createdAt: new Date('2026-07-01') },
    { _id: 'posh2', poshmarkListingId: 'B', poshmarkStatus: 'published', createdAt: new Date('2026-08-02') }, // closer to the eBay date
  ];
  const r = resolveConflicts(members);
  assert.deepEqual(r.members.map(m => m._id).sort(), ['ebay1', 'posh2']);
  assert.deepEqual(r.setAside.map(m => m._id), ['posh1']);
});

test('resolveConflicts: no price or date on any side leaves the whole cluster unresolved, same as before', () => {
  const members = [
    { _id: 'ebay1', ebayListingId: '1', ebayStatus: 'published' },
    { _id: 'posh1', poshmarkListingId: 'A', poshmarkStatus: 'published' },
    { _id: 'posh2', poshmarkListingId: 'B', poshmarkStatus: 'published' },
  ];
  const r = resolveConflicts(members);
  assert.equal(r.members.length, 0);
  assert.equal(r.setAside.length, 3);
});

test('resolveConflicts: a delisted platform ID is not a real conflict with a live one on the other side', () => {
  // Real production example: Croft & Barrow Cargo Pants. The eBay side's OWN earlier eBay listing
  // was delisted (ebayStatus stale, but the ID was never cleared), and it already carries a live
  // Poshmark ID from an earlier merge. The new eBay record is a live, unrelated eBay relist of the
  // exact same item (title 100%, size match, photo distance 0) - platformsOf must see only the live
  // eBay holder, not treat the dead one as a second claimant with nothing to rank it against.
  const members = [
    { _id: 'a', ebayListingId: '206552480422', ebayStatus: 'delisted', poshmarkListingId: 'P1', poshmarkStatus: 'published', price: '21.59' },
    { _id: 'b', ebayListingId: '206622076233', ebayStatus: 'published', price: '19.43' },
  ];
  const r = resolveConflicts(members);
  assert.deepEqual(r.members.map(m => m._id).sort(), ['a', 'b']);
  assert.equal(r.setAside.length, 0);
});

test('resolveConflicts: a cluster with no conflict at all is returned unchanged', () => {
  const members = [
    { _id: 'ebay1', ebayListingId: '1', ebayStatus: 'published', price: '20' },
    { _id: 'posh1', poshmarkListingId: 'A', poshmarkStatus: 'published', price: '22' },
  ];
  const r = resolveConflicts(members);
  assert.deepEqual(r.members.map(m => m._id).sort(), ['ebay1', 'posh1']);
  assert.equal(r.setAside.length, 0);
});
