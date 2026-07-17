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
  try {
    // 1. Get User ID from Access Token prefix
    const userIdPrefix = accessToken.split('.')[0];
    console.log('[Etsy Service] Parsed User ID Prefix:', userIdPrefix);
    console.log('[Etsy Service] Access Token length:', accessToken ? accessToken.length : 0);
    if (!userIdPrefix) {
      throw new Error('Invalid access token format');
    }

    // 2. Fetch User's Shops
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
    }

    if (!shopId) {
      throw new Error('No Etsy shops found for this account.');
    }

    return {
      shopId,
      shopName
    };
  } catch (err) {
    console.error('[Etsy Service] Fetch shop info failed:', err.response?.data || err.message);
    throw err;
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
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: false
  };

  try {
    const response = await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings`, 
      new URLSearchParams(payload), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

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

  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  formData.append('image', blob, filename);

  const url = `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`;
  
  try {
    const response = await axios.post(url, formData, {
      headers: {
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

async function getEbayInventory(userId, shopId) {
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

module.exports = {
  getValidToken,
  getShopInfo,
  createDraftListing,
  uploadListingImage,
  getEbayInventory,
  ETSY_CLIENT_ID,
  ETSY_CLIENT_SECRET
};
