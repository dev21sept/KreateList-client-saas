const ebayService = require('../services/ebayService');
const User = require('../models/User');

// @desc    Get eBay Auth URL
// @route   GET /api/ebay/auth
// @access  Private
exports.getEbayAuthUrl = async (req, res) => {
  try {
    const url = ebayService.getUserConsentUrl(process.env.EBAY_RU_NAME, 'dashboard');
    res.status(200).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Callback from eBay OAuth
// @route   POST /api/ebay/callback
// @access  Private
exports.ebayCallback = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      console.error('eBay Callback Error: No code provided in request body');
      return res.status(400).json({ success: false, message: 'No code provided' });
    }

    console.log('Exchanging eBay code for token...');
    const tokenData = await ebayService.getUserToken(code, process.env.EBAY_RU_NAME);
    
    if (!tokenData || !tokenData.access_token) {
      throw new Error('Failed to obtain access token from eBay');
    }

    // Update user with eBay tokens
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new Error('User not found during eBay callback');
    }

    user.ebayAccount.connected = true;
    user.ebayAccount.accessToken = tokenData.access_token;
    user.ebayAccount.refreshToken = tokenData.refresh_token;
    user.ebayAccount.tokenExpires = new Date(Date.now() + tokenData.expires_in * 1000);
    
    console.log('Fetching eBay user details...');
    // Fetch eBay username/details
    const ebayUser = await ebayService.getUserProfile(tokenData.access_token);
    if (ebayUser) {
      console.log('eBay user details fetched for:', ebayUser.username);
      user.ebayAccount.username = ebayUser.username;
      const account = ebayUser.individualAccount || ebayUser.businessAccount;
      if (account) {
        user.ebayAccount.email = account.email;
        user.ebayAccount.name = account.registrationAddress?.fullName || ebayUser.username;
        user.ebayAccount.phone = account.primaryPhone?.phoneNumber || '';
      }
    }

    await user.save();
    console.log('eBay account successfully linked to user:', user.email);

    res.status(200).json({
      success: true,
      message: 'eBay account connected successfully',
      data: user.ebayAccount
    });
  } catch (err) {
    console.error('eBay Callback Process Error:', err.message);
    if (err.response?.data) {
      console.error('eBay API Error Details:', JSON.stringify(err.response.data));
    }
    res.status(500).json({ 
      success: false, 
      message: err.message,
      details: err.response?.data || null
    });
  }
};

// @desc    Get eBay Connection Status
// @route   GET /api/ebay/status
// @access  Private
exports.getEbayStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user.ebayAccount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Disconnect eBay Account
// @route   DELETE /api/ebay/disconnect
// @access  Private
exports.disconnectEbay = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    res.status(200).json({ success: true, message: 'eBay account disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// @desc    Get eBay Policies (Fulfillment, Payment, Return, Locations)
// @route   GET /api/ebay/policies
// @access  Private
exports.getEbayPolicies = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.ebayAccount || !user.ebayAccount.connected) {
      return res.status(400).json({ success: false, message: 'eBay account not connected' });
    }

    // Check if token is expired and refresh if necessary
    let token = user.ebayAccount.accessToken;
    if (new Date() > user.ebayAccount.tokenExpires) {
      const newAccessToken = await ebayService.refreshUserToken(user.ebayAccount.refreshToken);
      token = newAccessToken;
      user.ebayAccount.accessToken = token;
      user.ebayAccount.tokenExpires = new Date(Date.now() + 7200 * 1000); // 2 hours
      await user.save();
    }

    const [fulfillment, payment, returns, locations] = await Promise.all([
      ebayService.getFulfillmentPolicies(token),
      ebayService.getPaymentPolicies(token),
      ebayService.getReturnPolicies(token),
      ebayService.getLocations(token)
    ]);

    res.status(200).json({
      success: true,
      data: {
        fulfillment,
        payment,
        returns,
        locations
      }
    });
  } catch (err) {
    console.error('Error fetching eBay policies:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
