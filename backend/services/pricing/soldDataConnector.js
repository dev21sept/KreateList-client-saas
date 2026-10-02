/**
 * Sold Data Connector (Stage 2)
 * Adapter interface for authorized sold and completed historical transaction data.
 * Complies strictly with eBay API terms: does not scrape or claim unauthorized Terapeak access.
 * If sold data is unavailable, clearly reports it so the engine lowers confidence appropriately.
 */

/**
 * Normalizes an external sold record into standard schema
 */
function normalizeSoldItem(rawRecord, providerName = 'AUTHORIZED_PROVIDER') {
  const itemPrice = parseFloat(rawRecord.item_price || rawRecord.price || 0);
  const shippingPrice = parseFloat(rawRecord.shipping_price || rawRecord.shipping || 0);
  
  return {
    item_id: rawRecord.item_id || rawRecord.id || `sold_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: rawRecord.title || '',
    item_url: rawRecord.item_url || null,
    thumbnail_url: rawRecord.thumbnail_url || null,
    item_price: itemPrice,
    shipping_price: shippingPrice,
    total_price: parseFloat((itemPrice + shippingPrice).toFixed(2)),
    currency: rawRecord.currency || 'USD',
    condition: rawRecord.condition || 'USED',
    source_type: 'SOLD',
    provider: providerName,
    marketplace: rawRecord.marketplace || 'EBAY_US',
    observed_at: rawRecord.observed_at || rawRecord.sale_date || new Date().toISOString()
  };
}

/**
 * Fetches sold listing evidence from configured, authorized sources
 * @param {Object} normalizedItem 
 * @param {string} marketplace 
 * @param {number} maxResults 
 */
async function fetchSoldListings(normalizedItem, marketplace = 'EBAY_US', maxResults = 25) {
  // Check if an approved licensed sold feed or Marketplace Insights is configured in environment
  const soldFeedUrl = process.env.EBAY_SOLD_DATA_PROVIDER_URL;
  const soldFeedApiKey = process.env.EBAY_SOLD_DATA_API_KEY;

  if (!soldFeedUrl || !soldFeedApiKey) {
    // Compliant default: No unauthorized scraping. Safely report sold data as unavailable.
    return {
      items: [],
      available: false,
      reason: 'SOLD_DATA_ACCESS_NOT_CONFIGURED',
      note: 'Authorized sold data feed is not currently enabled. Active listings will be used as asking-price context.',
      retrieved_at: new Date().toISOString()
    };
  }

  try {
    const axios = require('axios');
    const response = await axios.get(soldFeedUrl, {
      params: {
        q: normalizedItem.upc || `${normalizedItem.brand} ${normalizedItem.model}`.trim() || normalizedItem.title,
        marketplace,
        limit: maxResults
      },
      headers: {
        'Authorization': `Bearer ${soldFeedApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const rawListings = response.data.items || [];
    const normalizedItems = rawListings.map(r => normalizeSoldItem(r, 'LICENSED_FEED'));

    return {
      items: normalizedItems,
      available: true,
      reason: null,
      total: normalizedItems.length,
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    console.warn('[SoldDataConnector] Error connecting to authorized sold feed:', error.message);
    return {
      items: [],
      available: false,
      reason: 'FEED_TEMPORARILY_UNAVAILABLE',
      error: error.message,
      retrieved_at: new Date().toISOString()
    };
  }
}

module.exports = {
  fetchSoldListings,
  normalizeSoldItem
};
