const test = require('node:test');
const assert = require('node:assert/strict');
const { stripGenericCategoryRoot, resolveItem } = require('../services/pricing/itemResolver');
const { evaluateHardRejections } = require('../services/pricing/comparableMatcher');

test('generic eBay apparel root is removed from category text', () => {
  assert.equal(stripGenericCategoryRoot("Clothing, Shoes & Accessories > Men > Shirts").includes('Shoes'), false);
  assert.equal(stripGenericCategoryRoot('Shoes and Accessories'), ' ');
});

test('a shirt whose eBay category starts with Clothing, Shoes & Accessories is not footwear', () => {
  const target = resolveItem({
    title: 'Rockmount Ranch Wear Unisex Brown Vintage Western Shirt Size 16 M',
    brand: 'Rockmount Ranch Wear',
    model: '',
    condition: 'USED',
    category_hint: 'Clothing, Shoes & Accessories > Men > Men\'s Clothing > Shirts > Casual Button-Down Shirts'
  }).normalized;
  const candidate = {
    title: 'Rockmount Ranch Wear Vintage Red Plaid Long Sleeve Western Shirt',
    total_price: 60,
    condition: 'Used',
    categories: ['Casual Button-Down Shirts', "Men's Clothing", 'Clothing, Shoes & Accessories']
  };
  assert.deepEqual(evaluateHardRejections(target, candidate), []);
});

test('a real boot listing is still rejected for a shirt', () => {
  const target = resolveItem({
    title: 'Rockmount Ranch Wear Unisex Brown Vintage Western Shirt Size 16 M',
    brand: 'Rockmount Ranch Wear',
    model: '',
    condition: 'USED',
    category_hint: 'Clothing, Shoes & Accessories > Men > Men\'s Clothing > Shirts > Casual Button-Down Shirts'
  }).normalized;
  const boots = { title: 'Rockmount Western Cowboy Boots Men Size 10', total_price: 200, condition: 'Used', categories: ["Men's Shoes", 'Boots'] };
  assert.ok(evaluateHardRejections(target, boots).length > 0);
});
