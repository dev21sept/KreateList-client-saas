const axios = require('axios');
const User = require('../models/User');

const ETSY_CLIENT_ID = process.env.ETSY_CLIENT_ID || '8wjat6eeh0w2bpsx7csgxrb4';
const ETSY_CLIENT_SECRET = process.env.ETSY_CLIENT_SECRET || '53py6xxcyt';

async function getValidToken(userId) {
  const user = await User.findById(userId);
  if (!user || !user.etsyAccount || !user.etsyAccount.connected) {
    throw new Error('Etsy account not connected');
  }

  const { accessToken, refreshToken, tokenExpires } = user.etsyAccount;

  // Check if token is expired or expires in less than 5 minutes (300 seconds)
  const isExpired = !tokenExpires || (new Date(tokenExpires).getTime() - Date.now() < 300 * 1000);

  if (!isExpired) {
    return accessToken;
  }

  console.log(`[Etsy Service] Access token expired or expiring soon. Refreshing token for user: ${userId}`);

  try {
    const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: ETSY_CLIENT_ID,
        refresh_token: refreshToken
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    user.etsyAccount.accessToken = data.access_token;
    user.etsyAccount.refreshToken = data.refresh_token || refreshToken;
    user.etsyAccount.tokenExpires = expiresAt;
    await user.save();

    console.log(`[Etsy Service] Token successfully refreshed!`);
    return data.access_token;
  } catch (err) {
    console.error(`[Etsy Service] Token refresh failed:`, err.response?.data || err.message);
    throw new Error(`Etsy authentication expired. Please reconnect your Etsy account.`);
  }
}

async function getShopInfo(accessToken) {
  const userIdPrefix = accessToken ? accessToken.split('.')[0] : 'User';
  try {
    console.log('[Etsy Service] Parsed User ID Prefix:', userIdPrefix);
    console.log('[Etsy Service] Access Token length:', accessToken ? accessToken.length : 0);
    if (!userIdPrefix) {
      throw new Error('Invalid access token format');
    }

    // Fetch User's Shops
    const url = `https://api.etsy.com/v3/application/users/${userIdPrefix}/shops`;
    console.log('[Etsy Service] Requesting shops from URL:', url);
    const response = await axios.get(url, {
      headers: {
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('[Etsy Service] API Response status:', response.status);
    console.log('[Etsy Service] API Response data:', JSON.stringify(response.data));

    const data = response.data;
    let shopId = '';
    let shopName = '';

    if (data?.shop_id) {
      shopId = String(data.shop_id);
      shopName = data.shop_name;
    } else if (data?.results && data.results.length > 0) {
      shopId = String(data.results[0].shop_id);
      shopName = data.results[0].shop_name;
    } else if (Array.isArray(data) && data.length > 0) {
      shopId = String(data[0].shop_id);
      shopName = data[0].shop_name;
    }

    if (!shopId) {
      console.warn('[Etsy Service] No seller shop found for this Etsy user. Defaulting to User ID.');
      return {
        shopId: userIdPrefix,
        shopName: `Etsy User (${userIdPrefix})`
      };
    }

    return {
      shopId,
      shopName
    };
  } catch (err) {
    console.error('[Etsy Service] Fetch shop info failed:', err.response?.data || err.message);
    // Graceful fallback so OAuth connection completes even if account has no active seller shop
    return {
      shopId: userIdPrefix,
      shopName: `Etsy User (${userIdPrefix})`
    };
  }
}

async function createDraftListing(userId, shopId, listingData) {
  const accessToken = await getValidToken(userId);

  const payload = {
    quantity: listingData.quantity || 1,
    title: listingData.title.substring(0, 140), // Etsy title limit is 140 characters
    description: listingData.description || 'Listing created via eLister',
    price: parseFloat(listingData.price || '0.00').toFixed(2),
    taxonomy_id: parseInt(listingData.taxonomy_id || '1091'), // Default Clothing taxonomy node
    who_made: listingData.who_made || 'i_did',
    when_made: listingData.when_made || '2020_2026',
    is_supply: listingData.is_supply === true || listingData.is_supply === 'true'
  };

  if (listingData.shipping_profile_id) {
    payload.shipping_profile_id = parseInt(listingData.shipping_profile_id);
  }

  // Fetch readiness state definition if not provided (mandatory for physical listings in v3)
  let readinessStateId = listingData.readiness_state_id;
  if (!readinessStateId) {
    try {
      console.log(`[Etsy Service] Fetching readiness state definitions for shop: ${shopId}`);
      const defResponse = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`, {
        headers: {
          'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const definitions = defResponse.data?.results || [];
      if (definitions.length > 0) {
        readinessStateId = definitions[0].readiness_state_id;
        console.log(`[Etsy Service] Automatically selected readiness_state_id: ${readinessStateId} from shop definitions.`);
      } else {
        console.warn(`[Etsy Service] No readiness state definitions found for shop: ${shopId}`);
      }
    } catch (err) {
      console.error('[Etsy Service] Failed to auto-fetch readiness state definition:', err.response?.data || err.message);
    }
  }

  if (readinessStateId) {
    payload.readiness_state_id = parseInt(readinessStateId);
  }

  console.log('[Etsy Service] Outgoing createDraftListing payload:', JSON.stringify(payload, null, 2));

  const params = new URLSearchParams();
  Object.keys(payload).forEach(key => {
    params.append(key, String(payload[key]));
  });
  
  if (listingData.tags && listingData.tags.length > 0) {
    listingData.tags.forEach(tag => {
      params.append('tags', tag.substring(0, 20));
    });
  }

  if (listingData.materials && listingData.materials.length > 0) {
    listingData.materials.forEach(mat => {
      params.append('materials', mat.substring(0, 45));
    });
  }

  try {
    console.log('[Etsy Service] Sending POST request to Etsy listings endpoint with legacy=false...');
    const response = await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings?legacy=false`, 
      params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('[Etsy Service] Etsy API success response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (err) {
    console.error('[Etsy Service] Create draft listing failed:', err.response?.data || err.message);
    const apiError = err.response?.data?.error || err.message;
    throw new Error(apiError);
  }
}

async function uploadListingImage(userId, shopId, listingId, imageUrl) {
  const accessToken = await getValidToken(userId);
  
  let imageBuffer;
  let filename = 'image.jpg';
  
  if (imageUrl.startsWith('http')) {
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    imageBuffer = Buffer.from(imgRes.data);
  } else if (imageUrl.startsWith('data:image')) {
    const parts = imageUrl.split(';base64,');
    imageBuffer = Buffer.from(parts[1], 'base64');
  } else {
    const fs = require('fs');
    if (fs.existsSync(imageUrl)) {
      imageBuffer = fs.readFileSync(imageUrl);
    }
  }

  if (!imageBuffer) {
    throw new Error('Invalid image source');
  }

  const FormData = require('form-data');
  const formData = new FormData();
  formData.append('image', imageBuffer, { filename: filename, contentType: 'image/jpeg' });

  const url = `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`;
  
  try {
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (err) {
    console.error('[Etsy Service] Image upload failed:', err.response?.data || err.message);
    throw err;
  }
}

async function getEtsyInventory(userId, shopId) {
  const accessToken = await getValidToken(userId);
  try {
    const response = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/listings/state/active?limit=48`, {
      headers: {
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data?.results || [];
  } catch (err) {
    console.error('[Etsy Service] Fetch inventory failed:', err.response?.data || err.message);
    throw err;
  }
}

async function getShippingProfiles(userId, shopId) {
  const accessToken = await getValidToken(userId);
  try {
    const response = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/shipping-profiles`, {
      headers: {
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data?.results || [];
  } catch (err) {
    console.error('[Etsy Service] Fetch shipping profiles failed:', err.response?.data || err.message);
    throw err;
  }
}

async function updateListingState(userId, shopId, listingId, state) {
  const accessToken = await getValidToken(userId);
  try {
    const response = await axios.patch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, 
      new URLSearchParams({ state: state }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    return response.data;
  } catch (err) {
    console.error('[Etsy Service] Update listing state failed:', err.response?.data || err.message);
    throw err;
  }
}

async function getCategoryProperties(userId, taxonomyId) {
  let accessToken = null;
  try {
    accessToken = await getValidToken(userId);
  } catch (e) {
    console.log(`[Etsy Service] Fetching properties publicly without OAuth token because: ${e.message}`);
  }
  
  try {
    const headers = {
      'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const response = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, { headers });
    return response.data?.results || [];
  } catch (err) {
    console.error(`[Etsy Service] Fetch category properties failed for ${taxonomyId}:`, err.response?.data || err.message);
    throw err;
  }
}

async function updateListingProperty(userId, shopId, listingId, propertyId, valueIds, values) {
  const accessToken = await getValidToken(userId);
  const params = new URLSearchParams();
  if (valueIds && valueIds.length > 0) {
    valueIds.forEach(id => params.append('value_ids', String(id)));
  }
  if (values && values.length > 0) {
    values.forEach(v => params.append('values', String(v)));
  }
  try {
    const response = await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/${propertyId}`, 
      params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    return response.data;
  } catch (err) {
    console.error(`[Etsy Service] Update listing property ${propertyId} failed:`, err.response?.data || err.message);
    throw err;
  }
}

async function updateEtsyListing(userId, shopId, listingId, listingData) {
  const accessToken = await getValidToken(userId);

  const payload = {
    quantity: listingData.quantity || 1,
    title: listingData.title ? listingData.title.substring(0, 140) : '',
    description: listingData.description || 'Listing updated via eLister',
    price: parseFloat(listingData.price || '0.00').toFixed(2),
    who_made: listingData.who_made || 'i_did',
    when_made: listingData.when_made || '2020_2026',
    is_supply: listingData.is_supply === true || listingData.is_supply === 'true'
  };

  if (listingData.shipping_profile_id) {
    payload.shipping_profile_id = parseInt(listingData.shipping_profile_id);
  }

  console.log('[Etsy Service] Outgoing updateEtsyListing payload:', JSON.stringify(payload, null, 2));

  const params = new URLSearchParams();
  Object.keys(payload).forEach(key => {
    params.append(key, String(payload[key]));
  });
  
  if (listingData.tags && listingData.tags.length > 0) {
    listingData.tags.forEach(tag => {
      params.append('tags', tag.substring(0, 20));
    });
  }

  if (listingData.materials && listingData.materials.length > 0) {
    listingData.materials.forEach(mat => {
      params.append('materials', mat.substring(0, 45));
    });
  }

  try {
    const url = `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`;
    const response = await axios.patch(url, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (err) {
    console.error('[Etsy Service] Update listing failed:', err.response?.data || err.message);
    const apiError = err.response?.data?.error || err.message;
    throw new Error(apiError);
  }
}

module.exports = {
  getValidToken,
  getShopInfo,
  createDraftListing,
  uploadListingImage,
  getEtsyInventory,
  getShippingProfiles,
  updateListingState,
  getCategoryProperties,
  updateListingProperty,
  updateEtsyListing,
  ETSY_CLIENT_ID,
  ETSY_CLIENT_SECRET
};
