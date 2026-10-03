/**
 * eBay Browse API Connector (Stage 2)
 * Collects current active competitor listings from eBay Buy Browse API.
 * Keeps source_type = ACTIVE strictly separated from SOLD data.
 */

const axios = require('axios');
const { getAppToken } = require('../ebayService');

const BROWSE_API_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

/**
 * Normalizes an eBay Browse API item summary into standard schema
 */
function normalizeBrowseItem(item, marketplace = 'EBAY_US') {
  const itemPrice = parseFloat(item.price?.value || 0);
  const currency = item.price?.currency || 'USD';
  
  // Calculate shipping price if available
  let shippingPrice = 0;
  if (item.shippingOptions && item.shippingOptions.length > 0) {
    const defaultShipping = item.shippingOptions[0];
    if (defaultShipping.shippingCost?.value) {
      shippingPrice = parseFloat(defaultShipping.shippingCost.value);
    }
  }

  // Parse condition
  const rawCondition = item.condition || item.conditionId || 'USED';

  return {
    item_id: item.itemId,
    title: item.title,
    item_url: item.itemWebUrl || item.itemAffiliateWebUrl,
    thumbnail_url: item.image?.imageUrl || (item.thumbnailImages?.[0]?.imageUrl) || null,
    item_price: itemPrice,
    shipping_price: shippingPrice,
    total_price: parseFloat((itemPrice + shippingPrice).toFixed(2)),
    currency,
    condition: rawCondition,
    condition_id: item.conditionId,
    seller: {
      username: item.seller?.username || 'Unknown',
      feedback_percentage: parseFloat(item.seller?.feedbackPercentage || 0)
    },
    categories: item.categories?.map(c => c.categoryName) || [],
    source_type: 'ACTIVE',
    provider: 'EBAY_BROWSE',
    marketplace,
    observed_at: new Date().toISOString()
  };
}

/**
 * Searches active listings on eBay using Browse API
 * @param {Object} normalizedItem - from itemResolver
 * @param {string} marketplace - e.g. 'EBAY_US'
 * @param {number} maxResults - max items to fetch
 */
async function fetchActiveListings(normalizedItem, marketplace = 'EBAY_US', maxResults = 25) {
  try {
    const token = await getAppToken();
    if (!token) {
      console.warn('[BrowseConnector] No eBay App Token available.');
      return { items: [], total: 0, queryUsed: '', error: 'NO_TOKEN' };
    }

    // Build query strategy
    let queries = [];
    if (normalizedItem.upc) {
      queries.push({ q: normalizedItem.upc, type: 'UPC' });
    }
    if (normalizedItem.brand && normalizedItem.model) {
      queries.push({ q: `${normalizedItem.brand} ${normalizedItem.model}`, type: 'BRAND_MODEL' });
    }
    
    // Brand + descriptive product tokens (e.g. "Nike tracksuit jacket")
    if (normalizedItem.brand && normalizedItem.searchTokens && normalizedItem.searchTokens.length > 0) {
      const nonBrandTokens = normalizedItem.searchTokens.filter(t => 
        t.toLowerCase() !== normalizedItem.brand.toLowerCase() &&
        !['the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'size', 'sz', 'color', 'pre', 'owned', 'used', 'new', 'good', 'fair', 'condition', 'unknown', 'na', 'nwt'].includes(t)
      );
      if (nonBrandTokens.length > 0) {
        const topTokens = nonBrandTokens.slice(0, 4).join(' ');
        queries.push({ q: `${normalizedItem.brand} ${topTokens}`, type: 'BRAND_PRODUCT_TOKENS' });
      }
    }

    if (normalizedItem.searchTokens && normalizedItem.searchTokens.length > 0) {
      const topTokens = normalizedItem.searchTokens
        .filter(t => !['the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'unknown', 'na'].includes(t))
        .slice(0, 5)
        .join(' ');
      if (topTokens) {
        queries.push({ q: topTokens, type: 'TITLE_TOKENS' });
      }
    }

    if (queries.length === 0) {
      return { items: [], total: 0, queryUsed: '', error: 'NO_QUERY_AVAILABLE' };
    }

    // Use primary query
    const primaryQuery = queries[0];
    const marketplaceHeader = marketplace || 'EBAY_US';

    // Prepare search params
    const searchParams = {
      q: primaryQuery.q,
      limit: Math.min(maxResults, 50)
    };

    // Apply category_ids if available (valid numeric eBay category)
    if (normalizedItem.categoryId && /^\d+$/.test(String(normalizedItem.categoryId))) {
      searchParams.category_ids = String(normalizedItem.categoryId);
    }

    let rawListings = [];
    let responseTotal = 0;

    try {
      const response = await axios.get(BROWSE_API_URL, {
        params: searchParams,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': marketplaceHeader,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      rawListings = response.data.itemSummaries || [];
      responseTotal = response.data.total || rawListings.length;
    } catch (apiErr) {
      // If category_ids caused a 400 or error, fall back to searching without category_ids
      if (searchParams.category_ids) {
        console.warn(`[BrowseConnector] Category-filtered search failed (${apiErr.message}), falling back without category_ids.`);
        delete searchParams.category_ids;
        const fallbackRes = await axios.get(BROWSE_API_URL, {
          params: searchParams,
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceHeader,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        rawListings = fallbackRes.data.itemSummaries || [];
        responseTotal = fallbackRes.data.total || rawListings.length;
      } else {
        throw apiErr;
      }
    }

    // Fallback: If category_ids returned 0 items, retry without category_ids to get comps
    if (rawListings.length === 0 && searchParams.category_ids) {
      console.log(`[BrowseConnector] 0 results with category_ids=${searchParams.category_ids}, retrying open search...`);
      delete searchParams.category_ids;
      try {
        const fallbackRes = await axios.get(BROWSE_API_URL, {
          params: searchParams,
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceHeader,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        rawListings = fallbackRes.data.itemSummaries || [];
        responseTotal = fallbackRes.data.total || rawListings.length;
      } catch (fbErr) {
        console.warn('[BrowseConnector] Open search retry error:', fbErr.message);
      }
    }

    const normalizedItems = rawListings.map(item => normalizeBrowseItem(item, marketplaceHeader));

    return {
      items: normalizedItems,
      total: responseTotal || normalizedItems.length,
      queryUsed: primaryQuery.q,
      queryType: primaryQuery.type,
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    console.error(`[BrowseConnector] eBay Browse API error (status ${status}):`, errorData || error.message);
    
    return {
      items: [],
      total: 0,
      queryUsed: '',
      error: status === 429 ? 'RATE_LIMIT' : (error.message || 'API_ERROR'),
      retrieved_at: new Date().toISOString()
    };
  }
}

module.exports = {
  fetchActiveListings,
  normalizeBrowseItem
};
