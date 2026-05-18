const axios = require('axios');
const User = require('../models/User');

const EBAY_AUTH_HOST = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_HOST = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_API_BASE = 'https://api.ebay.com';

let cachedAppToken = null;
let appTokenExpiry = null;

const getAppToken = async () => {
  if (cachedAppToken && appTokenExpiry && Date.now() < appTokenExpiry) {
    return cachedAppToken;
  }

  const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  
  try {
    const response = await axios.post(EBAY_TOKEN_HOST, 
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    cachedAppToken = response.data.access_token;
    appTokenExpiry = Date.now() + 3600000; // 1 hour
    return cachedAppToken;
  } catch (error) {
    console.error('Error getting eBay App Token:', error.response?.data || error.message);
    throw error;
  }
};

exports.getCategorySuggestions = async (query) => {
  try {
    const token = await getAppToken();
    const response = await axios.get(`${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data.categorySuggestions || [];
  } catch (error) {
    console.error(`Error getting category suggestions:`, error.response?.data || error.message);
    return [];
  }
};

exports.getItemAspectsForCategory = async (categoryId) => {
  try {
    const token = await getAppToken();
    const response = await axios.get(`${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting item aspects:`, error.response?.data || error.message);
    return null;
  }
};

exports.getFulfillmentPolicies = async (token, marketplaceId = 'EBAY_US') => {
  const response = await axios.get(`${EBAY_API_BASE}/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.data.fulfillmentPolicies || [];
};

exports.getPaymentPolicies = async (token, marketplaceId = 'EBAY_US') => {
  const response = await axios.get(`${EBAY_API_BASE}/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.data.paymentPolicies || [];
};

exports.getReturnPolicies = async (token, marketplaceId = 'EBAY_US') => {
  const response = await axios.get(`${EBAY_API_BASE}/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.data.returnPolicies || [];
};

exports.getLocations = async (token) => {
  const response = await axios.get(`${EBAY_API_BASE}/sell/inventory/v1/location`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.data.locations || [];
};

exports.getAuthUrl = (userId) => {
  const params = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.EBAY_RU_NAME,
    scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account',
    prompt: 'login',
    state: userId
  });
  const url = `${EBAY_AUTH_HOST}?${params.toString()}`;
  console.log('Generated eBay Auth URL:', url);
  return url;
};

exports.exchangeCodeForToken = async (code) => {
  const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  
  try {
    const response = await axios.post(EBAY_TOKEN_HOST, 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.EBAY_RU_NAME
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('eBay Token Exchange Error Details:', error.response?.data || error.message);
    throw error;
  }
};

exports.refreshToken = async (refreshToken) => {
  const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(EBAY_TOKEN_HOST, 
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      }
    }
  );

  return response.data;
};

exports.getEbayUserDetails = async (accessToken) => {
  try {
    const response = await axios.get(`${EBAY_API_BASE}/commerce/identity/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching eBay user details:', error.response?.data || error.message);
    // Fallback or return empty
    return null;
  }
};
