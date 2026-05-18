const crypto = require('crypto');
const mongoose = require('mongoose');
const ebayService = require('../services/ebayService');
const User = require('../models/User');
const Product = require('../models/Product');
const DeletedProduct = require('../models/DeletedProduct');
const Order = require('../models/Order');

// Helper to get active user's connection details
async function getValidToken(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.ebayAccount || !user.ebayAccount.refreshToken) {
      console.error(`--- CRITICAL: Refresh Token missing from Database for user: ${userId} ---`);
      return null;
    }

    let accessToken = user.ebayAccount.accessToken;
    let expiresAt = user.ebayAccount.tokenExpires;

    // If expired or about to expire in 5 mins
    if (!expiresAt || Date.now() > new Date(expiresAt).getTime() - 300000) {
      console.log(`--- REFRESHING EBAY TOKEN FOR USER: ${userId} ---`);
      try {
        const newAccessToken = await ebayService.refreshUserToken(user.ebayAccount.refreshToken);
        accessToken = newAccessToken;
        user.ebayAccount.accessToken = newAccessToken;
        user.ebayAccount.tokenExpires = new Date(Date.now() + 7200 * 1000); // 2 hours

        await user.save();
        console.log('--- TOKEN REFRESHED SUCCESSFULLY ---');
      } catch (err) {
        console.error('--- TOKEN REFRESH FAILED. RE-LOGIN REQUIRED ---', err.message);
        return null;
      }
    }
    return accessToken;
  } catch (error) {
    console.error('Fatal Token Error:', error.message);
    return null;
  }
}

// Helpers for profile extraction
function extractSellerProfile(profile) {
  const businessName = profile?.businessAccount?.name || null;
  const businessEmail = profile?.businessAccount?.email || null;
  const profileName =
    businessName ||
    profile?.userId ||
    profile?.username ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
    null;
  const profileEmail =
    businessEmail ||
    profile?.email ||
    profile?.primaryEmail ||
    profile?.emailAddress ||
    null;

  return {
    name: profileName,
    email: profileEmail
  };
}

// Handle eBay Marketplace Account Deletion Notification (Mandatory for Compliance)
exports.handleDeletionNotification = async (req, res) => {
  try {
    const challengeCode = req.query.challenge_code;
    
    // 1. Handle Challenge Verification (GET)
    if (challengeCode) {
      const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
      const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const endpoint = `${baseUrl}/api/ebay/deletion`;
      
      if (!verificationToken) {
        console.warn(`[EBAY DELETION] Warning: EBAY_VERIFICATION_TOKEN not set in .env`);
      }

      const hash = crypto.createHash('sha256');
      hash.update(challengeCode + (verificationToken || '') + endpoint);
      const responseHash = hash.digest('hex');

      return res.status(200).json({
        challengeResponse: responseHash
      });
    }

    // 2. Handle Actual Notification (POST)
    if (req.method === 'POST') {
      return res.status(200).send('OK');
    }

    return res.status(400).send('Invalid Request');
  } catch (error) {
    console.error(`❌ [EBAY DELETION CRASH]:`, {
      message: error.message,
      stack: error.stack,
      method: req.method,
      query: req.query
    });
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};

// @desc    Get eBay Auth URL
// @route   GET /api/ebay/auth
// @access  Private
exports.getEbayAuthUrl = async (req, res) => {
  try {
    const ruName = process.env.EBAY_RU_NAME;
    // We pass req.user.id in state for GET direct redirects back to the backend if needed
    const state = req.query.state || req.user?.id || 'dashboard'; 
    if (!ruName) return res.status(400).json({ error: 'RuName is required' });
    
    const url = ebayService.getUserConsentUrl(ruName, state);
    console.log('Generated eBay Auth URL:', url);
    res.status(200).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getAuthUrl = exports.getEbayAuthUrl;

// @desc    Callback from eBay OAuth (Supports React POST callback and Direct GET Redirects)
// @route   POST/GET /api/ebay/callback
// @access  Private/Public
exports.ebayCallback = async (req, res) => {
  const isPost = req.method === 'POST';
  const code = isPost ? req.body.code : req.query.code;
  const state = isPost ? (req.body.state || 'dashboard') : req.query.state;
  const error = req.query.error;
  const error_description = req.query.error_description;

  console.log('--- EBAY CALLBACK RECEIVED ---');
  console.log('Method:', req.method);
  console.log('Code:', code);
  console.log('State:', state);

  if (error) {
    console.error('eBay Auth Error:', error, error_description);
    if (isPost) {
      return res.status(400).json({ success: false, message: error_description || error });
    }
    return res.status(400).send(`eBay Login Error: ${error_description || error}. Please try again.`);
  }
  
  if (!code) {
    console.error('No code found in eBay redirect');
    if (isPost) {
      return res.status(400).json({ success: false, message: 'Authentication code missing' });
    }
    return res.status(400).send('Authentication code missing from eBay. Please try connecting again.');
  }

  const ruName = process.env.EBAY_RU_NAME;
  if (!ruName) {
    if (isPost) {
      return res.status(500).json({ success: false, message: 'EBAY_RU_NAME is missing' });
    }
    return res.status(500).send('EBAY_RU_NAME is missing from production environment settings.');
  }

  try {
    const tokens = await ebayService.getUserToken(code, ruName);
    
    // Find the correct user
    let userId = req.user?.id;
    // If it's a GET request direct from eBay, state parameter contains the user's ID
    if (!userId && state && mongoose.Types.ObjectId.isValid(state)) {
      userId = state;
    }

    if (!userId) {
      throw new Error('User context not found in session or state parameters.');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Associated User not found in database.');
    }

    user.ebayAccount.connected = true;
    user.ebayAccount.accessToken = tokens.access_token;
    user.ebayAccount.refreshToken = tokens.refresh_token;
    user.ebayAccount.tokenExpires = new Date(Date.now() + (tokens.expires_in * 1000));
    
    // Fetch and save the seller's profile info
    try {
      console.log('Fetching eBay user profile during callback...');
      const profile = await ebayService.getUserProfile(tokens.access_token);
      if (profile) {
        const { name, email } = extractSellerProfile(profile);
        user.ebayAccount.username = profile.username || profile.userId || name;
        user.ebayAccount.name = name;
        user.ebayAccount.email = email;
        user.ebayAccount.phone = profile.individualAccount?.primaryPhone?.phoneNumber || profile.businessAccount?.primaryPhone?.phoneNumber || '';
        
        console.log(`Connected to eBay account: ${name} (${email})`);
        console.log('--- PRODUCTION OAUTH TOKENS SAVED TO USER DOCUMENT ---');
      }
    } catch (profileErr) {
      console.error('Error fetching user profile during callback:', profileErr.message);
    }

    await user.save();

    if (isPost) {
      return res.status(200).json({
        success: true,
        message: 'eBay Account Connected Successfully!',
        data: user.ebayAccount
      });
    }

    // Direct redirect back to frontend
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
    res.redirect(`${frontendUrl}/ebay-accounts?success=true`);

  } catch (error) {
    console.error('Callback Error:', error.response?.data || error.message);
    const ebayError = error.response?.data;
    const errorMsg = ebayError?.error_description || ebayError?.error || error.message;
    
    if (isPost) {
      return res.status(500).json({ success: false, message: errorMsg });
    }
    res.status(500).send(`Authentication failed: ${errorMsg}. Please check your credentials.`);
  }
};
exports.handleCallback = exports.ebayCallback;

// @desc    Sync Orders from eBay for Logged-In User
// @route   POST /api/ebay/sync/orders
// @access  Private
exports.syncOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    let token = await getValidToken(userId);
    if (!token) return res.status(401).json({ success: false, error: 'No valid token' });

    console.log(`--- STARTING EBAY ORDERS SYNC FOR USER: ${userId} ---`);
    const data = await ebayService.getOrders(token);
    const orders = data.orders || [];
    
    let syncedCount = 0;
    for (const o of orders) {
      const orderData = {
        user: userId,
        orderId: o.orderId,
        ebayOrderId: o.orderId,
        sellerId: o.sellerId,
        buyerUsername: o.buyer?.username,
        totalAmount: o.totalFeeBasisAmount?.value,
        currency: o.totalFeeBasisAmount?.currency,
        status: o.orderFulfillmentStatus,
        paymentStatus: o.orderPaymentStatus,
        createdDate: o.creationDate,
        paidDate: o.paymentSummary?.payments?.[0]?.paymentDate,
        lineItems: o.lineItems?.map(li => ({
          lineItemId: li.lineItemId,
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          price: li.lineItemCost?.value,
          thumbnail: li.image?.imageUrl
        })),
        shippingStep: o.fulfillmentStartInstructions?.[0]?.shippingStep
      };

      await Order.findOneAndUpdate(
        { orderId: o.orderId, user: userId },
        orderData,
        { upsert: true, returnDocument: 'after' }
      );
      syncedCount++;
    }

    console.log(`--- ORDERS SYNC COMPLETE: ${syncedCount} orders processed ---`);
    if (res) {
      return res.status(200).json({ success: true, count: syncedCount });
    }
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error('Sync Orders Error:', error.message);
    if (res) {
      return res.status(500).json({ success: false, message: error.message });
    }
    throw error;
  }
};

// @desc    Sync Inventory from eBay for Logged-In User
// @route   POST /api/ebay/sync/inventory
// @access  Private
exports.syncInventory = async (req, res) => {
  try {
    const userId = req.user.id;
    let token = await getValidToken(userId);
    if (!token) return res.status(401).json({ success: false, error: 'No valid token' });

    console.log(`--- STARTING EBAY INVENTORY SYNC FOR USER: ${userId} ---`);
    let offset = 0;
    let limit = 100;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      const data = await ebayService.getInventoryItems(token, limit, offset);
      const items = data.inventoryItems || [];
      
      if (items.length === 0) break;

      for (const item of items) {
        const tombstoneMatch = await DeletedProduct.findOne({
          user: userId,
          $or: [
            item.sku ? { sku: item.sku } : null,
            item.product?.title ? { title: item.product.title, source: 'ebay' } : null
          ].filter(Boolean)
        }).lean();

        if (tombstoneMatch) {
          console.log(`[SYNC] Skipping deleted product: ${item.sku || item.product?.title || 'unknown'}`);
          continue;
        }

        // Map eBay item to our Product model
        const product = {
          user: userId,
          title: item.product.title,
          description: item.product.description,
          sku: item.sku,
          brand: item.product.brand,
          images: item.product.imageUrls || [],
          selling_price: item.price?.value,
          source: 'ebay',
          updated_at: Date.now()
        };

        // Smart Deduplication: Match by SKU first, then by Title if SKU is missing
        const searchCriteria = item.sku 
          ? { sku: item.sku, user: userId } 
          : { title: item.product.title, source: 'ebay', user: userId };
        
        await Product.findOneAndUpdate(
          searchCriteria,
          { ...product, updated_at: Date.now() },
          { upsert: true, returnDocument: 'after' }
        );
        totalSynced++;
      }

      if (items.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`--- SYNC COMPLETE: ${totalSynced} items processed ---`);
    if (res) {
      return res.status(200).json({ success: true, count: totalSynced });
    }
    return { success: true, count: totalSynced };
  } catch (error) {
    console.error('Sync Inventory Error:', error.message);
    if (res) {
      return res.status(500).json({ success: false, message: error.message });
    }
    throw error;
  }
};

// Explicit Sync Trigger Endpoint
exports.triggerSync = async (req, res) => {
  try {
    const result = await exports.syncInventory(req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get eBay Policies for Logged-In User
// @route   GET /api/ebay/policies
// @access  Private
exports.getUserPolicies = async (req, res) => {
  try {
    const userId = req.user.id;
    const token = await getValidToken(userId);
    if (!token) return res.status(401).json({ error: 'eBay not connected' });

    const [fulfillment, payment, returns] = await Promise.allSettled([
      ebayService.getFulfillmentPolicies(token),
      ebayService.getPaymentPolicies(token),
      ebayService.getReturnPolicies(token)
    ]);

    res.json({ 
      fulfillment: fulfillment.status === 'fulfilled' ? fulfillment.value : [], 
      payment: payment.status === 'fulfilled' ? payment.value : [], 
      returns: returns.status === 'fulfilled' ? returns.value : [] 
    });
  } catch (error) {
    console.error('getUserPolicies crash:', error.message);
    res.status(500).json({ error: 'Failed to fetch policies', details: error.message });
  }
};
exports.getEbayPolicies = exports.getUserPolicies;

// @desc    Get eBay Inventory Locations
// @route   GET /api/ebay/locations
// @access  Private
exports.getInventoryLocations = async (req, res) => {
  try {
    const userId = req.user.id;
    const token = await getValidToken(userId);
    if (!token) return res.status(401).json({ error: 'eBay not connected' });

    const response = await require('axios').get('https://api.ebay.com/sell/inventory/v1/location', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    res.json(response.data.locations || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations', details: error.message });
  }
};

// @desc    Get Connection Status & Seller Name (Self Healing Support)
// @route   GET /api/ebay/status
// @access  Private
exports.getEbayStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = await getValidToken(userId);
    let sellerName = user.ebayAccount.name || user.ebayAccount.username;
    let sellerEmail = user.ebayAccount.email;
    let profileFetched = false;
    
    // Self-healing: If connected but name or email is missing, fetch it now.
    if (token && (!sellerName || sellerName === 'Unknown User' || !sellerEmail)) {
      try {
        console.log('--- SELF HEALING: FETCHING EBAY PROFILE ---');
        const profile = await ebayService.getUserProfile(token);
        console.log('--- RAW EBAY PROFILE DATA:', JSON.stringify(profile));
        if (profile) {
          const { name, email } = extractSellerProfile(profile);
          
          if (name) {
            sellerName = name;
            user.ebayAccount.name = name;
            user.ebayAccount.username = profile.username || name;
          }
          if (email) {
            sellerEmail = email;
            user.ebayAccount.email = email;
          }
          profileFetched = true;
          await user.save();
          console.log('--- SUCCESSFULLY SAVED EBAY PROFILE:', { name, email });
        }
      } catch (err) {
        console.error('Self-healing profile fetch failed:', err.message);
      }
    }
    
    const isConnected = !!token;
    
    res.json({
      connected: isConnected,
      username: user.ebayAccount.username || sellerName,
      name: sellerName || null,
      email: sellerEmail || null,
      phone: user.ebayAccount.phone || '',
      profileDataAvailable: isConnected ? Boolean(sellerName || sellerEmail) : false,
      profileFetched,
      environment: 'PRODUCTION'
    });
  } catch (error) {
    console.error('getConnectionStatus Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
};
exports.getConnectionStatus = exports.getEbayStatus;

// @desc    Get Category Conditions
// @route   GET /api/ebay/conditions
// @access  Private
exports.getCategoryConditions = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) return res.status(400).json({ error: 'CategoryID is required' });

    // Use app token to retrieve conditions
    const token = await ebayService.getAppToken(); 
    console.log(`[EBAY] Fetching conditions for CategoryID: ${categoryId} using App Token`);
    const conditions = await ebayService.getCategoryConditions(token, categoryId);
    res.json({ conditions });
  } catch (error) {
    console.error('Error in getCategoryConditions controller:', error.message);
    res.status(500).json({ error: 'Failed to fetch category conditions' });
  }
};

// @desc    Disconnect eBay (Logout)
// @route   DELETE /api/ebay/disconnect
// @access  Private
exports.disconnectEbay = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.ebayAccount = {
      connected: false,
      username: '',
      email: '',
      name: '',
      phone: '',
      accessToken: '',
      refreshToken: '',
      tokenExpires: null
    };

    await user.save();
    
    console.log(`--- EBAY ACCOUNT DISCONNECTED SUCCESSFULLY FOR USER: ${userId} ---`);
    res.json({ success: true, message: 'Disconnected from eBay' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
};
