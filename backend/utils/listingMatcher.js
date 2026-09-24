/**
 * Master Listing Matching Utility
 * Provides multi-tier matching algorithms between marketplace orders / sold events
 * and Master Listings in the database.
 */

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
  normalizeTitle,
  getTokens,
  calculateTokenSimilarity,
  findBestMatchingListing
};
