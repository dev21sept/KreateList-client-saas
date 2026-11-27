const test = require('node:test');
const assert = require('node:assert/strict');
const { pickEbayCategory } = require('../utils/ebayCategoryPick');

const node = (id, name, ancestors) => ({
  category: { categoryId: id, categoryName: name },
  categoryTreeNodeAncestors: ancestors
});
const APPAREL = [{ categoryName: 'Clothing, Shoes & Accessories', categoryTreeNodeLevel: 1 }];
const MEN = [...APPAREL, { categoryName: "Men's Clothing", categoryTreeNodeLevel: 2 }];
const WOMEN = [...APPAREL, { categoryName: "Women's Clothing", categoryTreeNodeLevel: 2 }];

test('uses the first relevant apparel suggestion, not the deepest one', () => {
  const picked = pickEbayCategory([
    node('11', 'Pants', MEN),
    node('22', 'Deep Leaf', [...MEN, { categoryName: 'Shirts', categoryTreeNodeLevel: 3 }, { categoryName: 'T-Shirts', categoryTreeNodeLevel: 4 }])
  ], 'Levi 501 Jeans Mens');
  assert.equal(picked.categoryId, '11');
});

test('deprioritizes fan/collectible matches when a better one exists', () => {
  const picked = pickEbayCategory([
    node('99', 'Olympics', [{ categoryName: 'Sports Mem, Cards & Fan Shop', categoryTreeNodeLevel: 1 }]),
    node('33', 'Coats, Jackets & Vests', MEN)
  ], 'JCPenney Olympic Windbreaker Jacket Mens L');
  assert.equal(picked.categoryId, '33');
});

test('a non-apparel item gets a real category, not nothing', () => {
  const HEALTH = [{ categoryName: 'Health & Beauty', categoryTreeNodeLevel: 1 }, { categoryName: 'Skin Care', categoryTreeNodeLevel: 2 }];
  const picked = pickEbayCategory([
    node('77', 'Cleansers', HEALTH)
  ], 'Cardinal Health Perineal Cleanser Soothing No-Rinse Liquid Size 4 oz');
  assert.equal(picked.categoryId, '77');
  assert.equal(picked.path, 'Health & Beauty > Skin Care > Cleansers');
});

test('a low-priority root is still used when it is the only valid suggestion', () => {
  const picked = pickEbayCategory([
    node('99', 'Olympics', [{ categoryName: 'Sports Mem, Cards & Fan Shop', categoryTreeNodeLevel: 1 }])
  ], 'Vintage 1980 Olympics Pin Collectible');
  assert.equal(picked.categoryId, '99');
});

test('prefers the women branch when the title says Womens', () => {
  const picked = pickEbayCategory([
    node('11', 'Pants', MEN),
    node('12', 'Pants', WOMEN)
  ], 'Bylt Premium Basics Pants Womens XL');
  assert.equal(picked.categoryId, '12');
});

test('returns null when nothing is a real leaf (caller must ask the user)', () => {
  assert.equal(pickEbayCategory([node('206', 'Clothing', APPAREL.slice(0, 0))], 'Some item'), null);
  assert.equal(pickEbayCategory([], 'Some item'), null);
});

test('builds the full path from ancestors in level order', () => {
  const picked = pickEbayCategory([
    node('55', 'Jeans', [...MEN.slice(0, 2).reverse()])
  ], 'Jeans Mens');
  assert.equal(picked.path, "Clothing, Shoes & Accessories > Men's Clothing > Jeans");
});
