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
    if (normalizedItem.searchTokens && normalizedItem.searchTokens.length > 0) {
      const topTokens = normalizedItem.searchTokens.slice(0, 5).join(' ');
      queries.push({ q: topTokens, type: 'TITLE_TOKENS' });
    }

    if (queries.length === 0) {
      return { items: [], total: 0, queryUsed: '', error: 'NO_QUERY_AVAILABLE' };
    }

    // Use primary query
    const primaryQuery = queries[0];
    const marketplaceHeader = marketplace || 'EBAY_US';

    const response = await axios.get(BROWSE_API_URL, {
      params: {
        q: primaryQuery.q,
        limit: Math.min(maxResults, 50)
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceHeader,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const rawListings = response.data.itemSummaries || [];
    const normalizedItems = rawListings.map(item => normalizeBrowseItem(item, marketplaceHeader));

    return {
      items: normalizedItems,
      total: response.data.total || normalizedItems.length,
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
