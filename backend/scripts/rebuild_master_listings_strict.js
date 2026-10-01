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

const KNOWN_BRANDS = [
  'peter millar', 'polo ralph lauren', 'ralph lauren', 'tommy bahama', 'eddie bauer',
  'lululemon', 'under armour', 'the north face', 'american eagle', 'lucky brand',
  'duluth trading', 'duluth', 'free people', 'anthropologie', 'vuori', '7 diamonds',
  'rock revival', 'bonobos', 'carhartt', 'patagonia', 'nike', 'adidas', 'columbia',
  'wrangler', 'levis', "levi's", 'cinch', 'ariat', 'bke', 'quince', 'halsey', 'birddogs',
  'chubbies', 'eileen fisher', 'salvage', 'empyre', 'carbon 2 cobalt', 'prana', 'cremieux',
  'brooks brothers', 'flint and tinder', 'mountain khakis', 'silver jeans', 'hugo boss'
];

const cleanUnicode = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeTitle = (t) => {
  if (!t) return '';
  return cleanUnicode(t).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

const normalizeStr = (s) => (s || '').trim().toLowerCase();

const extractBrand = (text) => {
  if (!text) return '';
  const norm = normalizeTitle(text);
  for (const b of KNOWN_BRANDS) {
    if (norm.includes(b)) return b;
  }
  return norm.split(' ')[0] || '';
};

const extractGender = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(?:womens|women|ladies|female)\b/i.test(lower)) return 'womens';
  if (/\b(?:mens|men|male)\b/i.test(lower)) return 'mens';
  if (/\b(?:boys|boy)\b/i.test(lower)) return 'boys';
  if (/\b(?:girls|girl)\b/i.test(lower)) return 'girls';
  return null;
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
  const dimMatch = lower.match(/\b(\d{2})\s*[xX]\s*(\d{2})\b/);
  if (dimMatch) return `${dimMatch[1]}x${dimMatch[2]}`;
  const letterMatch = lower.match(/\b(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|xxxl)\b/);
  if (letterMatch) return letterMatch[1];
  const numMatch = lower.match(/\b(28|29|30|31|32|33|34|35|36|38|40|42|44)\b/);
  if (numMatch) return numMatch[1];
  return null;
};

const areSizesCompatible = (s1, s2) => {
  if (!s1 || !s2) return true;
  if (s1 === s2) return true;
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

const extractColorPattern = (text) => {
  if (!text) return '';
  const lower = String(text).toLowerCase();
  const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/);
  const found = words.filter(w => COMMON_COLORS.has(w));
  return found.join('_');
};

const calculateTitleSimilarity = (titleA, titleB) => {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let matchCount = 0;
  for (const t of setA) {
    if (setB.has(t)) matchCount++;
  }
  const tokenSim = (2 * matchCount) / (setA.size + setB.size);

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

  let prefixSim = 0;
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 25) {
    if (normA.startsWith(normB) || normB.startsWith(normA)) {
      prefixSim = 0.95;
    }
  }

  return Math.max(tokenSim, bigramSim, prefixSim);
};

const isStrictMatch = (itemA, itemB) => {
  const titleA = itemA.title || '';
  const titleB = itemB.title || '';
  if (!titleA || !titleB) return false;

  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (normA && normB && normA === normB) {
    return true;
  }

  // 2. Gender Guard
  const genA = extractGender(titleA);
  const genB = extractGender(titleB);
  if (genA && genB && genA !== genB) {
    return false;
  }

  // 3. Garment Guard
  const gA = extractGarmentType(titleA);
  const gB = extractGarmentType(titleB);
  if (gA && gB && gA !== gB) {
    return false;
  }

  // 4. Size Guard
  const sA = extractSize(itemA.size || titleA);
  const sB = extractSize(itemB.size || titleB);
  if (sA && sB && !areSizesCompatible(sA, sB)) {
    return false;
  }

  // 5. Color Guard
  const cA = extractColorPattern(itemA.color || titleA);
  const cB = extractColorPattern(itemB.color || titleB);
  if (cA && cB && cA !== cB) {
    return false;
  }

  // 6. Brand Guard
  const bA = extractBrand(itemA.brand || titleA);
  const bB = extractBrand(itemB.brand || titleB);
  if (bA && bB && bA !== bB) {
    return false;
  }

  // 7. Title Similarity >= 88% (0.88)
  const sim = calculateTitleSimilarity(titleA, titleB);
  return sim >= 0.88;
};

async function rebuild() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');
  const User = require('../models/User');

  const countsByUser = await Product.aggregate([
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);
  const mainUserEntry = countsByUser.sort((a, b) => b.count - a.count)[0];
  const userId = mainUserEntry._id;
  const user = await User.findById(userId);
  console.log(`Starting clean rebuild for user: ${user?.email} (${userId})`);

  const [ebayProds, poshProds, mercProds] = await Promise.all([
    Product.find({ user: userId, $or: [{ source: 'ebay' }, { platform: 'ebay' }], status: { $in: ['active', 'live', 'published'] } }).lean(),
    Product.find({ user: userId, $or: [{ source: 'poshmark' }, { platform: 'poshmark' }], status: { $in: ['active', 'live', 'published'] } }).lean(),
    Product.find({ user: userId, $or: [{ source: 'mercari' }, { platform: 'mercari' }], status: { $in: ['active', 'live', 'published'] } }).lean()
  ]);

  console.log(`Active Products in DB: eBay=${ebayProds.length}, Poshmark=${poshProds.length}, Mercari=${mercProds.length}`);

  const masterListings = [];

  // 1. Initialize Master Listings from Active eBay Products
  for (const e of ebayProds) {
    const eid = e.ebayListingId || e.itemId || e.liveListingId;
    if (!eid) continue;
    const eTitle = e.title || 'eBay Listing';
    const ePrice = String(e.selling_price || e.price || 0);
    const eSku = e.sku || '';
    const eThumb = e.images?.[0] || e.thumbnail || '';
    const eImages = (e.images && e.images.length > 0) ? e.images : (eThumb ? [eThumb] : []);

    const m = {
      user: userId,
      title: eTitle,
      description: e.description || eTitle,
      category: e.category || 'Clothing & Accessories',
      sku: eSku,
      brand: e.brand || extractBrand(eTitle) || '',
      size: e.size || extractSize(eTitle) || '',
      color: e.color || '',
      price: ePrice,
      ebayPrice: ePrice,
      ebayListingId: eid,
      ebayUrl: e.ebayUrl || `https://www.ebay.com/itm/${eid}`,
      ebayStatus: 'published',
      poshmarkStatus: 'none',
      mercariStatus: 'none',
      etsyStatus: 'none',
      amazonStatus: 'none',
      status: 'published',
      images: eImages,
      thumbnail: eThumb,
      platformData: {
        ebay: {
          thumbnail: eThumb,
          images: eImages,
          price: ePrice,
          url: e.ebayUrl || `https://www.ebay.com/itm/${eid}`
        }
      },
      createdAt: e.createdAt || new Date(),
      updatedAt: new Date()
    };

    masterListings.push(m);
  }

  // 2. Match Poshmark Products strictly (Pure Title + Attribute Guards)
  let matchedPosh = 0;
  let standalonePosh = 0;

  for (const p of poshProds) {
    const pid = p.poshmarkListingId;
    if (!pid) continue;
    const pTitle = p.title || '';
    const pPrice = String(p.selling_price || p.price || 0);
    const pSku = p.sku || '';
    const pThumb = p.images?.[0] || p.thumbnail || '';
    const pImages = (p.images && p.images.length > 0) ? p.images : (pThumb ? [pThumb] : []);
    const pUrl = p.poshmarkUrl || `https://poshmark.com/listing/${pid}`;

    const matched = masterListings.find(m => m.poshmarkStatus === 'none' && isStrictMatch(m, p));

    if (matched) {
      matched.poshmarkListingId = pid;
      matched.poshmarkStatus = 'published';
      matched.poshmarkUrl = pUrl;
      matched.poshmarkPrice = pPrice;
      matched.platformData.poshmark = {
        thumbnail: pThumb,
        images: pImages,
        price: pPrice,
        url: pUrl
      };
      if (!matched.sku && pSku) matched.sku = pSku;
      // Merge images
      const existingImgs = new Set(matched.images);
      for (const img of pImages) {
        if (img && !existingImgs.has(img)) {
          matched.images.push(img);
          existingImgs.add(img);
        }
      }
      matchedPosh++;
    } else {
      standalonePosh++;
      const newM = {
        user: userId,
        title: pTitle || 'Poshmark Listing',
        description: p.description || pTitle,
        category: p.category || 'Clothing & Accessories',
        sku: pSku,
        brand: p.brand || extractBrand(pTitle) || '',
        size: p.size || extractSize(pTitle) || '',
        color: p.color || '',
        price: pPrice,
        poshmarkPrice: pPrice,
        poshmarkListingId: pid,
        poshmarkUrl: pUrl,
        poshmarkStatus: 'published',
        ebayStatus: 'none',
        mercariStatus: 'none',
        etsyStatus: 'none',
        amazonStatus: 'none',
        status: 'published',
        images: pImages,
        thumbnail: pThumb,
        platformData: {
          poshmark: {
            thumbnail: pThumb,
            images: pImages,
            price: pPrice,
            url: pUrl
          }
        },
        createdAt: p.createdAt || new Date(),
        updatedAt: new Date()
      };
      masterListings.push(newM);
    }
  }

  // 3. Match Mercari Products strictly (Pure Title + Attribute Guards)
  let matchedMerc = 0;
  let standaloneMerc = 0;

  for (const m of mercProds) {
    const mid = m.mercariListingId;
    if (!mid) continue;
    const mTitle = m.title || '';
    const mPrice = String(m.selling_price || m.price || 0);
    const mSku = m.sku || '';
    const mThumb = m.images?.[0] || m.thumbnail || '';
    const mImages = (m.images && m.images.length > 0) ? m.images : (mThumb ? [mThumb] : []);
    const mUrl = m.mercariUrl || `https://www.mercari.com/us/item/${mid}/`;

    const matched = masterListings.find(master => master.mercariStatus === 'none' && isStrictMatch(master, m));

    if (matched) {
      matched.mercariListingId = mid;
      matched.mercariStatus = 'published';
      matched.mercariUrl = mUrl;
      matched.mercariPrice = mPrice;
      matched.platformData.mercari = {
        thumbnail: mThumb,
        images: mImages,
        price: mPrice,
        url: mUrl
      };
      if (!matched.sku && mSku) matched.sku = mSku;
      const existingImgs = new Set(matched.images);
      for (const img of mImages) {
        if (img && !existingImgs.has(img)) {
          matched.images.push(img);
          existingImgs.add(img);
        }
      }
      matchedMerc++;
    } else {
      standaloneMerc++;
      const newM = {
        user: userId,
        title: mTitle || 'Mercari Listing',
        description: m.description || mTitle,
        category: m.category || 'Clothing & Accessories',
        sku: mSku,
        brand: m.brand || extractBrand(mTitle) || '',
        size: m.size || extractSize(mTitle) || '',
        color: m.color || '',
        price: mPrice,
        mercariPrice: mPrice,
        mercariListingId: mid,
        mercariUrl: mUrl,
        mercariStatus: 'published',
        ebayStatus: 'none',
        poshmarkStatus: 'none',
        etsyStatus: 'none',
        amazonStatus: 'none',
        status: 'published',
        images: mImages,
        thumbnail: mThumb,
        platformData: {
          mercari: {
            thumbnail: mThumb,
            images: mImages,
            price: mPrice,
            url: mUrl
          }
        },
        createdAt: m.createdAt || new Date(),
        updatedAt: new Date()
      };
      masterListings.push(newM);
    }
  }

  console.log(`\nRebuild Summary:`);
  console.log(`  eBay Total: ${ebayProds.length}`);
  console.log(`  Poshmark Matched: ${matchedPosh}, Standalone: ${standalonePosh} (Total: ${poshProds.length})`);
  console.log(`  Mercari Matched: ${matchedMerc}, Standalone: ${standaloneMerc} (Total: ${mercProds.length})`);
  console.log(`  Total Clean Master Listings to Insert: ${masterListings.length}`);

  // 4. Clean Master DB: Delete old non-sold listings and insert clean listings
  const deleteRes = await Listing.deleteMany({ user: userId, status: { $ne: 'sold' } });
  console.log(`Deleted ${deleteRes.deletedCount} old active/draft listings.`);

  if (masterListings.length > 0) {
    const insertRes = await Listing.insertMany(masterListings, { ordered: false });
    console.log(`Inserted ${insertRes.length} pristine master listings!`);
  }

  // 5. Final DB Verification
  const report = {
    totalListings: await Listing.countDocuments({ user: userId }),
    activeListings: await Listing.countDocuments({ user: userId, status: { $in: ['active', 'published'] } }),
    soldListings: await Listing.countDocuments({ user: userId, status: 'sold' }),
    ebayActive: await Listing.countDocuments({ user: userId, ebayStatus: 'published' }),
    poshmarkActive: await Listing.countDocuments({ user: userId, poshmarkStatus: 'published' }),
    mercariActive: await Listing.countDocuments({ user: userId, mercariStatus: 'published' })
  };

  console.log('\n--- Final Database Status ---', report);

  process.exit(0);
}

rebuild().catch(e => { console.error('Rebuild failed:', e); process.exit(1); });
