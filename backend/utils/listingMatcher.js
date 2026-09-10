/**
 * Utility for verifying similarity between two listings (Title, Images, SKU)
 * Used to ensure only matching physical items are merged across channels.
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

const GENERIC_IMAGE_NAMES = new Set([
  '500_500.jpg', 'thumbnail.jpg', 'image.jpg', 'default.jpg', 'no_image.png',
  'm_image.jpg', 'placeholder.png', 'preview.jpg', 'null', 'undefined',
  'no-image.jpg', 'no-image.png', 'default.png'
]);

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

  // 3. Size Conflict Check
  const size1 = extractSize(sourceListing.size || title1);
  const size2 = extractSize(targetListing.size || title2);
  if (size1 && size2 && size1 !== size2) {
    return { isMatch: false, score: 0, reason: `Size conflict: ${size1} vs ${size2}` };
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

module.exports = {
  cleanAndTokenize,
  extractGarmentType,
  extractSize,
  calculateTitleSimilarity,
  extractUniqueImageKey,
  checkImageMatch,
  checkSkuMatch,
  isListingMatch
};

