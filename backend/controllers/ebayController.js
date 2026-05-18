const ebayService = require('../services/ebayService');
const User = require('../models/User');

// @desc    Get eBay Auth URL
// @route   GET /api/ebay/auth
// @access  Private
exports.getEbayAuthUrl = async (req, res) => {
  try {
    const url = ebayService.getAuthUrl(req.user.id);
    res.status(200).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Callback from eBay OAuth (Direct redirect from eBay)
// @route   GET /api/ebay/callback
// @access  Public (eBay hits this directly)
exports.ebayCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || 'https://kreate-list-client-saas.vercel.app').trim().replace(/\/$/, '');
  
  if (error) {
    console.error('eBay Auth Error:', error, error_description);
    return res.redirect(`${frontendUrl}/ebay-accounts?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    console.error('No code provided in request query');
    return res.redirect(`${frontendUrl}/ebay-accounts?error=No+authentication+code+provided`);
  }

  if (!state) {
    console.error('No state (userId) provided in request query');
    return res.redirect(`${frontendUrl}/ebay-accounts?error=Missing+user+identifier`);
  }

  try {
    console.log('Exchanging eBay code for token for user:', state);
    const tokenData = await ebayService.exchangeCodeForToken(code);
    
    if (!tokenData || !tokenData.access_token) {
      throw new Error('Failed to obtain access token from eBay');
    }

    // state contains the userId
    const user = await User.findById(state);
    if (!user) {
      throw new Error('User not found during eBay callback');
    }

    user.ebayAccount.connected = true;
    user.ebayAccount.accessToken = tokenData.access_token;
    user.ebayAccount.refreshToken = tokenData.refresh_token;
    user.ebayAccount.tokenExpires = new Date(Date.now() + tokenData.expires_in * 1000);
    
    console.log('Fetching eBay user details...');
    const ebayUser = await ebayService.getEbayUserDetails(tokenData.access_token);
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

    // Redirect back to frontend on success
    res.redirect(`${frontendUrl}/ebay-accounts?success=true`);
  } catch (err) {
    console.error('eBay Callback Process Error:', err.message);
    if (err.response?.data) {
      console.error('eBay API Error Details:', JSON.stringify(err.response.data));
    }
    const errorMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
    res.redirect(`${frontendUrl}/ebay-accounts?error=${encodeURIComponent('Authentication failed: ' + errorMsg)}`);
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
