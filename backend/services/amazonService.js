const axios = require('axios');
const User = require('../models/User');

const AMAZON_CLIENT_ID = process.env.AMAZON_CLIENT_ID || '';
const AMAZON_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || '';
const DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER'; // Amazon US
const SP_API_ENDPOINT_NA = 'https://sellingpartnerapi-na.amazon.com';

/**
 * Exchange Authorization Code from LWA / SP-API OAuth for Tokens
 */
async function exchangeAuthCode(code, redirectUri) {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('client_id', AMAZON_CLIENT_ID);
    params.append('client_secret', AMAZON_CLIENT_SECRET);
    if (redirectUri) {
      params.append('redirect_uri', redirectUri);
    }

    const response = await axios.post('https://api.amazon.com/auth/o2/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  } catch (error) {
    console.error('[Amazon Service] Token exchange error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error_description || error.response?.data?.message || 'Failed to exchange authorization code with Amazon.');
  }
}

/**
 * Get or Refresh LWA Access Token for SP-API calls
 */
async function getLwaAccessToken(user) {
  if (!user || !user.amazonAccount || !user.amazonAccount.refreshToken) {
    throw new Error('User Amazon account is not connected or missing refresh token.');
  }

  const { accessToken, tokenExpires, refreshToken } = user.amazonAccount;
  const now = new Date();

  // If token is still valid (with 5 minute safety buffer), return it
  if (accessToken && tokenExpires && new Date(tokenExpires).getTime() - now.getTime() > 5 * 60 * 1000) {
    return accessToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', AMAZON_CLIENT_ID);
    params.append('client_secret', AMAZON_CLIENT_SECRET);

    const response = await axios.post('https://api.amazon.com/auth/o2/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const newAccessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;

    user.amazonAccount.accessToken = newAccessToken;
    user.amazonAccount.tokenExpires = new Date(Date.now() + (expiresIn - 300) * 1000);
    await user.save();

    return newAccessToken;
  } catch (error) {
    console.error('[Amazon Service] Refresh token error:', error.response?.data || error.message);
    throw new Error('Failed to refresh Amazon LWA token. Please reconnect your Amazon account.');
  }
}

/**
 * Get Seller Marketplace Participations
 */
async function getMarketplaceParticipations(user) {
  try {
    const accessToken = await getLwaAccessToken(user);

    const response = await axios.get(`${SP_API_ENDPOINT_NA}/sellers/v1/marketplaceParticipations`, {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    return response.data?.payload || [];
  } catch (error) {
    console.warn('[Amazon Service] getMarketplaceParticipations warning:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Map generic condition to Amazon SP-API condition_type
 */
function mapConditionToAmazon(cond) {
  const c = String(cond || '').toLowerCase().trim();
  if (c.includes('like new') || c.includes('mint')) return 'used_like_new';
  if (c.includes('very good')) return 'used_very_good';
  if (c.includes('good') || c.includes('pre-owned') || c.includes('used')) return 'used_good';
  if (c.includes('fair') || c.includes('acceptable')) return 'used_acceptable';
  if (c.includes('refurbished')) return 'refurbished';
  return 'new_new';
}

/**
 * Publish / Push listing to Amazon SP-API Listings Items API (v2021-08-01)
 */
async function publishToAmazon(listing, user) {
  const sellerId = user?.amazonAccount?.sellerId;
  const marketplaceId = user?.amazonAccount?.marketplaceId || DEFAULT_MARKETPLACE_ID;
  const sku = (listing.sku || `ELISTER-AMZ-${listing._id}`).trim();

  if (!sellerId) {
    throw new Error('Amazon Seller ID (Merchant ID) is missing. Please reconnect your Amazon account.');
  }

  const accessToken = await getLwaAccessToken(user);

  // Prepare standard Amazon bullet points (max 5)
  const bullets = Array.isArray(listing.amazonBulletPoints) && listing.amazonBulletPoints.length > 0
    ? listing.amazonBulletPoints.filter(b => b && String(b).trim()).slice(0, 5)
    : [];

  // Prepare backend search terms
  const keywords = Array.isArray(listing.amazonGenericKeywords)
    ? listing.amazonGenericKeywords.filter(Boolean)
    : (typeof listing.amazonGenericKeywords === 'string' ? listing.amazonGenericKeywords.split(',').map(s => s.trim()) : []);

  const productType = listing.amazonProductType || 'PRODUCT';
  const conditionType = mapConditionToAmazon(listing.amazonCondition || listing.selectedCondition || listing.condition);

  const attributes = {
    item_name: [
      {
        value: listing.title,
        marketplace_id: marketplaceId
      }
    ],
    product_description: [
      {
        value: listing.description,
        marketplace_id: marketplaceId
      }
    ],
    brand: [
      {
        value: listing.brand || 'Generic',
        marketplace_id: marketplaceId
      }
    ],
    condition_type: [
      {
        value: conditionType,
        marketplace_id: marketplaceId
      }
    ],
    purchasable_offer: [
      {
        currency: 'USD',
        our_price: [
          {
            schedule: [
              {
                value_with_tax: Number(listing.price || 0)
              }
            ]
          }
        ],
        marketplace_id: marketplaceId
      }
    ],
    merchant_shipping_group: [
      {
        value: 'Default',
        marketplace_id: marketplaceId
      }
    ]
  };

  if (bullets.length > 0) {
    attributes.bullet_point = bullets.map(b => ({
      value: String(b).trim(),
      marketplace_id: marketplaceId
    }));
  }

  if (keywords.length > 0) {
    attributes.generic_keyword = keywords.map(k => ({
      value: String(k).trim(),
      marketplace_id: marketplaceId
    }));
  }

  if (Array.isArray(listing.images) && listing.images.length > 0) {
    attributes.main_product_image_locator = [
      {
        media_location: listing.images[0],
        marketplace_id: marketplaceId
      }
    ];

    if (listing.images.length > 1) {
      attributes.other_product_image_locator = listing.images.slice(1, 9).map(img => ({
        media_location: img,
        marketplace_id: marketplaceId
      }));
    }
  }

  if (listing.amazonStandardProductId && listing.amazonStandardProductId.value) {
    attributes.externally_assigned_product_identifier = [
      {
        type: listing.amazonStandardProductId.idType || 'UPC',
        value: listing.amazonStandardProductId.value,
        marketplace_id: marketplaceId
      }
    ];
  }

  const payload = {
    productType: productType.toUpperCase(),
    requirements: 'LISTING',
    attributes: attributes
  };

  const url = `${SP_API_ENDPOINT_NA}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}&issueLocale=en_US`;

  try {
    const response = await axios.put(url, payload, {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    const status = data.status || 'ACCEPTED';
    const submissionId = data.submissionId || `${sellerId}-${sku}`;

    return {
      success: true,
      sku: sku,
      status: status,
      submissionId: submissionId,
      url: `https://www.amazon.com/dp/${listing.amazonAsin || ''}`
    };
  } catch (error) {
    console.error('[Amazon Service] publishToAmazon error:', error.response?.data || error.message);
    const issues = error.response?.data?.issues || [];
    const issueMsg = issues.map(i => `${i.message} (${i.attributeNames?.join(', ') || i.code})`).join('; ');
    throw new Error(issueMsg || error.response?.data?.message || error.message || 'Failed to submit listing to Amazon SP-API.');
  }
}

/**
 * Delete / Delist item from Amazon SP-API
 */
async function deleteFromAmazon(sku, user) {
  const sellerId = user?.amazonAccount?.sellerId;
  const marketplaceId = user?.amazonAccount?.marketplaceId || DEFAULT_MARKETPLACE_ID;

  if (!sellerId) {
    throw new Error('Amazon Seller ID is missing.');
  }

  const accessToken = await getLwaAccessToken(user);
  const url = `${SP_API_ENDPOINT_NA}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`;

  try {
    const response = await axios.delete(url, {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Amazon Service] deleteFromAmazon error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to delete listing from Amazon.');
  }
}

module.exports = {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  DEFAULT_MARKETPLACE_ID,
  exchangeAuthCode,
  getLwaAccessToken,
  getMarketplaceParticipations,
  publishToAmazon,
  deleteFromAmazon,
  mapConditionToAmazon
};
