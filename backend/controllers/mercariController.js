const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { scrapeMercariCloset, publishToMercari } = require('../services/mercariService');
const { loginToMercari, verifyMercari2FA } = require('../services/mercariLoginService');

// @desc    Connect Mercari credentials manually (cookies / token) or disconnect
// @route   POST /api/mercari/connect
// @access  Private
exports.mercariConnect = async (req, res) => {
  try {
    const { username, sessionCookie, disconnect } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (disconnect) {
      user.mercariAccount = {
        connected: false,
        username: '',
        userId: '',
        accessToken: '',
        sessionCookie: '',
        connectedAt: null
      };
      // Clean up local product drafts imported from Mercari
      await Product.deleteMany({ user: req.user.id, source: 'mercari' });
      await Listing.deleteMany({ user: req.user.id, platform: 'mercari', mercariListingId: { $exists: true, $ne: '' } });
      await user.save();
      return res.status(200).json({
        success: true,
        message: 'Mercari account disconnected successfully.',
        data: user.mercariAccount
      });
    }

    if (!username || !sessionCookie) {
      return res.status(400).json({ success: false, message: 'username and sessionCookie are required.' });
    }

    user.mercariAccount = {
      connected: true,
      username: username.trim(),
      sessionCookie: sessionCookie.trim(),
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mercari account connected successfully!',
      data: user.mercariAccount
    });
  } catch (err) {
    console.error(`[Mercari Controller] Connect error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Connect Mercari credentials via direct password login
// @route   POST /api/mercari/connect-password
// @access  Private
exports.mercariConnectPassword = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loginResult = await loginToMercari(username, password);
    
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

    user.mercariAccount = {
      connected: true,
      username: loginResult.username,
      sessionCookie: loginResult.sessionCookie,
      accessToken: loginResult.accessToken,
      connectedAt: new Date()
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Mercari account connected successfully via Cloud Login!',
      data: user.mercariAccount
    });
  } catch (err) {
    console.error(`[Mercari Controller] Connect password error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify Mercari 2FA code
// @route   POST /api/mercari/verify-2fa
// @access  Private
exports.mercariVerify2FA = async (req, res) => {
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

    const verifyResult = await verifyMercari2FA(sessionId, code);

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message || 'Verification failed.'
      });
    }

    user.mercariAccount = {
      connected: true,
      username: verifyResult.username,
      sessionCookie: verifyResult.sessionCookie,
      accessToken: verifyResult.accessToken,
      connectedAt: new Date()
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mercari account connected successfully via 2FA!',
      data: user.mercariAccount
    });
  } catch (err) {
    console.error(`[Mercari Controller] Verify 2FA error:`, err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Import external inventory from Mercari
// @route   POST /api/mercari/import
// @access  Private
exports.mercariImportCloset = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide Mercari username/id' 
      });
    }

    const cleanUsername = username.trim();
    console.log(`[Mercari Controller] Starting listings import for: ${cleanUsername}, UserID: ${req.user.id}`);
    
    const user = await User.findById(req.user.id);
    const mercariAccount = user?.mercariAccount || {};
    const scrapedListings = await scrapeMercariCloset(cleanUsername, mercariAccount);

    let importCount = 0;
    let duplicateCount = 0;
    const importedItems = [];

    for (const item of scrapedListings) {
      let existingProduct = await Product.findOne({ 
        user: req.user.id, 
        source: 'mercari',
        $or: [
          { mercariListingId: item.mercariListingId },
          { mercariUrl: item.mercariUrl }
        ]
      });

      if (existingProduct) {
        if (!existingProduct.mercariListingId || !existingProduct.mercariUrl) {
          existingProduct.mercariListingId = item.mercariListingId;
          existingProduct.mercariUrl = item.mercariUrl;
          existingProduct.updated_at = Date.now();
          await existingProduct.save();
        }
        duplicateCount++;
        continue;
      }

      const productPayload = {
        user: req.user.id,
        title: item.title,
        description: item.title, // Mercari thumbnail listing page doesn't have full description, use title
        selling_price: parseFloat(item.price) || 0,
        sku: `M-${item.mercariListingId}`,
        brand: '',
        size: '',
        images: item.images,
        source: 'mercari',
        status: 'live',
        mercariListingId: item.mercariListingId,
        mercariUrl: item.mercariUrl,
        updated_at: Date.now()
      };

      const newProduct = await Product.create(productPayload);
      importedItems.push(newProduct);
      importCount++;
    }

    res.status(200).json({
      success: true,
      message: `Mercari listings import completed for ${cleanUsername}`,
      data: {
        totalFound: scrapedListings.length,
        importedCount: importCount,
        skippedDuplicates: duplicateCount,
        listings: importedItems
      }
    });

  } catch (err) {
    console.error(`[Mercari Controller] Error importing listings:`, err.message);
    res.status(500).json({ 
      success: false, 
      message: `Failed to import Mercari listings: ${err.message}` 
    });
  }
};

// @desc    Publish draft listing directly to Mercari using Direct APIs / Puppeteer
// @route   POST /api/mercari/publish/:id
// @access  Private
exports.mercariPublish = async (req, res) => {
  try {
    const listingId = req.params.id;

    let listing = await Listing.findById(listingId);
    if (!listing) {
      const prod = await Product.findById(listingId);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
        if (!listing) {
          listing = new Listing({
            user: req.user.id,
            title: prod.title,
            description: prod.description || prod.title,
            sku: prod.sku || '',
            brand: prod.brand || '',
            size: prod.size || '',
            color: prod.color || '',
            category: 'Clothing',
            categoryId: prod.categoryId || '',
            itemSpecifics: prod.itemSpecifics || {},
            price: prod.selling_price || 0,
            images: prod.images || [],
            status: 'draft'
          });
          listing.mercariListingId = prod.mercariListingId;
          listing.mercariUrl = prod.mercariUrl;
          listing.mercariStatus = prod.status === 'active' ? 'published' : 'delisted';
          await listing.save();
        }
      }
    }

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

    if (!user.mercariAccount?.connected || !user.mercariAccount?.sessionCookie) {
      return res.status(400).json({
        success: false,
        message: 'Your Mercari account is not connected on the server. Please connect your Mercari account first.'
      });
    }

    const existingListingId = listing.mercariListingId;
    const publishResult = await publishToMercari(listing, user.mercariAccount);

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.mercariStatus = 'published';
    listing.errorMessage = null;
    listing.mercariListingId = publishResult.id;
    listing.mercariUrl = publishResult.url;

    await listing.save();

    // Automatically update matched Product model cache
    try {
      await Product.findOneAndUpdate(
        { user: listing.user, sku: listing.sku, source: 'mercari' },
        { status: 'active', mercariListingId: publishResult.id, mercariUrl: publishResult.url, updated_at: Date.now() }
      );
    } catch (cacheErr) {
      console.warn(`[Mercari Controller] Failed to update matched Product cache:`, cacheErr.message);
    }

    res.status(200).json({
      success: true,
      message: existingListingId ? 'Listing successfully updated on Mercari!' : 'Listing successfully published to Mercari!',
      data: listing
    });
  } catch (err) {
    console.error(`[Mercari Controller] Direct publishing error:`, err.message);
    
    // Save error on listing
    try {
      const listing = await Listing.findById(req.params.id);
      if (listing) {
        listing.errorMessage = err.message;
        listing.status = 'failed';
        listing.mercariStatus = 'failed';
        await listing.save();
      }
    } catch (dbErr) {
      console.error('[Mercari Controller] Failed to update error status on listing:', dbErr.message);
    }

    res.status(500).json({
      success: false,
      message: `Publish failed: ${err.message}`
    });
  }
};

// @desc    Get live channel inventory
// @route   GET /api/mercari/live
// @access  Private
exports.mercariGetLive = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (!user.mercariAccount?.connected || !user.mercariAccount?.username) {
      return res.status(400).json({ success: false, message: 'Mercari account is not connected.' });
    }
    
    const mercariAccount = user.mercariAccount || {};
    const username = mercariAccount.username;
    
    const liveListings = await scrapeMercariCloset(username, mercariAccount);

    const savedProducts = [];
    for (const item of liveListings) {
      let existingProduct = await Product.findOne({ 
        user: req.user.id, 
        source: 'mercari',
        $or: [
          { mercariListingId: item.mercariListingId },
          { mercariUrl: item.mercariUrl }
        ]
      });

      if (existingProduct) {
        existingProduct.title = item.title;
        existingProduct.selling_price = parseFloat(item.price) || 0;
        existingProduct.images = item.images;
        existingProduct.status = 'live';
        existingProduct.updated_at = Date.now();
        await existingProduct.save();
        savedProducts.push(existingProduct);
      } else {
        const productPayload = {
          user: req.user.id,
          title: item.title,
          description: item.title,
          selling_price: parseFloat(item.price) || 0,
          sku: `M-${item.mercariListingId}`,
          brand: '',
          size: '',
          images: item.images,
          source: 'mercari',
          status: 'live',
          mercariListingId: item.mercariListingId,
          mercariUrl: item.mercariUrl,
          updated_at: Date.now()
        };
        const newProduct = await Product.create(productPayload);
        savedProducts.push(newProduct);
      }
    }
    
    res.status(200).json({
      success: true,
      data: savedProducts
    });
  } catch (err) {
    console.error(`[Mercari Controller] Error getting live inventory:`, err.message);
    res.status(200).json({ success: false, message: err.message, data: [] });
  }
};
