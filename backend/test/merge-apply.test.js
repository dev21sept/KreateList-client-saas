const test = require('node:test');
const assert = require('node:assert/strict');
const { clusterPairs } = require('../services/mergeApply');

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
