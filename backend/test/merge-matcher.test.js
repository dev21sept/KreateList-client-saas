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

test('dHash: pixels increasing in both directions give all-one bits, decreasing give all-zero bits', () => {
  // 9x9 grid, value = row*10 + col: strictly increasing left-to-right and top-to-bottom, no ties.
  const inc = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9) * 10 + (i % 9));
  const dec = Array.from({ length: 81 }, (_, i) => 100 - (Math.floor(i / 9) * 10 + (i % 9)));
  assert.equal(m.dHashFromPixels(inc), '1'.repeat(144));
  assert.equal(m.dHashFromPixels(dec), '0'.repeat(144));
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
  const a = { id: 'a', platform: 'ebay', title: 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg', brand: 'Bonobos', size: '35', price: 23, imageHash: '1'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Bonobos Jeans Blue Denim Straight Leg Athletic Fit', brand: 'Bonobos', size: '35', price: 22, imageHash: '1'.repeat(144) };
  const s = m.scorePair(a, b);
  assert.ok(s && s.score >= 50);
  assert.ok(s.reasons.includes('brand') && s.reasons.includes('size'));
});

test('a matching photo alone (no brand or size) is not enough', () => {
  const same = '1'.repeat(144);
  const a = { id: 'a', platform: 'ebay', title: 'Nike Hoodie Black', imageHash: same };
  const b = { id: 'b', platform: 'poshmark', title: 'Levi Jeans Blue', imageHash: same };
  assert.equal(m.scorePair(a, b), null);
});

test('suggestPairs returns pairs sorted by score', () => {
  const recs = [
    { id: 'e1', platform: 'ebay', title: 'Bonobos Jeans Blue Denim', brand: 'Bonobos', size: '35', price: 23, imageHash: '1'.repeat(144) },
    { id: 'p1', platform: 'poshmark', title: 'Bonobos Jeans Blue Denim', brand: 'Bonobos', size: '35', price: 23, imageHash: '1'.repeat(144) },
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
  const ebay = { id: 'a', platforms: ['ebay'], title: 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg', brand: 'Bonobos', size: '35', price: 23, imageHash: '1'.repeat(144) };
  const posh = { id: 'b', platforms: ['poshmark'], title: 'Bonobos Jeans Blue Denim Straight Leg Athletic Fit', brand: 'Bonobos', size: '35', price: 22, imageHash: '1'.repeat(144) };
  assert.ok(m.scorePair(ebay, posh));
});

test('size is read from the title when the size field is empty', () => {
  assert.equal(m.sizeFromTitle('Nike Jogger Pants Mens M Heather Gray'), 'm');
  assert.equal(m.sizeFromTitle('Nike Jogger Pants Mens XL Gray'), 'xl');
  assert.equal(m.sizeFromTitle('Levi 501 Jeans Mens 34x31 Black'), '34x31');
  assert.equal(m.sizeFromTitle('Ceramic Coffee Mug Blue'), '');
});

test('a bare size right after the gender word is read, even with no x-pair', () => {
  assert.equal(m.sizeFromTitle("DUER N2X Slim Fit MFNS1001 Mens 31 Grey Performance Stretch Chino Pants"), '31');
  assert.equal(m.sizeFromTitle('5.11 Tactical Stryke 64386 Womens 20 Long Black Cargo Utility Pants'), '20');
  assert.equal(m.sizeFromTitle('American Apparel Riding Pant RSANP0310 Womens M Gold Ribbed Equestrian Trousers'), 'm');
  assert.equal(m.sizeFromTitle('Nike Hoodie Mens 2XL Black Pullover'), '2xl');
});

test('different sizes in titles block the pair even when the size field is empty', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Nike Jogger Pants Mens M Heather Gray Therma Fit', brand: 'Nike', price: 30, imageHash: '1'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Nike Jogger Pants Mens XL Gray Slacker Therma Fit', brand: 'Nike', price: 30, imageHash: '1'.repeat(144) };
  assert.equal(m.scorePair(a, b), null);
});

test('a photo just past the normal distance threshold is not a strong match on its own', () => {
  // Titles share 4 of 6 words (66%): enough for the title score (>=60%), not enough for the
  // high-confidence tier (>=90%), so the normal PHOTO_DIST_THRESHOLD (32) applies.
  const a = { id: 'a', platform: 'ebay', title: 'Nike Hoodie Mens Black Pullover Fleece Drawstring Comfortable', brand: 'Nike', size: '32', price: 20, imageHash: '0'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Nike Hoodie Black Pullover Casual Warm', brand: 'Nike', size: '32', price: 20, imageHash: '1'.repeat(33) + '0'.repeat(111) };
  const s = m.scorePair(a, b);
  assert.ok(!s || !s.reasons.some(r => r.startsWith('photo distance')));
});

test('an exact title and a confirmed size tolerate a farther photo, up to a higher cap', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Levi Jeans Blue Denim Straight', size: '32', price: 20, imageHash: '0'.repeat(144) };
  const withinHighConfidence = { id: 'b', platform: 'poshmark', title: 'Levi Jeans Blue Denim Straight', size: '32', price: 20, imageHash: '1'.repeat(45) + '0'.repeat(99) };
  const pastHighConfidence = { id: 'c', platform: 'poshmark', title: 'Levi Jeans Blue Denim Straight', size: '32', price: 20, imageHash: '1'.repeat(51) + '0'.repeat(93) };
  const s1 = m.scorePair(a, withinHighConfidence);
  assert.ok(s1 && s1.reasons.some(r => r.startsWith('photo distance')));
  const s2 = m.scorePair(a, pastHighConfidence);
  assert.ok(!s2 || !s2.reasons.some(r => r.startsWith('photo distance')));
});

test('a waist-only size field matches a waist x inseam size from the title', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Duluth Trading Jeans Mens 35x32 Black Dark Wash Straight Leg', brand: 'Duluth', price: 22, imageHash: '1'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Duluth Trading Jeans Mens Black Dark Wash Straight Leg', brand: 'Duluth', size: '35', price: 18, imageHash: '1'.repeat(144) };
  const s = m.scorePair(a, b);
  assert.ok(s && s.reasons.includes('size'));
});

test('a waist-only size does not match a different waist x inseam pair', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Levi Jeans Mens 36x32 Blue Denim Straight', brand: 'Levi', price: 22, imageHash: '1'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Levi Jeans Mens Blue Denim Straight', brand: 'Levi', size: '34', price: 22, imageHash: '1'.repeat(144) };
  assert.equal(m.scorePair(a, b), null);
});

test('sizesCompatible: equal sizes, waist-only vs waist x inseam, and mismatches', () => {
  assert.ok(m.sizesCompatible('32', '32'));
  assert.ok(m.sizesCompatible('35x32', '35'));
  assert.ok(m.sizesCompatible('35', '35x32'));
  assert.ok(!m.sizesCompatible('35x32', '36'));
  assert.ok(!m.sizesCompatible('m', 'l'));
  assert.ok(!m.sizesCompatible('', '32'));
});

test('sizesCompatible: a sizing-convention letter suffix (20W, 32P, 7J) matches the bare number', () => {
  assert.ok(m.sizesCompatible('20', '20w'));
  assert.ok(m.sizesCompatible('32p', '32'));
  assert.ok(m.sizesCompatible('7', '7j'));
  assert.ok(!m.sizesCompatible('20', '22w'));
});

test('the possessive "s" in "Men\'s" / "Women\'s" is never read as a Small', () => {
  assert.equal(m.sizeFromTitle("Tommy Bahama Sarasota Stretch Men's Long Sleeve Blue Check No Tags Read"), '');
  assert.equal(m.sizeFromTitle("Nike Sweatpants Vintage 80's Mens Black Embroidered Swoosh \"Read\""), '');
  assert.notEqual(m.sizeFromTitle("Levi's 569 Jean Shorts Mens W38 Blue Denim Medium Wash"), 's');
});

test('a style/SKU code\'s trailing letter is not read as a size', () => {
  assert.equal(m.sizeFromTitle("Mud Pie Caramel Cord Shacket 11080111-L Kids 4T-5T Brown Corduroy Shirt"), '');
  assert.equal(m.sizeFromTitle("Some Item ABC123-M Blue"), '');
});

test('a size missing on one side does not block an otherwise strong title + photo match', () => {
  const same = '1'.repeat(144);
  const a = {
    id: 'a', platform: 'ebay',
    title: 'Polo Ralph Lauren Camouflage Waffle Knit Thermal Type Cuffed Mens Lg',
    price: 24, imageHash: same
  }; // no size field, and "Lg" is not a recognized size word, so sizeFromTitle is ''
  const b = {
    id: 'b', platform: 'poshmark',
    title: 'Polo Ralph Lauren Camouflage Waffle Knit Thermal Type Cuffed Mens Lg',
    size: 'L', price: 23, imageHash: same
  };
  const s = m.scorePair(a, b);
  assert.ok(s && s.score >= 50);
});

test('a size present and genuinely different on both sides still blocks, even with a strong photo', () => {
  const same = '1'.repeat(144);
  const a = { id: 'a', platform: 'ebay', title: 'Nike Hoodie Mens M Black Pullover', brand: 'Nike', size: 'M', price: 24, imageHash: same };
  const b = { id: 'b', platform: 'poshmark', title: 'Nike Hoodie Mens M Black Pullover', brand: 'Nike', size: 'XL', price: 23, imageHash: same };
  assert.equal(m.scorePair(a, b), null);
});


test('title and brand alone (no size, no close photo) are not suggested', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Tommy Bahama Cargo Shorts Mens Blue Pleated', brand: 'Tommy Bahama', price: 30, imageHash: '0'.repeat(144) };
  const b = { id: 'b', platform: 'poshmark', title: 'Tommy Bahama Cargo Shorts Mens Blue Pleated', brand: 'Tommy Bahama', price: 30, imageHash: '1'.repeat(144) };
  assert.equal(m.scorePair(a, b), null);
});
