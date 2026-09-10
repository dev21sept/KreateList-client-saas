const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { 
  scrapeMercariCloset, 
  publishToMercari, 
  deactivateMercariListing, 
  reactivateMercariListing, 
  deleteFromMercari, 
  verifyMercariListingStatus,
  getMercariProfile,
  fetchMercariItemDetails
} = require('../services/mercariService');
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

    let finalUsername = username.trim();
    let finalUserId = '';

    if (finalUsername === 'Mercari User' || !finalUsername) {
      console.log('[Mercari Controller] Fetching real username from Mercari sessionCookie...');
      const profile = await getMercariProfile(sessionCookie.trim());
      if (profile.success && profile.username && profile.username !== 'Mercari User') {
        finalUsername = profile.username;
        finalUserId = profile.userId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to retrieve your Mercari username. Please ensure you are logged in correctly on Mercari.'
        });
      }
    }

    user.mercariAccount = {
      connected: true,
      username: finalUsername,
      userId: finalUserId,
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

    const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    let finalUsername = loginResult.username;
    let finalUserId = '';
    
    // Only call fallback scraper if username is empty, 'Mercari User', or an email
    if (!finalUsername || finalUsername === 'Mercari User' || isEmail(finalUsername)) {
      console.log('[Mercari Connect Password] Fetching real username from sessionCookie...');
      const profile = await getMercariProfile(loginResult.sessionCookie);
      if (profile.success && profile.username && profile.username !== 'Mercari User' && !isEmail(profile.username)) {
        finalUsername = profile.username;
        finalUserId = profile.userId;
      } else {
        // Fallback to email prefix if scraper failed
        if (isEmail(finalUsername)) {
          finalUsername = finalUsername.split('@')[0];
        }
      }
    }

    user.mercariAccount = {
      connected: true,
      username: finalUsername,
      userId: finalUserId,
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

    const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    let finalUsername = verifyResult.username;
    let finalUserId = '';

    // Only call fallback scraper if username is empty, 'Mercari User', or an email
    if (!finalUsername || finalUsername === 'Mercari User' || isEmail(finalUsername)) {
      console.log('[Mercari Verify 2FA] Fetching real username from sessionCookie...');
      const profile = await getMercariProfile(verifyResult.sessionCookie);
      if (profile.success && profile.username && profile.username !== 'Mercari User' && !isEmail(profile.username)) {
        finalUsername = profile.username;
        finalUserId = profile.userId;
      } else {
        // Fallback to email prefix if scraper failed
        if (isEmail(finalUsername)) {
          finalUsername = finalUsername.split('@')[0];
        }
      }
    }

    user.mercariAccount = {
      connected: true,
      username: finalUsername,
      userId: finalUserId,
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

// @desc    Import external inventory from Mercari (Active, Inactive, and Drafts)
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
    console.log(`[Mercari Controller] Starting complete listings import for: ${cleanUsername}, UserID: ${req.user.id}`);
    
    const user = await User.findById(req.user.id);
    const mercariAccount = user?.mercariAccount || {};
    const scrapedListings = await scrapeMercariCloset(cleanUsername, mercariAccount);

    let importCount = 0;
    let duplicateCount = 0;
    const importedProducts = [];

    for (const item of scrapedListings) {
      const isItemActive = item.status === 'active';
      const productStatus = isItemActive ? 'active' : 'inactive';
      const listingStatus = isItemActive ? 'published' : 'draft';
      const mercariStatus = isItemActive ? 'published' : 'delisted';

      // 1. Upsert into Product model
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
        existingProduct.selling_price = parseFloat(item.price) || existingProduct.selling_price || 0;
        if (item.images && item.images.length > 0) existingProduct.images = item.images;
        existingProduct.status = productStatus;
        existingProduct.mercariListingId = item.mercariListingId;
        existingProduct.mercariUrl = item.mercariUrl;
        existingProduct.updated_at = Date.now();
        await existingProduct.save();
        duplicateCount++;
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
          status: productStatus,
          mercariListingId: item.mercariListingId,
          mercariUrl: item.mercariUrl,
          updated_at: Date.now()
        };
        const newProduct = await Product.create(productPayload);
        importedProducts.push(newProduct);
        importCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Mercari listings import completed for ${cleanUsername}. Scraped ${scrapedListings.length} total items.`,
      data: {
        totalFound: scrapedListings.length,
        importedCount: importCount,
        skippedDuplicates: duplicateCount,
        listings: importedProducts
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

// @desc    Publish or update draft listing directly on Mercari
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

// @desc    Delist / Deactivate listing from Mercari
// @route   POST /api/mercari/delist/:id
// @access  Private
exports.mercariDelist = async (req, res) => {
  try {
    const listingId = req.params.id;
    const user = await User.findById(req.user.id);
    if (!user || !user.mercariAccount?.connected) {
      return res.status(400).json({ success: false, message: 'Mercari account not connected.' });
    }

    let listing = await Listing.findById(listingId);
    let prod = null;
    if (!listing) {
      prod = await Product.findById(listingId);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
      }
    }

    const activeId = listing?.mercariListingId || prod?.mercariListingId;
    if (!activeId) {
      return res.status(400).json({ success: false, message: 'No Mercari listing ID found for this item.' });
    }

    await deactivateMercariListing(activeId, user.mercariAccount);

    if (listing) {
      listing.mercariStatus = 'delisted';
      if (listing.ebayStatus !== 'published' && listing.poshmarkStatus !== 'published' && listing.etsyStatus !== 'published' && listing.depopStatus !== 'published') {
        listing.status = 'delisted';
      }
      await listing.save();
    }

    await Product.findOneAndUpdate(
      { user: req.user.id, $or: [{ mercariListingId: activeId }, { _id: listingId }] },
      { status: 'inactive', updated_at: Date.now() }
    );

    res.status(200).json({ success: true, message: 'Listing successfully deactivated on Mercari!' });
  } catch (err) {
    console.error(`[Mercari Controller] Delist error:`, err.message);
    res.status(500).json({ success: false, message: `Failed to delist from Mercari: ${err.message}` });
  }
};

// @desc    Delete listing from Mercari
// @route   POST /api/mercari/delete/:id
// @access  Private
exports.mercariDelete = async (req, res) => {
  try {
    const listingId = req.params.id;
    const user = await User.findById(req.user.id);
    if (!user || !user.mercariAccount?.connected) {
      return res.status(400).json({ success: false, message: 'Mercari account not connected.' });
    }

    let listing = await Listing.findById(listingId);
    let prod = null;
    if (!listing) {
      prod = await Product.findById(listingId);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
      }
    }

    const activeId = listing?.mercariListingId || prod?.mercariListingId;
    if (activeId) {
      try {
        await deleteFromMercari(activeId, user.mercariAccount);
      } catch (delErr) {
        console.warn(`[Mercari Controller] Delete attempt failed on Mercari web:`, delErr.message);
      }
    }

    if (listing) {
      listing.mercariListingId = undefined;
      listing.mercariUrl = undefined;
      listing.mercariStatus = 'none';
      if (listing.ebayStatus !== 'published' && listing.poshmarkStatus !== 'published' && listing.etsyStatus !== 'published' && listing.depopStatus !== 'published') {
        listing.status = 'draft';
      }
      await listing.save();
    }

    await Product.findOneAndDelete({
      user: req.user.id,
      $or: [{ mercariListingId: activeId }, { _id: listingId }]
    });

    res.status(200).json({ success: true, message: 'Listing successfully deleted from Mercari!' });
  } catch (err) {
    console.error(`[Mercari Controller] Delete error:`, err.message);
    res.status(500).json({ success: false, message: `Failed to delete from Mercari: ${err.message}` });
  }
};

// @desc    Verify live status of a listing on Mercari
// @route   POST /api/mercari/verify-status/:id
// @access  Private
exports.mercariVerifyStatus = async (req, res) => {
  try {
    const itemId = req.params.id;
    const user = await User.findById(req.user.id);
    if (!user || !user.mercariAccount?.connected) {
      return res.status(400).json({ success: false, message: 'Mercari account not connected.' });
    }

    let listing = null;
    let product = null;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(itemId);
    if (isValidObjectId) {
      listing = await Listing.findById(itemId);
      if (!listing) {
        product = await Product.findById(itemId);
        if (product && product.user.toString() === req.user.id) {
          listing = await Listing.findOne({ user: req.user.id, $or: [{ sku: product.sku }, { mercariListingId: product.mercariListingId }] });
        }
      } else {
        product = await Product.findOne({ user: req.user.id, $or: [{ sku: listing.sku }, { mercariListingId: listing.mercariListingId }], source: 'mercari' });
      }
    } else {
      listing = await Listing.findOne({ user: req.user.id, $or: [{ mercariListingId: itemId }, { sku: itemId }] });
      product = await Product.findOne({ user: req.user.id, $or: [{ mercariListingId: itemId }, { sku: itemId }], source: 'mercari' });
    }

    let mercariListingId = listing?.mercariListingId || product?.mercariListingId || (itemId.startsWith('m') ? itemId : null);

    // If still missing, check if there's any matching product in Channel Inventory by title
    if (!mercariListingId && listing?.title) {
      const matchByTitle = await Product.findOne({
        user: req.user.id,
        source: 'mercari',
        title: { $regex: listing.title.trim().substring(0, 20), $options: 'i' }
      });
      if (matchByTitle?.mercariListingId) {
        mercariListingId = matchByTitle.mercariListingId;
        listing.mercariListingId = mercariListingId;
        listing.mercariUrl = `https://www.mercari.com/item/${mercariListingId}/`;
        await listing.save();
      }
    }

    if (!mercariListingId) {
      if (listing) {
        listing.mercariStatus = 'none';
        await listing.save();
      }
      return res.status(200).json({
        success: true,
        data: {
          status: 'draft',
          mercariStatus: 'none',
          isLive: false
        },
        message: 'Item has not been published to Mercari yet (Draft / Unlisted).'
      });
    }

    const verifyResult = await verifyMercariListingStatus(mercariListingId, user.mercariAccount);
    
    // Update listing and product based on live status
    if (listing) {
      if (verifyResult.status === 'deleted' || verifyResult.mercariStatus === 'deleted') {
        listing.mercariStatus = 'none';
        listing.mercariListingId = undefined;
        listing.mercariUrl = undefined;
      } else {
        listing.mercariStatus = verifyResult.mercariStatus;
      }

      const hasActive = (listing.ebayStatus === 'published' || 
                         listing.poshmarkStatus === 'published' || 
                         listing.etsyStatus === 'published' || 
                         listing.depopStatus === 'published' ||
                         listing.mercariStatus === 'published');
      const hasDelisted = (listing.ebayStatus === 'delisted' || 
                           listing.poshmarkStatus === 'delisted' || 
                           listing.etsyStatus === 'delisted' || 
                           listing.depopStatus === 'delisted' ||
                           listing.mercariStatus === 'delisted');
      if (hasActive) {
        listing.status = 'published';
      } else if (hasDelisted) {
        listing.status = 'delisted';
      } else {
        listing.status = 'draft';
      }
      await listing.save();
    }

    if (product) {
      if (verifyResult.status === 'deleted' || verifyResult.mercariStatus === 'deleted') {
        await Product.findByIdAndDelete(product._id);
      } else {
        product.status = verifyResult.status;
        await product.save();
      }
    } else if (verifyResult.status === 'deleted') {
      await Product.findOneAndDelete({ user: req.user.id, mercariListingId });
    }

    res.status(200).json({
      success: true,
      data: {
        mercariListingId,
        status: verifyResult.status,
        mercariStatus: verifyResult.mercariStatus,
        isLive: verifyResult.isLive,
        item: verifyResult.item
      },
      message: `Verified status on Mercari: ${verifyResult.status}`
    });
  } catch (err) {
    console.error(`[Mercari Controller] Verify status error:`, err.message);
    res.status(500).json({ success: false, message: `Failed to verify status on Mercari: ${err.message}` });
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

    // 1. Instantly return cached products from DB for fast loading
    const cachedProducts = await Product.find({ 
      user: req.user.id, 
      source: 'mercari' 
    }).sort({ updated_at: -1 });

    if (cachedProducts && cachedProducts.length > 0) {
      return res.status(200).json({
        success: true,
        data: cachedProducts
      });
    }

    // 2. If no products in DB yet, attempt live scrape
    const mercariAccount = user.mercariAccount || {};
    const username = mercariAccount.username;
    
    let liveListings = [];
    try {
      liveListings = await scrapeMercariCloset(username, mercariAccount);
    } catch (scrapeErr) {
      console.warn(`[Mercari Controller] Live scrape fallback to cached:`, scrapeErr.message);
      return res.status(200).json({
        success: true,
        data: cachedProducts || []
      });
    }

    const savedProducts = [];
    for (const item of liveListings) {
      const isItemActive = item.status === 'active';
      const productStatus = isItemActive ? 'active' : 'inactive';

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
        existingProduct.selling_price = parseFloat(item.price) || existingProduct.selling_price || 0;
        if (item.images && item.images.length > 0) existingProduct.images = item.images;
        existingProduct.status = productStatus;
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
          status: productStatus,
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
    const fallback = await Product.find({ user: req.user.id, source: 'mercari' }).sort({ updated_at: -1 });
    res.status(200).json({ success: true, data: fallback || [] });
  }
};

// @desc    Initiate background login flow
// @route   POST /api/mercari/initiate-login
// @access  Private
exports.mercariInitiateLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }

    const sessionId = 'mercari_' + Math.random().toString(36).substring(2, 15);
    
    // Start loginToMercari asynchronously in the background
    loginToMercari(username, password, sessionId, req.user.id)
      .then(result => {
        console.log(`[Mercari Background Login] Finished for session ${sessionId}:`, result.success);
      })
      .catch(err => {
        console.error(`[Mercari Background Login] Error for session ${sessionId}:`, err.message);
      });

    res.status(200).json({
      success: true,
      sessionId,
      message: 'Login initiated. Monitoring stream...'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current session status and screenshot frame
// @route   GET /api/mercari/session-status/:sessionId
// @access  Private
exports.mercariSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { getSessionState } = require('../services/mercariLoginService');
    const state = getSessionState(sessionId);
    
    if (!state) {
      const user = await User.findById(req.user.id);
      if (user?.mercariAccount?.connected) {
        return res.status(200).json({
          success: true,
          status: 'completed',
          message: 'Login successful!',
          latestScreenshot: null
        });
      }
      return res.status(404).json({ success: false, message: 'Session expired or not found.' });
    }

    res.status(200).json({
      success: true,
      status: state.status,
      message: state.message,
      latestScreenshot: state.latestScreenshot,
      '2faRequired': state['2faRequired'],
      verificationOptions: state.verificationOptions || null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Submit 2FA OTP in the background
// @route   POST /api/mercari/submit-2fa-stream
// @access  Private
exports.mercariSubmit2faStream = async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      return res.status(400).json({ success: false, message: 'Session ID and verification code are required.' });
    }

    verifyMercari2FA(sessionId, code, req.user.id)
      .then(result => {
        console.log(`[Mercari Background 2FA] Finished for session ${sessionId}:`, result.success);
      })
      .catch(err => {
        console.error(`[Mercari Background 2FA] Error for session ${sessionId}:`, err.message);
      });

    res.status(200).json({
      success: true,
      message: 'Code submitted. Verifying...'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Trigger specific verification method (SMS, Voice Call, Resend)
// @route   POST /api/mercari/trigger-verification-method
// @access  Private
exports.mercariTriggerVerificationMethod = async (req, res) => {
  try {
    const { sessionId, method } = req.body;
    if (!sessionId || !method) {
      return res.status(400).json({ success: false, message: 'Session ID and verification method are required.' });
    }

    const { triggerVerificationMethod } = require('../services/mercariLoginService');
    const result = await triggerVerificationMethod(sessionId, method);

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get local brand suggestions from offline database
// @route   GET /api/mercari/brands
// @access  Private
exports.getMercariBrands = async (req, res) => {
  try {
    const mercariBrands = require('../constants/mercariBrands.json');
    const query = String(req.query.query || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!query) {
      return res.json({ success: true, brands: [] });
    }

    const matches = [];
    for (const normKey of Object.keys(mercariBrands)) {
      if (normKey.includes(query)) {
        matches.push({
          id: mercariBrands[normKey].id,
          name: mercariBrands[normKey].name
        });
        if (matches.length >= 20) break;
      }
    }

    res.json({ success: true, brands: matches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get complete Mercari item details (all photos, description, category, size, brand)
// @route   GET /api/mercari/item-details/:id
// @access  Private
exports.mercariGetItemDetails = async (req, res) => {
  try {
    const rawId = req.params.id;
    const forceRefresh = req.query.force === 'true';

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let targetMercariId = '';
    let product = null;
    let listing = null;

    // 1. Resolve rawId (could be Mercari ID "m61...", SKU "M-m61...", or Mongo ObjectId)
    if (String(rawId).startsWith('m') && !rawId.includes('-')) {
      targetMercariId = rawId;
    } else if (String(rawId).startsWith('M-m')) {
      targetMercariId = rawId.replace('M-', '');
    }

    if (rawId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(rawId);
      if (product) {
        targetMercariId = product.mercariListingId || (product.sku ? product.sku.replace('M-', '') : '');
      } else {
        listing = await Listing.findById(rawId);
        if (listing) {
          targetMercariId = listing.mercariListingId || (listing.sku ? listing.sku.replace('M-', '') : '');
        }
      }
    }

    if (!targetMercariId && rawId) {
      targetMercariId = String(rawId).replace(/^M-/, '');
    }

    if (!product && targetMercariId) {
      product = await Product.findOne({
        user: req.user.id,
        $or: [
          { mercariListingId: targetMercariId },
          { sku: `M-${targetMercariId}` },
          { sku: targetMercariId }
        ]
      });
    }

    if (!listing && targetMercariId) {
      listing = await Listing.findOne({
        user: req.user.id,
        $or: [
          { mercariListingId: targetMercariId },
          { sku: `M-${targetMercariId}` },
          { sku: targetMercariId }
        ]
      });
    }

    // Fast return if cached Product has all images and full description and force is false
    if (!forceRefresh && product && product.images && product.images.length > 1 && product.description && product.description !== product.title) {
      return res.status(200).json({
        success: true,
        data: {
          _id: product._id,
          mercariListingId: product.mercariListingId || targetMercariId,
          title: product.title,
          description: product.description,
          price: product.selling_price || product.price,
          selling_price: product.selling_price || product.price,
          images: product.images,
          photosLength: product.images.length,
          brand: product.brand || '',
          size: product.size || '',
          category: product.category || product.category_name || '',
          categoryId: product.categoryId || '',
          selectedCondition: product.selectedCondition || product.condition || 'good',
          status: product.status || 'inactive'
        }
      });
    }

    if (!targetMercariId) {
      return res.status(400).json({ success: false, message: 'Could not resolve Mercari listing ID.' });
    }

    if (!user.mercariAccount?.connected || !user.mercariAccount?.sessionCookie) {
      // If not connected, return whatever DB has
      if (product) {
        return res.status(200).json({ success: true, data: product });
      }
      return res.status(400).json({ success: false, message: 'Mercari account is not connected.' });
    }

    console.log(`[Mercari Controller] Auto-enriching Mercari item: ${targetMercariId}`);
    const details = await fetchMercariItemDetails(targetMercariId, user.mercariAccount);

    // Save enriched details in Product model
    if (product) {
      product.title = details.title || product.title;
      product.description = details.description || product.description;
      product.selling_price = parseFloat(details.price) || product.selling_price;
      if (details.images && details.images.length > 0) product.images = details.images;
      if (details.brand) product.brand = details.brand;
      if (details.size) product.size = details.size;
      if (details.category) product.category = details.category;
      if (details.categoryId) product.categoryId = details.categoryId;
      if (details.condition) product.condition = details.condition;
      if (details.selectedCondition) product.selectedCondition = details.selectedCondition;
      if (details.status) product.status = details.status;
      product.updated_at = Date.now();
      await product.save();
    } else {
      product = await Product.create({
        user: req.user.id,
        title: details.title,
        description: details.description,
        selling_price: parseFloat(details.price) || 0,
        sku: `M-${targetMercariId}`,
        brand: details.brand,
        size: details.size,
        category: details.category,
        categoryId: details.categoryId,
        condition: details.condition,
        selectedCondition: details.selectedCondition,
        images: details.images,
        source: 'mercari',
        status: details.status,
        mercariListingId: targetMercariId,
        mercariUrl: `https://www.mercari.com/item/${targetMercariId}/`,
        updated_at: Date.now()
      });
    }

    // Also update Listing model if present
    if (listing) {
      listing.title = details.title || listing.title;
      listing.description = details.description || listing.description;
      listing.price = parseFloat(details.price) || listing.price;
      if (details.images && details.images.length > 0) listing.images = details.images;
      if (details.brand) listing.brand = details.brand;
      if (details.size) listing.size = details.size;
      if (details.category) listing.category = details.category;
      if (details.categoryId) listing.categoryId = details.categoryId;
      if (details.selectedCondition) listing.selectedCondition = details.selectedCondition;
      listing.mercariStatus = details.status === 'active' ? 'published' : 'delisted';
      if (details.status === 'active') listing.status = 'published';
      await listing.save();
    }

    res.status(200).json({
      success: true,
      data: {
        _id: product._id,
        ...details
      }
    });

  } catch (err) {
    console.error('[Mercari Controller] Error fetching full item details:', err.message);
    res.status(500).json({ success: false, message: `Failed to fetch Mercari item details: ${err.message}` });
  }
};
