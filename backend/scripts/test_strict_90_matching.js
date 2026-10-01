const mongoose = require('mongoose');
require('dotenv').config();

const GARMENT_TYPES = [
  'jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'cardigan', 'vest', 'windbreaker', 'puffer', 'fleece',
  'jeans', 'pants', 'shorts', 'sweatpants', 'joggers', 'trousers', 'chinos', 'chino', 'overalls',
  'shirt', 'tee', 't-shirt', 'polo', 'button', 'top', 'jersey', 'tank',
  'shoes', 'sneakers', 'boots', 'sandals', 'slides', 'loafers',
  'hat', 'cap', 'beanie', 'belt', 'bag', 'backpack', 'wallet', 'dress', 'skirt'
];

const COMMON_COLORS = new Set([
  'black', 'white', 'blue', 'pink', 'red', 'green', 'yellow', 'purple', 'orange',
  'grey', 'gray', 'brown', 'beige', 'khaki', 'navy', 'olive', 'teal', 'burgundy',
  'maroon', 'tan', 'cream', 'gold', 'silver'
]);

const cleanUnicode = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeStr = (str) => {
  if (!str) return '';
  return cleanUnicode(str).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

const extractGarmentType = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const t of GARMENT_TYPES) {
    const reg = new RegExp(`\\b${t}\\b`, 'i');
    if (reg.test(lower)) return t;
  }
  return null;
};

const extractSize = (text) => {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  const dimMatch = lower.match(/\b(\d{2})x(\d{2})\b/);
  if (dimMatch) return dimMatch[0]; // e.g. "30x32"
  const letterMatch = lower.match(/\b(xxs|xs|s|m|l|xl|xxl|2xl|3xl|xxxl)\b/);
  if (letterMatch) return letterMatch[1];
  const numMatch = lower.match(/\b(28|29|30|31|32|33|34|35|36|38|40|42|44)\b/);
  if (numMatch) return numMatch[1];
  return null;
};

const areSizesCompatible = (s1, s2) => {
  if (!s1 || !s2) return true;
  if (s1 === s2) return true;
  // If s1 is "30x32" and s2 is "30" (or vice versa)
  if (s1.includes('x') && !s2.includes('x')) {
    const waist = s1.split('x')[0];
    return waist === s2;
  }
  if (s2.includes('x') && !s1.includes('x')) {
    const waist = s2.split('x')[0];
    return waist === s1;
  }
  return false;
};

const extractColor = (text) => {
  if (!text) return '';
  const lower = String(text).toLowerCase();
  const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/);
  const found = words.filter(w => COMMON_COLORS.has(w));
  return found.join('_');
};

// Calculate exact title similarity (Token Jaccard & Character Bigram Dice & Prefix)
function calculateTitleSimilarity(titleA, titleB) {
  const normA = normalizeStr(titleA);
  const normB = normalizeStr(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // 1. Token similarity
  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let matchCount = 0;
  for (const t of setA) {
    if (setB.has(t)) matchCount++;
  }
  const tokenSim = (2 * matchCount) / (setA.size + setB.size);

  // 2. Character Bigram Dice Similarity
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);
  let bigramMatch = 0;
  for (const b of bigramsA) {
    if (bigramsB.has(b)) bigramMatch++;
  }
  const bigramSim = (2 * bigramMatch) / (bigramsA.size + bigramsB.size);

  // For Poshmark 50-char truncation: check if prefix matches at least 90% of the shorter string
  let prefixSim = 0;
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 25) {
    if (normA.startsWith(normB) || normB.startsWith(normA)) {
      prefixSim = 0.95;
    }
  }

  return Math.max(tokenSim, bigramSim, prefixSim);
}

// Strict match checker enforcing >= 90% title similarity, <= $3.00 price diff, garment/size/brand/color guards
function isStrictMatch(itemA, itemB) {
  const priceA = parseFloat(itemA.selling_price || itemA.price || 0) || 0;
  const priceB = parseFloat(itemB.selling_price || itemB.price || 0) || 0;

  // 1. Price Guard: Max $3.00 difference (as requested by user)
  if (priceA > 0 && priceB > 0) {
    if (Math.abs(priceA - priceB) > 3.00) {
      return false;
    }
  }

  // 2. Garment Guard: Must not be different garments (e.g. shorts vs sweatpants)
  const gA = extractGarmentType(itemA.title);
  const gB = extractGarmentType(itemB.title);
  if (gA && gB && gA !== gB) {
    return false;
  }

  // 3. Size Guard: Must be compatible (e.g. 30x32 matches 30 or 30x32, not 38x30 or L)
  const sA = extractSize(itemA.size || itemA.title);
  const sB = extractSize(itemB.size || itemB.title);
  if (sA && sB && !areSizesCompatible(sA, sB)) {
    return false;
  }

  // 4. Color Guard: If both have colors, must match
  const cA = extractColor(itemA.color || itemA.title);
  const cB = extractColor(itemB.color || itemB.title);
  if (cA && cB && cA !== cB) {
    return false;
  }

  // 5. Brand Guard: If both have brands, must match
  const bA = normalizeStr(itemA.brand);
  const bB = normalizeStr(itemB.brand);
  if (bA && bB && bA !== bB) {
    return false;
  }

  // 6. Title Similarity >= 90% (0.90)
  const sim = calculateTitleSimilarity(itemA.title, itemB.title);
  return sim >= 0.90;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const User = require('../models/User');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  const ebayProds = await Product.find({ user: userId, $or: [{ source: 'ebay' }, { platform: 'ebay' }], status: { $in: ['active', 'live', 'published'] } }).lean();
  const poshProds = await Product.find({ user: userId, $or: [{ source: 'poshmark' }, { platform: 'poshmark' }], status: { $in: ['active', 'live', 'published'] } }).lean();
  const mercProds = await Product.find({ user: userId, $or: [{ source: 'mercari' }, { platform: 'mercari' }], status: { $in: ['active', 'live', 'published'] } }).lean();

  console.log(`Loaded Products: eBay=${ebayProds.length}, Poshmark=${poshProds.length}, Mercari=${mercProds.length}`);

  let matchedPosh = 0;
  let standalonePosh = 0;
  let matchedMerc = 0;
  let standaloneMerc = 0;

  // Map eBay products by id
  const masterList = ebayProds.map(e => ({
    title: e.title,
    price: e.selling_price || e.price,
    sku: e.sku,
    brand: e.brand,
    size: e.size,
    color: e.color,
    ebay: e,
    poshmark: null,
    mercari: null
  }));

  // Match Poshmark
  for (const p of poshProds) {
    const matched = masterList.find(m => !m.poshmark && isStrictMatch(m, p));
    if (matched) {
      matched.poshmark = p;
      matchedPosh++;
    } else {
      standalonePosh++;
      masterList.push({
        title: p.title,
        price: p.selling_price || p.price,
        sku: p.sku,
        brand: p.brand,
        size: p.size,
        color: p.color,
        ebay: null,
        poshmark: p,
        mercari: null
      });
    }
  }

  // Match Mercari
  for (const m of mercProds) {
    const matched = masterList.find(mMaster => !mMaster.mercari && isStrictMatch(mMaster, m));
    if (matched) {
      matched.mercari = m;
      matchedMerc++;
    } else {
      standaloneMerc++;
      masterList.push({
        title: m.title,
        price: m.selling_price || m.price,
        sku: m.sku,
        brand: m.brand,
        size: m.size,
        color: m.color,
        ebay: null,
        poshmark: null,
        mercari: m
      });
    }
  }

  console.log(`\nMatch Results with Strict >= 90% Title & <= $3 Price:`);
  console.log(`  eBay Total: ${ebayProds.length}`);
  console.log(`  Poshmark Matched to eBay: ${matchedPosh}, Standalone: ${standalonePosh} (Total: ${poshProds.length})`);
  console.log(`  Mercari Matched: ${matchedMerc}, Standalone: ${standaloneMerc} (Total: ${mercProds.length})`);
  console.log(`  Total Resulting Master Listings: ${masterList.length}`);

  // Test checking the specific items mentioned by user
  console.log('\n--- Checking User Specific Problem Items ---');
  const checkKeys = ['Tommy Bahama Cargo Shorts', 'Mack Weldon', "Levi's 511", 'US Army APFU'];
  for (const k of checkKeys) {
    const found = masterList.filter(m => m.title.toLowerCase().includes(k.toLowerCase()));
    console.log(`\nMatching for keyword "${k}" (Found ${found.length} listings):`);
    found.forEach((f, idx) => {
      console.log(`  [${idx + 1}] Title: "${f.title}"`);
      console.log(`      eBay: ${f.ebay ? `"${f.ebay.title}" ($${f.ebay.selling_price || f.ebay.price})` : 'NONE'}`);
      console.log(`      Poshmark: ${f.poshmark ? `"${f.poshmark.title}" ($${f.poshmark.selling_price || f.poshmark.price})` : 'NONE'}`);
      console.log(`      Mercari: ${f.mercari ? `"${f.mercari.title}" ($${f.mercari.selling_price || f.mercari.price})` : 'NONE'}`);
    });
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
