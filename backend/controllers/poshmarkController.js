const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { scrapePoshmarkCloset } = require('../services/externalImportService');
const { publishToPoshmark } = require('../services/backendPublishService');
const { loginToPoshmark, verify2FA } = require('../services/poshmarkLoginService');

// @desc    Connect Poshmark credentials manually or via extension (cookies / token)
// @route   POST /api/poshmark/connect
// @access  Private
exports.poshmarkConnect = async (req, res) => {
  try {
    const { username, sessionCookie, csrfToken, disconnect } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (disconnect) {
      user.poshmarkAccount = {
        connected: false,
        username: '',
        sessionCookie: '',
        csrfToken: '',
        connectedAt: null
      };
      // Clean up local product drafts imported from Poshmark
      await Product.deleteMany({ user: req.user.id, source: 'poshmark' });
      await Listing.deleteMany({ user: req.user.id, platform: 'poshmark', poshmarkListingId: { $exists: true, $ne: '' } });
      await user.save();
      return res.status(200).json({
        success: true,
        message: 'Poshmark account disconnected successfully.',
        data: user.poshmarkAccount
      });
    }

    if (!username || !sessionCookie || !csrfToken) {
      return res.status(400).json({ success: false, message: 'username, sessionCookie, and csrfToken are required.' });
    }

    user.poshmarkAccount = {
      connected: true,
      username: username.trim(),
      sessionCookie: sessionCookie.trim(),
      csrfToken: csrfToken.trim(),
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Poshmark account connected successfully!',
      data: user.poshmarkAccount
    });
  } catch (err) {
    console.error(`[Poshmark Controller] Connect error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Connect Poshmark credentials via direct password login
// @route   POST /api/poshmark/connect-password
// @access  Private
exports.poshmarkConnectPassword = async (req, res) => {
  try {
    const { username, password, domain } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loginResult = await loginToPoshmark(username, password, domain || 'poshmark.com');
    
    if (loginResult['2faRequired']) {
      return res.status(200).json({
        success: true,
        '2faRequired': true,
        sessionId: loginResult.sessionId,
        message: loginResult.message
      });
    }

    if (!loginResult.success) {
      return res.status(400).json({
        success: false,
        message: loginResult.message || 'Direct login failed.'
      });
    }

    user.poshmarkAccount = {
      connected: true,
      username: loginResult.username,
      sessionCookie: loginResult.sessionCookie,
      csrfToken: loginResult.csrfToken,
      connectedAt: new Date()
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Poshmark account connected successfully via Cloud Login!',
      data: user.poshmarkAccount
    });
  } catch (err) {
    console.error(`[Poshmark Controller] Connect password error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify Poshmark 2FA code
// @route   POST /api/poshmark/verify-2fa
// @access  Private
exports.poshmarkVerify2FA = async (req, res) => {
  try {
    const { sessionId, code } = req.body;

    if (!sessionId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and verification code are required.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const verifyResult = await verify2FA(sessionId, code);

    user.poshmarkAccount = {
      connected: true,
      username: verifyResult.username,
      sessionCookie: verifyResult.sessionCookie,
      csrfToken: verifyResult.csrfToken,
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Poshmark account connected successfully via 2FA!',
      data: user.poshmarkAccount
    });
  } catch (err) {
    console.error(`[Poshmark Controller] Verify 2FA error:`, err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Import external inventory from Poshmark closet
// @route   POST /api/poshmark/import
// @access  Private
exports.poshmarkImportCloset = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide Poshmark username' 
      });
    }

    const cleanUsername = username.trim();
    console.log(`[Poshmark Controller] Starting closet import for: ${cleanUsername}, UserID: ${req.user.id}`);
    
    const user = await User.findById(req.user.id);
    const poshAccount = user?.poshmarkAccount || {};
    const scrapedListings = await scrapePoshmarkCloset(cleanUsername, poshAccount);

    if (user && user.poshmarkAccount && poshAccount.username && user.poshmarkAccount.username !== poshAccount.username) {
      user.poshmarkAccount.username = poshAccount.username;
      user.markModified('poshmarkAccount');
      await user.save();
      console.log(`[Poshmark Controller] Saved resolved username (${poshAccount.username}) to DB`);
    }

    let importCount = 0;
    let duplicateCount = 0;
    const importedItems = [];

    for (const item of scrapedListings) {
      // Check for duplicate in DB for this user in Product collection
      const duplicateQuery = { 
        user: req.user.id, 
        source: 'poshmark',
        $or: [
          { poshmarkListingId: item.poshmarkListingId },
          { poshmarkUrl: item.poshmarkUrl },
          { sku: item.sku }
        ]
      };

      const existingProduct = await Product.findOne(duplicateQuery);

      if (existingProduct) {
        duplicateCount++;
        continue;
      }

      // Prepare Product payload
      const productPayload = {
        user: req.user.id,
        title: item.title,
        description: item.description,
        selling_price: parseFloat(item.price) || 0,
        sku: item.sku,
        brand: item.brand || '',
        images: item.images,
        source: 'poshmark',
        status: 'live',
        poshmarkListingId: item.poshmarkListingId,
        poshmarkUrl: item.poshmarkUrl,
        updated_at: Date.now()
      };

      const newProduct = await Product.create(productPayload);
      importedItems.push(newProduct);
      importCount++;
    }

    res.status(200).json({
      success: true,
      message: `Poshmark closet import completed for ${cleanUsername}`,
      data: {
        totalFound: scrapedListings.length,
        importedCount: importCount,
        skippedDuplicates: duplicateCount,
        listings: importedItems
      }
    });

  } catch (err) {
    console.error(`[Poshmark Controller] Error importing closet:`, err.message);
    res.status(500).json({ 
      success: false, 
      message: `Failed to import Poshmark closet: ${err.message}` 
    });
  }
};

// @desc    Publish draft listing directly to Poshmark using Direct APIs
// @route   POST /api/poshmark/publish/:id
// @access  Private
exports.poshmarkPublish = async (req, res) => {
  try {
    const listingId = req.params.id;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to publish this listing' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.poshmarkAccount?.connected || !user.poshmarkAccount?.sessionCookie) {
      return res.status(400).json({
        success: false,
        message: 'Your Poshmark account is not connected on the server. Please connect your Poshmark account first.'
      });
    }

    console.log(`[Poshmark Controller] Direct publishing listing: ${listingId} to Poshmark`);
    const publishResult = await publishToPoshmark(listing, user.poshmarkAccount);

    // Save updated credentials if session cookie was established/updated
    if (user.isModified('poshmarkAccount')) {
      await user.save();
      console.log(`[Poshmark Controller] Updated poshmarkAccount in database with dynamically established session cookie`);
    }

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.errorMessage = null;
    listing.poshmarkListingId = publishResult.id;
    listing.poshmarkUrl = publishResult.url;

    await listing.save();
    console.log(`[Poshmark Controller] Direct publishing successful! URL: ${publishResult.url}`);

    res.status(200).json({
      success: true,
      message: 'Listing successfully published to Poshmark!',
      data: listing
    });
  } catch (err) {
    console.error(`[Poshmark Controller] Direct publishing error:`, err.message);
    
    // Save error on listing
    try {
      const listing = await Listing.findById(req.params.id);
      if (listing) {
        listing.errorMessage = err.message;
        listing.status = 'failed';
        await listing.save();
      }
    } catch (dbErr) {
      console.error('[Poshmark Controller] Failed to update error status on listing:', dbErr.message);
    }

    res.status(500).json({
      success: false,
      message: `Publish failed: ${err.message}`
    });
  }
};

// @desc    Get live channel inventory (scraped on the fly)
// @route   GET /api/poshmark/live
// @access  Private
exports.poshmarkGetLive = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (!user.poshmarkAccount?.connected || !user.poshmarkAccount?.username) {
      return res.status(400).json({ success: false, message: 'Poshmark account is not connected.' });
    }
    
    const poshAccount = user.poshmarkAccount || {};
    const username = poshAccount.username;
    console.log(`[Poshmark Controller] Fetching live inventory for Poshmark (${username})`);
    
    const liveListings = await scrapePoshmarkCloset(username, poshAccount);

    if (poshAccount.username && user.poshmarkAccount.username !== poshAccount.username) {
      user.poshmarkAccount.username = poshAccount.username;
      user.markModified('poshmarkAccount');
      await user.save();
      console.log(`[Poshmark Controller] Saved resolved username (${poshAccount.username}) to DB in getLive`);
    }
    
    res.status(200).json({
      success: true,
      data: liveListings
    });
  } catch (err) {
    console.error(`[Poshmark Controller] Error getting live inventory:`, err.message);
    res.status(200).json({ success: false, message: err.message, data: [] });
  }
};
