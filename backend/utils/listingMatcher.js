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

const GENERIC_IMAGE_NAMES = new Set([
  '500_500.jpg', 'thumbnail.jpg', 'image.jpg', 'default.jpg', 'no_image.png',
  'm_image.jpg', 'placeholder.png', 'preview.jpg', 'null', 'undefined',
  'no-image.jpg', 'no-image.png', 'default.png'
]);

/**
 * Clean text and tokenize into meaningful words
 */
function cleanAndTokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
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
  
  // Waist x Inseam (e.g. 34x30, 32x32, 38x32)
  const dimMatch = lower.match(/\b(\d{2})x(\d{2})\b/);
  if (dimMatch) return dimMatch[0];

  // Standard letter sizes
  const letterMatch = lower.match(/\b(xxs|xs|s|m|l|xl|xxl|2xl|3xl|xxxl)\b/);
  if (letterMatch) return letterMatch[1];

  // Number sizes
  const numMatch = lower.match(/\b(28|29|30|31|32|33|34|35|36|38|40|42|44)\b/);
  if (numMatch) return numMatch[1];

  return null;
}

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
 * Calculate Title Similarity (0.0 to 1.0)
 */
function calculateTitleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;
  
  const raw1 = String(title1).trim().toLowerCase();
  const raw2 = String(title2).trim().toLowerCase();
  
  if (raw1 === raw2) return 1.0;

  const tokens1 = cleanAndTokenize(title1);
  const tokens2 = cleanAndTokenize(title2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set2 = new Set(tokens2);
  const commonTokens = tokens1.filter(t => set2.has(t));
  const unionSet = new Set([...tokens1, ...tokens2]);

  // Jaccard similarity & Dice similarity
  const jaccardScore = commonTokens.length / unionSet.size;
  const diceScore = (2 * commonTokens.length) / (tokens1.length + tokens2.length);

  return Math.min(Math.round(diceScore * 100) / 100, 1.0);
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
  // Ignore generic eBay / Poshmark / Mercari resolution files
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
 * Check if SKU matches
 */
function checkSkuMatch(sku1, sku2) {
  if (!sku1 || !sku2) return false;
  const s1 = String(sku1).trim().toLowerCase();
  const s2 = String(sku2).trim().toLowerCase();
  if (!s1 || !s2 || s1 === '-' || s2 === '-' || s1 === 'none' || s2 === 'none' || s1 === 'n/a' || s1 === 'default' || s1.length <= 3) return false;
  return s1 === s2;
}

/**
 * Comprehensive match check between source and target listing
 * Requires strong title similarity (>= 85%) and no size/garment conflicts
 */
function isListingMatch(sourceListing, targetListing, minTitleScore = 0.85) {
  if (!sourceListing || !targetListing) {
    return { isMatch: false, score: 0, reason: 'Missing listing data' };
  }

  // 1. SKU Match (High confidence)
  if (checkSkuMatch(sourceListing.sku, targetListing.sku)) {
    return { isMatch: true, score: 1.0, reason: 'Exact SKU match' };
  }

  const title1 = sourceListing.title || '';
  const title2 = targetListing.title || '';
  if (!title1 || !title2) {
    return { isMatch: false, score: 0, reason: 'Empty title' };
  }

  const raw1 = title1.trim().toLowerCase();
  const raw2 = title2.trim().toLowerCase();
  if (raw1 === raw2) {
    return { isMatch: true, score: 1.0, reason: 'Exact title match' };
  }

  // 2. Garment Category Conflict Check
  const type1 = extractGarmentType(title1);
  const type2 = extractGarmentType(title2);
  if (type1 && type2 && type1 !== type2) {
    const upperTypes = new Set(['jacket', 'coat', 'hoodie', 'sweater', 'sweatshirt', 'cardigan', 'vest', 'windbreaker', 'puffer', 'fleece']);
    const lowerTypes = new Set(['jeans', 'pants', 'shorts', 'sweatpants', 'joggers', 'trousers', 'chinos', 'chino']);
    const shirtTypes = new Set(['shirt', 'tee', 't-shirt', 'polo', 'button', 'top', 'jersey']);
    const shoeTypes = new Set(['shoes', 'sneakers', 'boots', 'sandals', 'slides', 'loafers']);

    const isUpper1 = upperTypes.has(type1);
    const isLower1 = lowerTypes.has(type1);
    const isShirt1 = shirtTypes.has(type1);
    const isShoe1 = shoeTypes.has(type1);

    const isUpper2 = upperTypes.has(type2);
    const isLower2 = lowerTypes.has(type2);
    const isShirt2 = shirtTypes.has(type2);
    const isShoe2 = shoeTypes.has(type2);

    if (
      (isUpper1 && isLower2) || (isLower1 && isUpper2) ||
      (isUpper1 && isShirt2) || (isShirt1 && isUpper2) ||
      (isLower1 && isShirt2) || (isShirt1 && isLower2) ||
      (isShoe1 && !isShoe2) || (!isShoe1 && isShoe2)
    ) {
      return { isMatch: false, score: 0, reason: `Garment type conflict: ${type1} vs ${type2}` };
    }
  }

  // 3. Color Pattern Conflict Check
  const color1 = extractColorPattern(sourceListing.color || title1);
  const color2 = extractColorPattern(targetListing.color || title2);
  if (color1 && color2 && color1 !== color2) {
    return { isMatch: false, score: 0, reason: `Color pattern mismatch: ${color1} vs ${color2}` };
  }

  // 4. Exact Unique Image Match
  const sourceImages = sourceListing.images || [sourceListing.thumbnail];
  const targetImages = targetListing.images || [targetListing.thumbnail];
  if (checkImageMatch(sourceImages, targetImages)) {
    return { isMatch: true, score: 1.0, reason: 'Image match' };
  }

  // 5. Title Similarity Score
  const titleScore = calculateTitleSimilarity(title1, title2);
  if (titleScore >= minTitleScore) {
    return { isMatch: true, score: titleScore, reason: `Title similarity (${Math.round(titleScore * 100)}%)` };
  }

  return {
    isMatch: false,
    score: titleScore,
    reason: `Title match is only ${Math.round(titleScore * 100)}% (Requires ${Math.round(minTitleScore * 100)}%+)`
  };
}

/**
 * Normalizes title string by lowercasing and removing non-alphanumeric characters
 */
function normalizeTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const normPlatform = String(platform || '').toLowerCase();

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

  // 2. By Exact Custom SKU Match (Valid SKU >= 3 chars, not placeholder)
  const isInvalidSku = !rawSku || rawSku === '-' || rawSku === 'none' || rawSku === 'null' || rawSku === 'undefined' || rawSku === 'custom' || rawSku === 'default' || rawSku === 'sku' || rawSku.length < 3;
  if (!isInvalidSku) {
    const skuMatch = listings.find(l => {
      if (!l.sku) return false;
      const lSku = String(l.sku).trim().toLowerCase();
      if (lSku === rawSku) return true;

      // Check composite/delimited SKUs (e.g., '4329 | P-6a7...' or 'SKU-1 / SKU-2')
      const parts = lSku.split(/[\s|,\/]+/).map(p => p.trim()).filter(Boolean);
      if (parts.includes(rawSku)) return true;

      // Check platform-specific SKUs in platformData or listingsMap
      const ebaySku = String(l.platformData?.ebay?.sku || l.listingsMap?.ebay?.sku || '').trim().toLowerCase();
      const poshSku = String(l.platformData?.poshmark?.sku || l.listingsMap?.poshmark?.sku || '').trim().toLowerCase();
      const mercSku = String(l.platformData?.mercari?.sku || l.listingsMap?.mercari?.sku || '').trim().toLowerCase();
      if (ebaySku && ebaySku === rawSku) return true;
      if (poshSku && poshSku === rawSku) return true;
      if (mercSku && mercSku === rawSku) return true;

      return false;
    });

    if (skuMatch) return skuMatch;
  }

  // 3. By Exact Normalized Title Match
  if (normTitle && normTitle.length >= 6) {
    const exactTitleMatch = listings.find(l => {
      if (!l.title) return false;
      const lNormTitle = normalizeTitle(l.title);
      return lNormTitle === normTitle;
    });

    if (exactTitleMatch) return exactTitleMatch;
  }

  // 4. By Prefix / Substring Title Match (handles eBay 80-char truncation vs Master title)
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

  // 5. By High Token Overlap (>= 80% similarity with >= 4 tokens)
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
  cleanAndTokenize,
  extractGarmentType,
  extractSize,
  extractColorPattern,
  levenshteinDistance,
  calculateTitleSimilarity,
  extractUniqueImageKey,
  checkImageMatch,
  checkSkuMatch,
  isListingMatch,
  normalizeTitle,
  getTokens,
  calculateTokenSimilarity,
  findBestMatchingListing
};
