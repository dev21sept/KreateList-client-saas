const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSizeAspect } = require('../utils/ebayAspects');

test('combined size "16 M" becomes standard Size M and Chest Size 16', () => {
  const out = normalizeSizeAspect({ Size: ['16 M'] });
  assert.deepEqual(out.Size, ['M']);
  assert.deepEqual(out['Chest Size'], ['16']);
});

test('a plain standard size is kept', () => {
  assert.deepEqual(normalizeSizeAspect({ Size: ['l'] }).Size, ['L']);
});

test('an existing Chest Size is not overwritten', () => {
  const out = normalizeSizeAspect({ Size: ['16 M'], 'Chest Size': ['40'] });
  assert.deepEqual(out['Chest Size'], ['40']);
});

test('non-standard sizes are left unchanged', () => {
  const out = normalizeSizeAspect({ Size: ['Fits 4-6 years'] });
  assert.deepEqual(out.Size, ['Fits 4-6 years']);
});

test('no Size aspect returns the input unchanged', () => {
  assert.deepEqual(normalizeSizeAspect({ Brand: ['Levi'] }), { Brand: ['Levi'] });
});
