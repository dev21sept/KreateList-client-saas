const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrice, formatPrice } = require('../utils/priceParser');
const { mapToPoshmarkCategory } = require('../services/poshmarkCategoryMapper');

test('prices with thousands separators keep the full amount', () => {
  assert.equal(parsePrice('$1,299.00'), 1299);
  assert.equal(parsePrice('£1,050.50'), 1050.5);
  assert.equal(parsePrice('US $1,299.00'), 1299);
  assert.equal(parsePrice('1,299,000'), 1299000);
});

test('European decimal formats are parsed correctly', () => {
  assert.equal(parsePrice('€12,99'), 12.99);
  assert.equal(parsePrice('€1.234,50'), 1234.5);
  assert.equal(parsePrice('1.234.567'), 1234567);
});

test('formatPrice returns two decimals and null for unusable input', () => {
  assert.equal(formatPrice('$25'), '25.00');
  assert.equal(formatPrice(19.5), '19.50');
  assert.equal(formatPrice('free'), null);
  assert.equal(formatPrice(''), null);
});

test('eBay leaf category maps to the matching Poshmark category', () => {
  const result = mapToPoshmarkCategory({ ebayPath: 'Athletic Shoes', title: 'Nike runners', gender: 'Women' });
  assert.equal(result.path, 'Women > Shoes > Athletic Shoes');
  assert.ok(result.categoryId);
});

test('full eBay taxonomy path uses the leaf and the gender from the path', () => {
  const result = mapToPoshmarkCategory({
    ebayPath: "Clothing, Shoes & Accessories > Men > Men's Shoes > Athletic Shoes",
    title: 'Running shoes'
  });
  assert.equal(result.path, 'Men > Shoes > Athletic Shoes');
});

test('generic Clothing never maps to an unrelated pet category', () => {
  const result = mapToPoshmarkCategory({ ebayPath: 'Clothing', title: 'Blue cotton top', gender: 'Women' });
  assert.equal(result, null);
});

test('unknown categories return null instead of a random guess', () => {
  assert.equal(mapToPoshmarkCategory({ ebayPath: 'Vintage Telephones', title: 'Rotary phone' }), null);
});
