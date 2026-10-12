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
  // The gender-anchored match ("kids 4t") now wins before the bare fallback is even tried, so the
  // SKU code's "L" is never reached - correctly reading the real size "4t" instead of nothing.
  assert.equal(m.sizeFromTitle("Mud Pie Caramel Cord Shacket 11080111-L Kids 4T-5T Brown Corduroy Shirt"), '4t');
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

test('ageGroupFromTitle reads kids/mens/womens/unisex words', () => {
  assert.equal(m.ageGroupFromTitle('Nike Sportswear Club Knit Jogger Pants Kids XL Black'), 'kids');
  assert.equal(m.ageGroupFromTitle('Nike Jogger Pants Mens XL Black Soft Fleece'), 'mens');
  assert.equal(m.ageGroupFromTitle("Columbia Women's Peak to Park Coat Green"), 'womens');
  assert.equal(m.ageGroupFromTitle('Champion Unisex Reverse Weave Hoodie Gray'), 'unisex');
  assert.equal(m.ageGroupFromTitle('Ceramic Coffee Mug Blue'), '');
});

test('ageGroupsCompatible: kids never matches an adult group, unisex matches anything, blank never blocks', () => {
  assert.ok(!m.ageGroupsCompatible('kids', 'mens'));
  assert.ok(!m.ageGroupsCompatible('mens', 'womens'));
  assert.ok(m.ageGroupsCompatible('unisex', 'mens'));
  assert.ok(m.ageGroupsCompatible('mens', 'mens'));
  assert.ok(m.ageGroupsCompatible('', 'kids'));
  assert.ok(m.ageGroupsCompatible('', ''));
});

test('a real production false positive: "Kids XL" is never the same item as "Mens XL"', () => {
  // Same photo distance, same brand, overlapping words and the same extracted size letter "xl" -
  // this exact pair merged in production before the age-group check existed.
  const same = '1'.repeat(144);
  const a = {
    id: 'a', platform: 'ebay',
    title: 'Nike Sportswear Club Knit Jogger Pants Kids XL Black Elastic Waist Tapered Leg',
    brand: 'Nike', price: 17.99, imageHash: same
  };
  const b = {
    id: 'b', platform: 'poshmark',
    title: 'Nike Jogger Pants Mens XL Black Soft Fleece Drawstring Tapered Leg Activewear',
    brand: 'Nike', price: 27, imageHash: same
  };
  assert.equal(m.scorePair(a, b), null);
});

test('a real production false positive: two different brands of generic jeans do not match on title + photo alone', () => {
  // Neither brand field nor size is confirmed on both sides (one is blank/unrecognized), and the
  // title overlap is only the generic "straight jeans mens blue medium wash denim" wording, not an
  // (near-)exact title - this exact pair matched in production before this guard existed.
  const a = {
    id: 'a', platform: 'ebay',
    title: 'Mott & Bow Straight Jeans W38 L30 Mens Blue Medium Wash Comfort Stretch Denim',
    brand: '', size: '', price: '35', imageHash: '1'.repeat(126) + '0'.repeat(18)
  };
  const b = {
    id: 'b', platform: 'poshmark',
    title: "Levi's Premium 511 Straight Jeans Mens 38x32 Medium Wash Blue Denim Everyday",
    brand: "Levi's", size: '38', price: '21', imageHash: '1'.repeat(144)
  };
  assert.equal(m.scorePair(a, b), null);
});

test('a partial title match still works when brand or size is actually confirmed', () => {
  const same = '1'.repeat(144);
  const bothBrand = { id: 'a', platform: 'ebay', title: 'Bonobos Jeans Mens 35x34 Blue Denim Straight Leg', brand: 'Bonobos', price: 23, imageHash: same };
  const bothBrandB = { id: 'b', platform: 'poshmark', title: 'Bonobos Jeans Blue Denim Straight Leg Athletic Fit', brand: 'Bonobos', price: 22, imageHash: same };
  assert.ok(m.scorePair(bothBrand, bothBrandB));

  const bothSize = { id: 'c', platform: 'ebay', title: 'Target Brand Straight Jeans Mens Blue Medium Wash Comfort Stretch Denim', size: '38', price: 20, imageHash: same };
  const bothSizeB = { id: 'd', platform: 'poshmark', title: 'Another Co Straight Jeans Mens 38x32 Medium Wash Blue Denim Everyday', size: '38', price: 21, imageHash: same };
  assert.ok(m.scorePair(bothSize, bothSizeB));
});

test('normalizeSize discards free text that is not plausibly a size', () => {
  assert.equal(m.normalizeSize("Can't read tag, check measurements"), '');
  assert.equal(m.normalizeSize('undefined'), '');
  assert.equal(m.normalizeSize('Unknown'), '');
  assert.equal(m.normalizeSize('3BB'), '3bb');
  assert.equal(m.normalizeSize('9.5M'), '9.5m');
  assert.equal(m.normalizeSize('14R'), '14r');
});

test('sizesCompatible: a waist x inseam pair matches a suffixed bare waist (15x32 vs 15J)', () => {
  assert.ok(m.sizesCompatible('15x32', '15j'));
  assert.ok(m.sizesCompatible('15j', '15x32'));
  assert.ok(!m.sizesCompatible('15x32', '16j'));
});

test('a real production example: a junk size-field value does not block a title + photo match', () => {
  // The Poshmark size field literally said "Can't read tag, check measurements" - not a size at
  // all, but it used to be compared as if it conflicted with the eBay listing's title size "37x32".
  const same = '1'.repeat(144);
  const a = {
    id: 'a', platform: 'ebay',
    title: "Revtown Automatic Jeans Men's 37x32 Blue Decade Denim Stretch Dark Wash No Tag",
    price: 29.95, imageHash: same
  };
  const b = {
    id: 'b', platform: 'poshmark',
    title: "Revtown Automatic Jeans Men's 37x32 Blue Decade Denim Stretch Dark Wash No Tag",
    size: "Can't read tag, check measurements", price: 23, imageHash: same
  };
  const s = m.scorePair(a, b);
  assert.ok(s && s.score >= 50);
});

test('spelled-out size words are only read right after the gender word or "size", not scanned for everywhere', () => {
  // "Medium Wash" is a denim finish, not a Medium - reading it as one blocked a real match (both
  // sides share the same exact title) until this was found via production data.
  assert.equal(m.sizeFromTitle('Mott & Bow Straight Jeans W38 L30 Mens Blue Medium Wash Comfort Stretch Denim'), '');
  assert.equal(m.sizeFromTitle('Carhartt Jacket Mens Large Pocket Workwear Canvas'), 'l');
  assert.equal(m.sizeFromTitle('Levi Jeans Size Large Blue Denim'), 'l');
});

test('a decimal size with a trailing width letter keeps the decimal (8.5B, not 8)', () => {
  assert.equal(m.sizeFromTitle('Hoka One One Challenger ATR 6 Running Shoes Womens 8.5B Vallarta Blue Pink'), '8.5b');
  assert.equal(m.sizesCompatible('8.5b', '8.5'), true);
});

test('"2XL" and "XXL" (and "3XL"/"XXXL") are the same size, written two ways', () => {
  assert.ok(m.sizesCompatible('2xl', 'xxl'));
  assert.ok(m.sizesCompatible('xxl', '2xl'));
  assert.ok(m.sizesCompatible('3xl', 'xxxl'));
  assert.ok(m.sizesCompatible('xl', 'xl'));
  assert.ok(!m.sizesCompatible('2xl', 'xl'));
  assert.ok(!m.sizesCompatible('2xl', '3xl'));
});

test('three more real production examples that now correctly match', () => {
  const same = '1'.repeat(144);
  const mottA = { id: 'a', platform: 'ebay', title: 'Mott & Bow Straight Jeans W38 L30 Mens Blue Medium Wash Comfort Stretch Denim', price: 35, imageHash: same };
  const mottB = { id: 'b', platform: 'poshmark', title: 'Mott & Bow Straight Jeans W38 L30 Mens Blue Medium Wash Comfort Stretch Denim', brand: 'Mott & Bow', size: '38', price: 39, imageHash: same };
  assert.ok(m.scorePair(mottA, mottB));

  const hokaA = { id: 'a', platform: 'ebay', title: 'Hoka One One Challenger ATR 6 Running Shoes Womens 8.5B Vallarta Blue Pink', price: 69.99, imageHash: same };
  const hokaB = { id: 'b', platform: 'poshmark', title: 'Hoka One One Challenger ATR 6 Running Shoes Womens 8.5B Vallarta Blue Pink', brand: 'Hoka One One', size: '8.5', price: 70, imageHash: same };
  assert.ok(m.scorePair(hokaA, hokaB));

  const cremA = { id: 'a', platform: 'ebay', title: 'Vintage Cremieux Suede Bomber Jacket Mens 2XL Brown Genuine Leather Outdoor', price: 69.95, imageHash: same };
  const cremB = { id: 'b', platform: 'poshmark', title: 'Vintage Cremieux Suede Bomber Jacket Mens 2XL Brown Genuine Leather Outdoor', brand: 'Flight Mode', size: 'XXL', price: 70, imageHash: same };
  assert.ok(m.scorePair(cremA, cremB));
});

test('"Lg" and "Sm" (two-letter abbreviations) are read as Large and Small', () => {
  assert.equal(m.sizeFromTitle('Polo Ralph Lauren Camouflage Waffle Knit Thermal Type Cuffed Mens Lg'), 'l');
  assert.equal(m.sizeFromTitle('TOMMY HILFIGER Shawl Neck Knit Cotton Jumper Sweater Men Sm Gray VR1827'), 's');
  assert.ok(m.sizesCompatible('lg', 'l'));
  assert.ok(m.sizesCompatible('sm', 's'));
  assert.ok(m.sizesCompatible('md', 'm'));
  assert.ok(!m.sizesCompatible('lg', 's'));
});

test('a real production example: "Mens Lg" in the title matches a Poshmark "L" size field', () => {
  const hashA = '0'.repeat(144);
  const hashB = '1'.repeat(36) + '0'.repeat(108); // distance 36: past the normal threshold, within the high-confidence one
  const a = { id: 'a', platform: 'ebay', title: 'Polo Ralph Lauren Camouflage Waffle Knit Thermal Type Cuffed Mens Lg', price: 24.25, imageHash: hashA };
  const b = { id: 'b', platform: 'poshmark', title: 'Polo Ralph Lauren Camouflage Waffle Knit Thermal Type Cuffed Mens Lg', brand: 'Ralph Lauren', size: 'L', price: 23, imageHash: hashB };
  const s = m.scorePair(a, b);
  assert.ok(s && s.reasons.includes('size'));
});

test('brandsCompatible: exact match, one a prefix-expansion of the other, punctuation-only differences', () => {
  assert.ok(m.brandsCompatible('Lululemon', 'lululemon athletica'));
  assert.ok(m.brandsCompatible('Ralph Lauren', 'Polo Ralph Lauren'));
  assert.ok(m.brandsCompatible('L.L. Bean', 'L.L.Bean'));
  assert.ok(m.brandsCompatible('Mizzen + Main', 'Mizzen+Main'));
  assert.ok(!m.brandsCompatible('Nike', 'Adidas'));
  // a plain substring check would wrongly match these - must be a whole-word prefix, not mid-word
  assert.ok(!m.brandsCompatible('Levi', 'Levine'));
  assert.ok(!m.brandsCompatible('ID', 'ID.EIGHT'));
});

test('a real production example: "Lululemon" matches "lululemon athletica" (and everything else agrees)', () => {
  const a = { id: 'a', platform: 'ebay', title: 'Lululemon ABC Pants Mens 34 Navy Blue Warpstreme Slim Fit 5-Pocket Flat Front', brand: 'Lululemon', size: '34', price: 30.99, imageHash: '1'.repeat(28) + '0'.repeat(116) };
  const b = { id: 'b', platform: 'poshmark', title: 'Lululemon ABC Pants Mens 34 Navy Blue Warpstreme Slim Fit 5-Pocket Flat Front', brand: 'lululemon athletica', size: '34', price: 31, imageHash: '0'.repeat(144) };
  const s = m.scorePair(a, b);
  assert.ok(s && s.reasons.includes('brand'));
});

test('a size letter code plus one trailing letter is the base size (kids Boys/Girls suffix on a platform)', () => {
  assert.ok(m.sizesCompatible('xlb', 'xl'));
  assert.ok(m.sizesCompatible('sb', 's'));
  assert.ok(m.sizesCompatible('lb', 'l'));
  assert.ok(m.sizesCompatible('lg', 'l'));
  assert.ok(m.sizesCompatible('sm', 's'));
  assert.ok(m.sizesCompatible('md', 'm'));
  // distinct real sizes must not collapse into each other
  assert.ok(!m.sizesCompatible('xs', 's'));
  assert.ok(!m.sizesCompatible('m', 'l'));
});

test('a real production bug: a parenthetical measurement note no longer outranks the stated size', () => {
  // User-reported: the Poshmark listing's own size field says "Waist 32", matching the eBay
  // title's "Mens 32" - the "(31x29)" is a tag/actual-measurement caveat, not the real size.
  assert.equal(
    m.sizeFromTitle('Peter Millar Corduroy Pants Mens 32 Brown 5-Pocket Straight Leg Classic (31x29)'),
    '32'
  );
  assert.equal(
    m.sizeFromTitle("Wrangler Retro Jeans Women's 14R Blue Denim Relaxed Straight Fit Jeans  (26x30)"),
    '14r'
  );
  // a title with no gender-anchored size still reads the pair as before
  assert.equal(m.sizeFromTitle('Levi 501 Jeans Mens 35x34 Blue Denim'), '35x34');
});

test('a real production example: Peter Millar Corduroy Pants eBay and Poshmark now match', () => {
  const same = '1'.repeat(144);
  const a = { id: 'a', platform: 'ebay', title: 'Peter Millar Corduroy Pants Mens 32 Brown 5-Pocket Straight Leg Classic (31x29)', price: 26.09, imageHash: same };
  const b = { id: 'b', platform: 'poshmark', title: 'Peter Millar Corduroy Pants Mens 32 Brown 5-Pocket Straight Leg Classic (31x29)', brand: 'Peter Millar', size: '32', price: 26, imageHash: same };
  const s = m.scorePair(a, b);
  assert.ok(s && s.reasons.includes('size'));
});

test('a real production example: cross-platform prices 42-49% apart are still the same item (verified same photo)', () => {
  // User-verified by comparing the actual eBay and Poshmark photos: these are the same garment,
  // priced differently per platform (eBay lower, Poshmark higher where buyers haggle via offers).
  assert.ok(m.priceClose('34.95', '69'));   // MASONS Italian Pants: 49% apart
  assert.ok(m.priceClose('49.95', '27'));   // Robert Graham Shirt: 46% apart
  assert.ok(m.priceClose('49.95', '86'));   // Nike Dunk High SE: 42% apart
  // a gross mismatch (single item vs. a bundle, a data error) still blocks
  assert.ok(!m.priceClose('10', '100'));
});
