const ebayService = require('../services/ebayService');
const User = require('../models/User');

// @desc    Get eBay Auth URL
// @route   GET /api/ebay/auth
// @access  Private
exports.getEbayAuthUrl = async (req, res) => {
  try {
    const url = ebayService.getAuthUrl();
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
      return res.status(400).json({ success: false, message: 'No code provided' });
    }

    const tokenData = await ebayService.exchangeCodeForToken(code);
    
    // Update user with eBay tokens
    const user = await User.findById(req.user.id);
    user.ebayAccount.connected = true;
    user.ebayAccount.accessToken = tokenData.access_token;
    user.ebayAccount.refreshToken = tokenData.refresh_token;
    user.ebayAccount.tokenExpires = new Date(Date.now() + tokenData.expires_in * 1000);
    
    // Fetch eBay username/details
    const ebayUser = await ebayService.getEbayUserDetails(tokenData.access_token);
    if (ebayUser) {
      user.ebayAccount.username = ebayUser.username;
      const account = ebayUser.individualAccount || ebayUser.businessAccount;
      if (account) {
        user.ebayAccount.email = account.email;
        user.ebayAccount.name = account.registrationAddress?.fullName;
        user.ebayAccount.phone = account.primaryPhone?.phoneNumber;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'eBay account connected successfully',
      data: user.ebayAccount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      const tokenData = await ebayService.refreshToken(user.ebayAccount.refreshToken);
      token = tokenData.access_token;
      user.ebayAccount.accessToken = token;
      user.ebayAccount.tokenExpires = new Date(Date.now() + tokenData.expires_in * 1000);
      if (tokenData.refresh_token) {
        user.ebayAccount.refreshToken = tokenData.refresh_token;
      }
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
