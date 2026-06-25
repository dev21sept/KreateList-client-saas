const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { scrapeDepopShop } = require('../services/externalImportService');
const { publishToDepop } = require('../services/backendPublishService');
const { loginToDepopInteractive } = require('../services/depopLoginService');

// @desc    Connect Depop credentials manually or via extension (accessToken)
// @route   POST /api/depop/connect
// @access  Private
exports.depopConnect = async (req, res) => {
  try {
    const { username, accessToken, disconnect } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (disconnect) {
      user.depopAccount = {
        connected: false,
        username: '',
        accessToken: '',
        connectedAt: null
      };
      // Clean up local product drafts imported from Depop
      await Product.deleteMany({ user: req.user.id, source: 'depop' });
      await Listing.deleteMany({ user: req.user.id, platform: 'depop', depopListingId: { $exists: true, $ne: '' } });
      await user.save();
      return res.status(200).json({
        success: true,
        message: 'Depop account disconnected successfully.',
        data: user.depopAccount
      });
    }

    if (!username || !accessToken) {
      return res.status(400).json({ success: false, message: 'username and accessToken are required.' });
    }

    user.depopAccount = {
      connected: true,
      username: username.trim(),
      accessToken: accessToken.trim(),
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Depop account connected successfully!',
      data: user.depopAccount
    });
  } catch (err) {
    console.error(`[Depop Controller] Connect error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Connect Depop credentials using interactive login page
// @route   POST /api/depop/connect-interactive
// @access  Private
exports.depopConnectInteractive = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`[Depop Controller] Starting interactive connection for user: ${req.user.id}`);
    const loginResult = await loginToDepopInteractive();

    if (!loginResult.success) {
      return res.status(400).json({
        success: false,
        message: loginResult.message || 'Interactive login failed.'
      });
    }

    user.depopAccount = {
      connected: true,
      username: loginResult.username,
      accessToken: loginResult.accessToken,
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Depop account connected successfully via Interactive Login!',
      data: user.depopAccount
    });
  } catch (err) {
    console.error(`[Depop Controller] Connect interactive error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Import external inventory from Depop shop
// @route   POST /api/depop/import
// @access  Private
exports.depopImportCloset = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide Depop username' 
      });
    }

    const cleanUsername = username.trim();
    console.log(`[Depop Controller] Starting shop import for: ${cleanUsername}, UserID: ${req.user.id}`);
    
    const scrapedListings = await scrapeDepopShop(cleanUsername);

    let importCount = 0;
    let duplicateCount = 0;
    const importedItems = [];

    for (const item of scrapedListings) {
      // Check for duplicate in DB for this user in Product collection
      const duplicateQuery = { 
        user: req.user.id, 
        source: 'depop',
        $or: [
          { depopListingId: item.depopListingId },
          { depopUrl: item.depopUrl },
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
        source: 'depop',
        status: 'live',
        depopListingId: item.depopListingId,
        depopUrl: item.depopUrl,
        updated_at: Date.now()
      };

      const newProduct = await Product.create(productPayload);
      importedItems.push(newProduct);
      importCount++;
    }

    res.status(200).json({
      success: true,
      message: `Depop closet import completed for ${cleanUsername}`,
      data: {
        totalFound: scrapedListings.length,
        importedCount: importCount,
        skippedDuplicates: duplicateCount,
        listings: importedItems
      }
    });

  } catch (err) {
    console.error(`[Depop Controller] Error importing shop:`, err.message);
    res.status(500).json({ 
      success: false, 
      message: `Failed to import Depop shop: ${err.message}` 
    });
  }
};

// @desc    Publish draft listing directly to Depop using Direct APIs
// @route   POST /api/depop/publish/:id
// @access  Private
exports.depopPublish = async (req, res) => {
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

    if (!user.depopAccount?.connected || !user.depopAccount?.accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Your Depop account is not connected on the server. Please connect your Depop account first.'
      });
    }

    console.log(`[Depop Controller] Direct publishing listing: ${listingId} to Depop`);
    const publishResult = await publishToDepop(listing, user.depopAccount);

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.errorMessage = null;
    listing.depopListingId = publishResult.id;
    listing.depopUrl = publishResult.url;

    await listing.save();
    console.log(`[Depop Controller] Direct publishing successful! URL: ${publishResult.url}`);

    res.status(200).json({
      success: true,
      message: 'Listing successfully published to Depop!',
      data: listing
    });
  } catch (err) {
    console.error(`[Depop Controller] Direct publishing error:`, err.message);
    
    // Save error on listing
    try {
      const listing = await Listing.findById(req.params.id);
      if (listing) {
        listing.errorMessage = err.message;
        listing.status = 'failed';
        await listing.save();
      }
    } catch (dbErr) {
      console.error('[Depop Controller] Failed to update error status on listing:', dbErr.message);
    }

    res.status(500).json({
      success: false,
      message: `Publish failed: ${err.message}`
    });
  }
};

// @desc    Get live channel inventory (scraped on the fly)
// @route   GET /api/depop/live
// @access  Private
exports.depopGetLive = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (!user.depopAccount?.connected || !user.depopAccount?.username) {
      return res.status(400).json({ success: false, message: 'Depop account is not connected.' });
    }
    
    const username = user.depopAccount.username;
    console.log(`[Depop Controller] Fetching live inventory for Depop (${username})`);
    
    const liveListings = await scrapeDepopShop(username);
    
    res.status(200).json({
      success: true,
      data: liveListings
    });
  } catch (err) {
    console.error(`[Depop Controller] Error getting live inventory:`, err.message);
    res.status(200).json({ success: false, message: err.message, data: [] });
  }
};
