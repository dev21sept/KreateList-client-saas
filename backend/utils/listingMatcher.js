/**
 * Master Listing Matching Utility
 * Provides comprehensive matching algorithms for:
 * 1. Cross-platform active listing merging (Smart Merge / Auto-Merge)
 * 2. Marketplace sales & orders reconciliation (Auto-Delist / Sold Tracker)
 */

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'or', '&', '-', '|', '/', '\\', 'new', 'item',
  'mens', 'womens', 'men', 'women', 'size', 'sz', 'read', 'nwt', 'vtg', 'vintage'
]);

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

const GENERIC_IMAGE_NAMES = new Set([
  '500_500.jpg', 'thumbnail.jpg', 'image.jpg', 'default.jpg', 'no_image.png',
  'm_image.jpg', 'placeholder.png', 'preview.jpg', 'null', 'undefined',
  'no-image.jpg', 'no-image.png', 'default.png'
]);

function cleanUnicode(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes title string by lowercasing and removing non-alphanumeric characters
 */
function normalizeTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return cleanUnicode(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStr(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

/**
 * Clean text and tokenize into meaningful words
 */
function cleanAndTokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return cleanUnicode(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Extracts meaningful tokens (words >= 2 chars) from a string
 */
function getTokens(str) {
  const norm = normalizeTitle(str);
  if (!norm) return [];
  return norm.split(' ').filter(t => t.length >= 2);
}

/**
 * Extract brand from text/brand field
 */
function extractBrand(text) {
  if (!text) return '';
  const norm = normalizeTitle(text);
  for (const b of KNOWN_BRANDS) {
    if (norm.includes(b)) return b;
  }
  return norm.split(' ')[0] || '';
}

/**
 * Extract gender category from text
 */
function extractGender(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(?:womens|women|ladies|female)\b/i.test(lower)) return 'womens';
  if (/\b(?:mens|men|male)\b/i.test(lower)) return 'mens';
  if (/\b(?:boys|boy)\b/i.test(lower)) return 'boys';
  if (/\b(?:girls|girl)\b/i.test(lower)) return 'girls';
  return null;
}

/**
 * Extract garment category from title
 */
function extractGarmentType(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const t of GARMENT_TYPES) {
    const reg = new RegExp(`\\b${t}\\b`, 'i');
    if (reg.test(lower)) return t;
  }
  return null;
}

/**
 * Extract size from title or size field
 */
function extractSize(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  
  // Waist x Inseam (e.g. 34x30, 32x32, 38x32, 34 x 32)
  const dimMatch = lower.match(/\b(\d{2})\s*[xX]\s*(\d{2})\b/);
  if (dimMatch) return `${dimMatch[1]}x${dimMatch[2]}`;

  // Standard letter sizes
  const letterMatch = lower.match(/\b(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|xxxl)\b/);
  if (letterMatch) return letterMatch[1];

  // Number sizes
  const numMatch = lower.match(/\b(28|29|30|31|32|33|34|35|36|38|40|42|44)\b/);
  if (numMatch) return numMatch[1];

  return null;
}

/**
 * Check if two extracted sizes are compatible
 */
function areSizesCompatible(s1, s2) {
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
}

/**
 * Extract color pattern from text
 */
function extractColorPattern(text) {
  if (!text) return '';
  const lower = String(text).toLowerCase();
  const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/);
  const found = words.filter(w => COMMON_COLORS.has(w));
  return found.join('_');
}

/**
 * Calculate Levenshtein Distance
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculate Title Similarity (0.0 to 1.0) using Token Overlap, Character Bigrams, and Prefix Matching
 */
function calculateTitleSimilarity(titleA, titleB) {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
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

  // 3. For truncated titles (e.g. Poshmark 50-char vs eBay 80-char)
  let prefixSim = 0;
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 25) {
    if (normA.startsWith(normB) || normB.startsWith(normA)) {
      prefixSim = 0.95;
    }
  }

  return Math.max(tokenSim, bigramSim, prefixSim);
}

/**
 * Extract unique platform-specific image key or hash
 */
function extractUniqueImageKey(imgUrl) {
  if (!imgUrl || typeof imgUrl !== 'string') return '';
  const cleanUrl = imgUrl.split('?')[0].trim();
  if (!cleanUrl) return '';

  // eBay CDN format: https://i.ebayimg.com/images/g/<UNIQUE_HASH>/s-l...jpg
  const ebayMatch = cleanUrl.match(/i\.ebayimg\.com\/images\/g\/([^\/]+)/i);
  if (ebayMatch && ebayMatch[1] && ebayMatch[1].length >= 8) {
    return `ebay_${ebayMatch[1]}`;
  }

  // Poshmark CDN format: .../posts/<POST_ID>/m_<PHOTO_ID>.jpg or similar
  const poshMatch = cleanUrl.match(/cloudfront\.net\/posts\/[^\/]+\/([^\/]+)\.jpe?g/i);
  if (poshMatch && poshMatch[1] && poshMatch[1].length >= 10) {
    return `posh_${poshMatch[1]}`;
  }

  // Mercari CDN format: .../photos/([^\/]+)\.jpe?g
  const mercariMatch = cleanUrl.match(/images\.mercari\.com\/photos\/([^\/]+)/i);
  if (mercariMatch && mercariMatch[1] && mercariMatch[1].length >= 8) {
    return `mercari_${mercariMatch[1]}`;
  }

  // Depop CDN format: ...depop.com/...
  const depopMatch = cleanUrl.match(/depop\.com\/[^\/]+\/([^\/]+)\.jpe?g/i);
  if (depopMatch && depopMatch[1] && depopMatch[1].length >= 8) {
    return `depop_${depopMatch[1]}`;
  }

  const filename = cleanUrl.split('/').pop()?.toLowerCase();
  if (!filename || filename.length < 12) return '';
  if (/^s-l\d+\.jpe?g$/i.test(filename)) return '';
  if (filename.startsWith('$_') || filename.startsWith('thumb') || filename.startsWith('preview') || filename.startsWith('placeholder')) return '';
  if (GENERIC_IMAGE_NAMES.has(filename)) return '';

  return filename;
}

/**
 * Check if any images match between two listings using unique keys
 */
function checkImageMatch(images1, images2) {
  if (!images1 || !images2) return false;
  const list1 = Array.isArray(images1) ? images1 : [images1];
  const list2 = Array.isArray(images2) ? images2 : [images2];

  const keys1 = list1.map(img => extractUniqueImageKey(typeof img === 'string' ? img : (img?.url || img?.src || ''))).filter(Boolean);
  const keys2 = list2.map(img => extractUniqueImageKey(typeof img === 'string' ? img : (img?.url || img?.src || ''))).filter(Boolean);

  if (keys1.length === 0 || keys2.length === 0) return false;

  const set2 = new Set(keys2);
  return keys1.some(k => set2.has(k));
}

/**
 * Check if SKU matches with safety guard against shared non-unique SKUs
 */
function checkSkuMatch(sku1, sku2, itemA = null, itemB = null) {
  if (!sku1 || !sku2) return false;
  const s1 = String(sku1).trim().toLowerCase();
  const s2 = String(sku2).trim().toLowerCase();
  if (!s1 || !s2 || s1 === '-' || s2 === '-' || s1 === 'none' || s2 === 'none' || s1 === 'n/a' || s1 === 'default' || s1.length <= 3) return false;
  if (s1 !== s2) return false;
  if (itemA && itemB) {
    return isStrictMatch(itemA, itemB, 0.60);
  }
  return true;
}

/**
 * Comprehensive Strict Match Check
 * Pure Title & Attribute Matching (ZERO Price Dependency as prices can vary per platform)
 * Enforces:
 * 1. Gender Guard (Mens vs Womens vs Boys vs Girls)
 * 2. Garment Guard (Jacket vs Pants vs Shirt vs Shorts)
 * 3. Size Guard (34x32 vs 38x32, S vs L)
 * 4. Color Pattern Guard
 * 5. Brand Guard
 * 6. Title Similarity >= 88% (0.88)
 */
function isStrictMatch(itemA, itemB, minTitleScore = 0.88) {
  if (!itemA || !itemB) return false;

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

  // 7. Exact Unique Image Match
  const imagesA = itemA.images || [itemA.thumbnail];
  const imagesB = itemB.images || [itemB.thumbnail];
  if (checkImageMatch(imagesA, imagesB)) {
    return true;
  }

  // 8. Title Similarity Score >= minTitleScore
  const sim = calculateTitleSimilarity(titleA, titleB);
  return sim >= minTitleScore;
}

function isListingMatch(sourceListing, targetListing, minTitleScore = 0.88) {
  const isMatch = isStrictMatch(sourceListing, targetListing, minTitleScore);
  const score = calculateTitleSimilarity(sourceListing?.title, targetListing?.title);
  return {
    isMatch,
    score,
    reason: isMatch ? `Matched (Title similarity: ${Math.round(score * 100)}%)` : `Mismatch (Score: ${Math.round(score * 100)}%)`
  };
}

/**
 * Computes bidirectional token overlap similarity between two strings (0.0 to 1.0)
 */
function calculateTokenSimilarity(strA, strB) {
  const tokensA = getTokens(strA);
  const tokensB = getTokens(strB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  let matchesA = 0;
  for (const t of tokensA) {
    if (setB.has(t)) matchesA++;
  }

  const setA = new Set(tokensA);
  let matchesB = 0;
  for (const t of tokensB) {
    if (setA.has(t)) matchesB++;
  }

  const ratioA = matchesA / tokensA.length;
  const ratioB = matchesB / tokensB.length;
  return (ratioA + ratioB) / 2;
}

/**
 * Matches an order line item or marketplace sale with the best Master Listing from an array of listings.
 * 
 * @param {Array} listings Array of Listing documents for the user
 * @param {Object} query Match query parameters
 * @param {string} [query.listingId] Platform live item ID (e.g. eBay item ID, Poshmark post ID, Mercari item ID)
 * @param {string} [query.sku] SKU from marketplace order/item
 * @param {string} [query.title] Title of the sold product
 * @param {string} [query.platform] Platform where sold ('ebay', 'poshmark', 'mercari', 'etsy', 'depop', 'amazon')
 * @returns {Object|null} The matched Listing document or null
 */
function findBestMatchingListing(listings, { listingId, sku, title, platform }) {
  if (!Array.isArray(listings) || listings.length === 0) return null;

  const cleanId = String(listingId || '').trim();
  const rawSku = String(sku || '').trim().toLowerCase();
  const cleanTitle = String(title || '').trim();
  const normTitle = normalizeTitle(cleanTitle);

  // 1. By Direct Platform Listing ID (Highest precision)
  if (cleanId && cleanId !== '___NONE___' && cleanId !== 'undefined' && cleanId !== 'null' && cleanId !== '-') {
    const idMatch = listings.find(l => {
      const ebayId = String(l.ebayListingId || l.ebayItemId || l.platformData?.ebay?.liveId || l.listingsMap?.ebay?.liveId || '').trim();
      const poshId = String(l.poshmarkListingId || l.platformData?.poshmark?.liveId || l.listingsMap?.poshmark?.liveId || '').trim();
      const mercId = String(l.mercariListingId || l.platformData?.mercari?.liveId || l.listingsMap?.mercari?.liveId || '').trim();
      const etsyId = String(l.etsyListingId || l.platformData?.etsy?.liveId || l.listingsMap?.etsy?.liveId || '').trim();
      const depopId = String(l.depopListingId || l.platformData?.depop?.liveId || l.listingsMap?.depop?.liveId || '').trim();
      const amazonId = String(l.amazonListingId || l.amazonAsin || l.platformData?.amazon?.liveId || l.listingsMap?.amazon?.liveId || '').trim();

      if (ebayId && ebayId === cleanId) return true;
      if (poshId && poshId === cleanId) return true;
      if (etsyId && etsyId === cleanId) return true;
      if (depopId && depopId === cleanId) return true;
      if (amazonId && amazonId === cleanId) return true;

      // Mercari prefix tolerance (m123456 vs 123456)
      if (mercId) {
        if (mercId === cleanId) return true;
        if (mercId.replace(/^m/i, '') === cleanId.replace(/^m/i, '')) return true;
      }

      return false;
    });

    if (idMatch) return idMatch;
  }

  // 2. By Exact Normalized Title Match
  if (normTitle && normTitle.length >= 6) {
    const exactTitleMatch = listings.find(l => {
      if (!l.title) return false;
      const lNormTitle = normalizeTitle(l.title);
      return lNormTitle === normTitle;
    });

    if (exactTitleMatch) return exactTitleMatch;
  }

  // 4. By Strict Title & Attribute Match
  const strictMatch = listings.find(l => isStrictMatch(l, { title: cleanTitle, sku: rawSku }, 0.88));
  if (strictMatch) return strictMatch;

  // 5. By Prefix / Substring Title Match (handles eBay 80-char truncation vs Master title)
  if (normTitle && normTitle.length >= 18) {
    const prefixMatch = listings.find(l => {
      if (!l.title) return false;
      const lNormTitle = normalizeTitle(l.title);
      if (lNormTitle.length < 18) return false;

      if (lNormTitle.startsWith(normTitle) || normTitle.startsWith(lNormTitle)) return true;
      if ((lNormTitle.includes(normTitle) || normTitle.includes(lNormTitle)) && (Math.min(lNormTitle.length, normTitle.length) >= 22)) return true;
      return false;
    });

    if (prefixMatch) return prefixMatch;
  }

  // 6. By High Token Overlap (>= 80% similarity with >= 4 tokens)
  if (normTitle && normTitle.length >= 12) {
    let bestScore = 0;
    let bestMatch = null;

    for (const l of listings) {
      if (!l.title) continue;
      const score = calculateTokenSimilarity(cleanTitle, l.title);
      if (score >= 0.80 && score > bestScore) {
        bestScore = score;
        bestMatch = l;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return null;
}

module.exports = {
  cleanUnicode,
  normalizeTitle,
  normalizeStr,
  cleanAndTokenize,
  getTokens,
  extractBrand,
  extractGender,
  extractGarmentType,
  extractSize,
  areSizesCompatible,
  extractColorPattern,
  levenshteinDistance,
  calculateTitleSimilarity,
  extractUniqueImageKey,
  checkImageMatch,
  checkSkuMatch,
  isStrictMatch,
  isListingMatch,
  calculateTokenSimilarity,
  findBestMatchingListing
};
