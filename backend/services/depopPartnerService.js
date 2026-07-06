const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { DEPOP_TAXONOMY } = require('../constants/depopTaxonomy');

const DEPOP_PARTNER_API_URL = process.env.DEPOP_PARTNER_API_URL || 'https://partnerapi.depop.com';

// Helper to construct axios config with HTTP Proxy support if configured
function getAxiosConfig(options) {
  const config = {
    method: options.method || 'GET',
    url: options.url,
    headers: options.headers || {},
    data: options.data || null,
    timeout: 30000
  };

  const proxyUrl = process.env.HTTP_PROXY_URL;
  if (proxyUrl) {
    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
  }
  
  return config;
}

// -------------------------------------------------------------
// Field Mapping Helpers
// -------------------------------------------------------------

function mapCountryCode(country) {
  if (!country) return 'US';
  const c = country.trim().toLowerCase();
  if (c === 'united states' || c === 'usa' || c === 'us') return 'US';
  if (c === 'united kingdom' || c === 'uk' || c === 'gb' || c === 'great britain') return 'GB';
  if (c === 'canada' || c === 'ca') return 'CA';
  if (c === 'australia' || c === 'au') return 'AU';
  return 'US'; // default fallback
}

function sanitizeDescription(desc) {
  if (!desc) return '';
  // Strip HTML tags
  let clean = desc.replace(/<[^>]*>/g, '');
  if (clean.length > 1000) {
    clean = clean.substring(0, 997) + '...';
  }
  return clean;
}

function mapListingSize(sizeStr) {
  let size_set_id = 54; // Default to Men Tops size set
  let size_id = 4;      // Default to Medium

  if (sizeStr) {
    const match = String(sizeStr).match(/^(\d+)\.([\d.]+)-(\w+)$/);
    if (match) {
      size_set_id = parseInt(match[1]);
      size_id = parseInt(match[2]);
    } else {
      const sizeName = String(sizeStr).trim().toUpperCase();
      const standardSizes = {
        'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5, 'XL': 6, 'XXL': 7, '3XL': 8, '4XL': 9,
        'ONE SIZE': 90, 'OS': 90
      };
      if (standardSizes[sizeName] !== undefined) {
        size_id = standardSizes[sizeName];
      }
    }
  }
  return { size_set_id, size_id };
}

const VALID_COLORS = [
  'black', 'grey', 'white', 'brown', 'tan', 'cream', 'yellow', 'red', 'burgundy', 
  'orange', 'pink', 'purple', 'blue', 'navy', 'green', 'khaki', 'multi', 'silver', 'gold'
];

function mapColors(colorInput) {
  if (!colorInput) return [];
  const list = Array.isArray(colorInput) 
    ? colorInput 
    : String(colorInput).split(',').map(c => c.trim().toLowerCase());
  
  const mapped = list
    .map(c => {
      if (c === 'gray') return 'grey';
      if (c === 'dark blue') return 'navy';
      if (c === 'off-white' || c === 'off white') return 'cream';
      return c;
    })
    .filter(c => VALID_COLORS.includes(c));
  
  return [...new Set(mapped)].slice(0, 2);
}

const VALID_STYLES = [
  'streetwear', 'sportswear', 'loungewear', 'goth', 'retro', 'boho', 'western', 
  'indie', 'skater', 'rave', 'costume', 'cosplay', 'grunge', 'emo', 'minimalist', 
  'preppy', 'avant_garde', 'punk', 'glam', 'regency', 'casual', 'techwear', 
  'futuristic', 'cottage', 'fairy', 'kidcore', 'y2_k', 'biker', 'gorpcore', 
  'twee', 'coquette', 'whimsygoth'
];

function mapStyles(styleInput) {
  if (!styleInput) return [];
  const list = Array.isArray(styleInput)
    ? styleInput
    : String(styleInput).split(',').map(s => s.trim().toLowerCase());
  
  const mapped = list
    .map(s => {
      if (s === 'y2k') return 'y2_k';
      if (s === 'avant-garde') return 'avant_garde';
      return s.replace(/[\s-]/g, '_');
    })
    .filter(s => VALID_STYLES.includes(s));
  
  return [...new Set(mapped)].slice(0, 3);
}

function mapCondition(conditionInput) {
  const c = String(conditionInput || '').toLowerCase().trim();
  if (c.includes('brand_new') || c.includes('brand new') || c.includes('new') || c.includes('nwt')) return 'brand_new';
  if (c.includes('like_new') || c.includes('like new') || c.includes('nwot')) return 'used_like_new';
  if (c.includes('excellent')) return 'used_excellent';
  if (c.includes('good') || c.includes('very_good') || c.includes('very good')) return 'used_good';
  if (c.includes('fair')) return 'used_fair';
  return 'used_excellent';
}

function mapCategory(categoryId) {
  const match = DEPOP_TAXONOMY.find(cat => cat.id === categoryId);
  if (match) {
    return {
      department: match.departmentId || 'womenswear',
      product_type: match.id
    };
  }
  return {
    department: 'womenswear',
    product_type: 'tshirts'
  };
}

// -------------------------------------------------------------
// Core API Calls
// -------------------------------------------------------------

/**
 * Publish/Update listing to Depop Partner API (by SKU)
 */
async function publishToDepopPartner(listing, apiKey) {
  const sku = listing.sku || `SKU-${listing._id.toString().substring(18)}`;
  const { department, product_type } = mapCategory(listing.categoryId);
  const { size_set_id, size_id } = mapListingSize(listing.size);

  const payload = {
    address: {
      country_code: mapCountryCode(listing.country),
      state: listing.state || 'CA'
    },
    description: sanitizeDescription(listing.description),
    price_currency: listing.currency || 'USD',
    price_amount: parseFloat(listing.price || 0).toFixed(2),
    national_shipping_cost: parseFloat(listing.shippingPrice || 0).toFixed(2),
    quantity: parseInt(listing.quantity) || 1,
    pictures: (listing.images || []).map(imgUrl => ({ url: imgUrl })),
    department,
    product_type,
    size_set_id,
    size_id,
    condition: mapCondition(listing.condition),
    brand_name: listing.brand || 'unbranded',
    colour: mapColors(listing.color),
    style: mapStyles(listing.styleTag),
    attributes: {} // Optional: can be extended as needed
  };

  // If international shipping cost exists, add it
  if (listing.intlShippingPrice && parseFloat(listing.intlShippingPrice) > 0) {
    payload.international_shipping_cost = parseFloat(listing.intlShippingPrice).toFixed(2);
  }

  const url = `${DEPOP_PARTNER_API_URL}/api/v1/products/by-sku/${encodeURIComponent(sku)}/`;
  console.log(`[Depop Partner Service] PUT request to URL: ${url}`, JSON.stringify(payload, null, 2));

  const options = {
    method: 'PUT',
    url,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    data: payload
  };

  try {
    const response = await axios(getAxiosConfig(options));
    console.log(`[Depop Partner Service] Publish response status: ${response.status}`, response.data);
    
    return {
      id: response.data.product_id || '',
      url: response.data.slug ? `https://www.depop.com/products/${response.data.slug}` : ''
    };
  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Depop Partner Service] Publish error: ${errorDetails}`);
    throw new Error(`Depop Partner API Error: ${errorDetails}`);
  }
}

/**
 * Delete listing from Depop Partner API (by SKU)
 */
async function deleteFromDepopPartner(sku, apiKey) {
  if (!sku) {
    throw new Error('SKU is required to delete product from Depop Partner API');
  }

  const url = `${DEPOP_PARTNER_API_URL}/api/v1/products/by-sku/${encodeURIComponent(sku)}/`;
  console.log(`[Depop Partner Service] DELETE request to URL: ${url}`);

  const options = {
    method: 'DELETE',
    url,
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  };

  try {
    const response = await axios(getAxiosConfig(options));
    console.log(`[Depop Partner Service] Delete response status: ${response.status}`);
    return true;
  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Depop Partner Service] Delete error: ${errorDetails}`);
    throw new Error(`Depop Partner API Error: ${errorDetails}`);
  }
}

/**
 * Get all active/sold listings from Depop Partner API
 */
async function getListingsFromDepopPartner(apiKey) {
  const url = `${DEPOP_PARTNER_API_URL}/api/v1/products/?limit=100`;
  console.log(`[Depop Partner Service] GET request to URL: ${url}`);

  const options = {
    method: 'GET',
    url,
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  };

  try {
    const response = await axios(getAxiosConfig(options));
    const items = response.data?.data || [];
    
    // Map response format to frontend expected format
    return items.map(item => ({
      depopListingId: String(item.product_id),
      title: item.title || item.description?.substring(0, 40) || 'Untitled',
      description: item.description || '',
      price: item.price_amount || '0',
      sku: item.sku || '',
      brand: item.brand || '',
      images: (item.pictures || []).map(p => p.url),
      depopUrl: item.slug ? `https://www.depop.com/products/${item.slug}` : ''
    }));
  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Depop Partner Service] Get listings error: ${errorDetails}`);
    throw new Error(`Depop Partner API Error: ${errorDetails}`);
  }
}

/**
 * Mark a product as sold on Depop Partner API
 */
async function markAsSoldOnDepopPartner(sku, apiKey) {
  if (!sku) {
    throw new Error('SKU is required to mark product as sold on Depop Partner API');
  }

  const url = `${DEPOP_PARTNER_API_URL}/api/v1/products/by-sku/${encodeURIComponent(sku)}/mark-as-sold/`;
  console.log(`[Depop Partner Service] POST mark-as-sold to URL: ${url}`);

  const options = {
    method: 'POST',
    url,
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  };

  try {
    const response = await axios(getAxiosConfig(options));
    console.log(`[Depop Partner Service] Mark-as-sold response status: ${response.status}`);
    return true;
  } catch (error) {
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error(`[Depop Partner Service] Mark-as-sold error: ${errorDetails}`);
    throw new Error(`Depop Partner API Error: ${errorDetails}`);
  }
}

module.exports = {
  publishToDepopPartner,
  deleteFromDepopPartner,
  getListingsFromDepopPartner,
  markAsSoldOnDepopPartner
};
