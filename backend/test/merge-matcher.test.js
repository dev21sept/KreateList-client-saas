const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../services/mergeMatcher');

test('title tokens drop sizes, filler words and punctuation', () => {
  const t = m.titleTokens('Tommy Bahama Sarasota Stretch Men\'s Long Sleeve Blue Check 3XL No Tags Read');
  assert.ok(t.has('tommy') && t.has('bahama') && t.has('sarasota'));
  assert.ok(!t.has('3xl') && !t.has('no') && !t.has('read'));
});

test('title overlap is 1 for the same words and lower for different ones', () => {
  assert.equal(m.titleOverlap('Levi 501 Jeans Blue', 'Levi 501 Jeans Blue Denim'), 1);
  assert.ok(m.titleOverlap('Levi 501 Jeans', 'Nike Hoodie Black') < 0.2);
});

test('hamming distance counts differing bits', () => {
  assert.equal(m.hammingDistance('1010', '1001'), 2);
  assert.equal(m.hammingDistance('1010', '10'), Infinity);
});

test('dHash: an increasing row gives all-one bits, a decreasing row gives all-zero bits', () => {
  const inc = Array.from({ length: 72 }, (_, i) => i % 9);      // each row 0..8 increasing
  const dec = Array.from({ length: 72 }, (_, i) => 8 - (i % 9)); // each row decreasing
  assert.equal(m.dHashFromPixels(inc), '1'.repeat(64));
  assert.equal(m.dHashFromPixels(dec), '0'.repeat(64));
});

test('same platform records are never suggested as a pair', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Levi 501 Jeans', brand: 'Levi', size: '32', price: 20 };
  const b = { id: 'b', platform: 'ebay', title: 'Levi 501 Jeans', brand: 'Levi', size: '32', price: 20 };
  assert.equal(m.scorePair(a, b), null);
});

test('different brand or size blocks the pair', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Levi 501 Jeans', brand: 'Levi', size: '32', price: 20 };
  assert.equal(m.scorePair(a, { id: 'b', platform: 'poshmark', title: 'Levi 501 Jeans', brand: 'Wrangler', size: '32', price: 20 }), null);
  assert.equal(m.scorePair(a, { id: 'b', platform: 'poshmark', title: 'Levi 501 Jeans', brand: 'Levi', size: '34', price: 20 }), null);
});

test('a strong detail match across platforms is suggested with reasons', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg', brand: 'Bonobos', size: '35', price: 23 };
  const b = { id: 'b', platform: 'poshmark', title: 'Bonobos Jeans Blue Denim Straight Leg Athletic Fit', brand: 'Bonobos', size: '35', price: 22 };
  const s = m.scorePair(a, b);
  assert.ok(s && s.score >= 50);
  assert.ok(s.reasons.includes('brand') && s.reasons.includes('size'));
});

test('a matching photo alone (no brand or size) is not enough', () => {
  const same = '1'.repeat(64);
  const a = { id: 'a', platform: 'ebay', title: 'Nike Hoodie Black', imageHash: same };
  const b = { id: 'b', platform: 'poshmark', title: 'Levi Jeans Blue', imageHash: same };
  assert.equal(m.scorePair(a, b), null);
});

test('suggestPairs returns pairs sorted by score', () => {
  const recs = [
    { id: 'e1', platform: 'ebay', title: 'Bonobos Jeans Blue Denim', brand: 'Bonobos', size: '35', price: 23 },
    { id: 'p1', platform: 'poshmark', title: 'Bonobos Jeans Blue Denim', brand: 'Bonobos', size: '35', price: 23 },
    { id: 'p2', platform: 'poshmark', title: 'Nike Hoodie', brand: 'Nike', size: 'L', price: 40 },
  ];
  const pairs = m.suggestPairs(recs);
  assert.equal(pairs.length, 1);
  assert.deepEqual([pairs[0].a, pairs[0].b].sort(), ['e1', 'p1']);
});

test('a record that already holds an eBay and a Poshmark ID cannot pair with another eBay record', () => {
  const both = { id: 'a', platforms: ['ebay', 'poshmark'], title: 'Levi 501 Jeans Blue', brand: 'Levi', size: '32', price: 20 };
  const ebayOnly = { id: 'b', platforms: ['ebay'], title: 'Levi 501 Jeans Blue', brand: 'Levi', size: '32', price: 20 };
  assert.equal(m.scorePair(both, ebayOnly), null);
});

test('a record with eBay and a record with Poshmark only can pair when details match', () => {
  const ebay = { id: 'a', platforms: ['ebay'], title: 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg', brand: 'Bonobos', size: '35', price: 23 };
  const posh = { id: 'b', platforms: ['poshmark'], title: 'Bonobos Jeans Blue Denim Straight Leg Athletic Fit', brand: 'Bonobos', size: '35', price: 22 };
  assert.ok(m.scorePair(ebay, posh));
});

test('size is read from the title when the size field is empty', () => {
  assert.equal(m.sizeFromTitle('Nike Jogger Pants Mens M Heather Gray'), 'm');
  assert.equal(m.sizeFromTitle('Nike Jogger Pants Mens XL Gray'), 'xl');
  assert.equal(m.sizeFromTitle('Levi 501 Jeans Mens 34x31 Black'), '34x31');
  assert.equal(m.sizeFromTitle('Ceramic Coffee Mug Blue'), '');
});

test('different sizes in titles block the pair even when the size field is empty', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Nike Jogger Pants Mens M Heather Gray Therma Fit', brand: 'Nike', price: 30, imageHash: '1'.repeat(64) };
  const b = { id: 'b', platform: 'poshmark', title: 'Nike Jogger Pants Mens XL Gray Slacker Therma Fit', brand: 'Nike', price: 30, imageHash: '1'.repeat(64) };
  assert.equal(m.scorePair(a, b), null);
});

test('a photo 8 bits apart is not a strong match on its own', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Levi Jeans Blue Denim Straight', brand: 'Levi', size: '32', price: 20, imageHash: '0'.repeat(64) };
  const far = '1'.repeat(8) + '0'.repeat(56);
  const b = { id: 'b', platform: 'poshmark', title: 'Levi Jeans Blue Denim Straight', brand: 'Levi', size: '32', price: 20, imageHash: far };
  const s = m.scorePair(a, b);
  assert.ok(!s || !s.reasons.some(r => r.startsWith('photo distance')));
});


test('title and brand alone (no size, no close photo) are not suggested', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Tommy Bahama Cargo Shorts Mens Blue Pleated', brand: 'Tommy Bahama', price: 30, imageHash: '0'.repeat(64) };
  const b = { id: 'b', platform: 'poshmark', title: 'Tommy Bahama Cargo Shorts Mens Blue Pleated', brand: 'Tommy Bahama', price: 30, imageHash: '1'.repeat(64) };
  assert.equal(m.scorePair(a, b), null);
});
