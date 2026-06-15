const Listing = require('../models/Listing');
const User = require('../models/User');
const { scrapeDepopShop, scrapePoshmarkCloset } = require('../services/externalImportService');
const { publishToDepop, publishToPoshmark } = require('../services/backendPublishService');

// @desc    Import external inventory from Depop or Poshmark closet
// @route   POST /api/external-import/import
// @access  Private
exports.importExternalCloset = async (req, res) => {
  try {
    const { platform, username } = req.body;
    
    if (!platform || !username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide both platform and username' 
      });
    }

    const normalizedPlatform = platform.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (normalizedPlatform !== 'depop' && normalizedPlatform !== 'poshmark') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid platform. Only depop or poshmark are supported.' 
      });
    }

    console.log(`[Import Controller] Starting import. Platform: ${normalizedPlatform}, Username: ${cleanUsername}, UserID: ${req.user.id}`);
    
    let scrapedListings = [];
    if (normalizedPlatform === 'depop') {
      scrapedListings = await scrapeDepopShop(cleanUsername);
    } else {
      scrapedListings = await scrapePoshmarkCloset(cleanUsername);
    }

    let importCount = 0;
    let duplicateCount = 0;
    const importedItems = [];

    for (const item of scrapedListings) {
      // Check for duplicate in DB for this user
      let duplicateQuery = { user: req.user.id };
      
      if (normalizedPlatform === 'depop') {
        duplicateQuery.$or = [
          { depopListingId: item.depopListingId },
          { depopUrl: item.depopUrl },
          { sku: item.sku }
        ];
      } else {
        duplicateQuery.$or = [
          { poshmarkListingId: item.poshmarkListingId },
          { poshmarkUrl: item.poshmarkUrl },
          { sku: item.sku }
        ];
      }

      const existingListing = await Listing.findOne(duplicateQuery);

      if (existingListing) {
        duplicateCount++;
        continue;
      }

      // Prepare Listing payload
      const listingPayload = {
        user: req.user.id,
        title: item.title,
        description: item.description,
        price: item.price,
        sku: item.sku,
        category: item.category || 'Tops',
        categoryId: item.categoryId || '',
        images: item.images,
        thumbnail: item.thumbnail || '',
        status: 'draft',
        platform: normalizedPlatform,
        brand: item.brand || '',
        size: item.size || '',
        quantity: item.quantity || 1,
        color: item.color || '',
        styleTag: item.styleTag || '',
        originalPrice: item.originalPrice || '',
        country: 'United States' // Default country
      };

      if (normalizedPlatform === 'depop') {
        listingPayload.depopListingId = item.depopListingId;
        listingPayload.depopUrl = item.depopUrl;
      } else {
        listingPayload.poshmarkListingId = item.poshmarkListingId;
        listingPayload.poshmarkUrl = item.poshmarkUrl;
      }

      const newListing = await Listing.create(listingPayload);
      importedItems.push(newListing);
      importCount++;
    }

    res.status(200).json({
      success: true,
      message: `Closet import completed for ${cleanUsername}`,
      data: {
        totalFound: scrapedListings.length,
        importedCount: importCount,
        skippedDuplicates: duplicateCount,
        listings: importedItems
      }
    });

  } catch (err) {
    console.error(`[Import Controller] Error importing closet:`, err.message);
    res.status(500).json({ 
      success: false, 
      message: `Failed to import closet: ${err.message}` 
    });
  }
};

// @desc    Connect platform credentials (save auth tokens / session cookies)
// @route   POST /api/external-import/connect
// @access  Private
exports.connectPlatform = async (req, res) => {
  try {
    const { platform, username, accessToken, sessionCookie, csrfToken } = req.body;

    if (!platform || !username) {
      return res.status(400).json({
        success: false,
        message: 'Platform and username are required.'
      });
    }

    const normalizedPlatform = platform.trim().toLowerCase();
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (normalizedPlatform === 'depop') {
      if (!accessToken) {
        return res.status(400).json({ success: false, message: 'accessToken is required to connect Depop.' });
      }
      user.depopAccount = {
        connected: true,
        username: username.trim(),
        accessToken: accessToken.trim(),
        connectedAt: new Date()
      };
    } else if (normalizedPlatform === 'poshmark') {
      if (!sessionCookie || !csrfToken) {
        return res.status(400).json({ success: false, message: 'sessionCookie and csrfToken are required to connect Poshmark.' });
      }
      user.poshmarkAccount = {
        connected: true,
        username: username.trim(),
        sessionCookie: sessionCookie.trim(),
        csrfToken: csrfToken.trim(),
        connectedAt: new Date()
      };
    } else {
      return res.status(400).json({ success: false, message: 'Supported platforms are depop or poshmark only.' });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `${platform} account connected successfully!`,
      data: normalizedPlatform === 'depop' ? user.depopAccount : user.poshmarkAccount
    });
  } catch (err) {
    console.error(`[Import Controller] Connect platform error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Publish draft listing directly to Depop or Poshmark using Direct APIs
// @route   POST /api/external-import/publish/:id
// @access  Private
exports.publishListingToPlatform = async (req, res) => {
  try {
    const { platform } = req.body;
    const listingId = req.params.id;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to publish this listing' });
    }

    const targetPlatform = (platform || listing.platform || '').trim().toLowerCase();
    if (targetPlatform !== 'depop' && targetPlatform !== 'poshmark') {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Direct backend publishing is only supported for depop or poshmark.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`[Import Controller] Direct publishing listing: ${listingId} to platform: ${targetPlatform}`);

    let publishResult;
    if (targetPlatform === 'depop') {
      if (!user.depopAccount?.connected || !user.depopAccount?.accessToken) {
        return res.status(400).json({
          success: false,
          message: 'Your Depop account is not connected on the server. Please connect your Depop account first.'
        });
      }
      publishResult = await publishToDepop(listing, user.depopAccount);
    } else {
      if (!user.poshmarkAccount?.connected || !user.poshmarkAccount?.sessionCookie) {
        return res.status(400).json({
          success: false,
          message: 'Your Poshmark account is not connected on the server. Please connect your Poshmark account first.'
        });
      }
      publishResult = await publishToPoshmark(listing, user.poshmarkAccount);
    }

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.errorMessage = null;
    
    if (targetPlatform === 'depop') {
      listing.depopListingId = publishResult.id;
      listing.depopUrl = publishResult.url;
    } else {
      listing.poshmarkListingId = publishResult.id;
      listing.poshmarkUrl = publishResult.url;
    }

    await listing.save();
    console.log(`[Import Controller] Direct publishing successful! URL: ${publishResult.url}`);

    res.status(200).json({
      success: true,
      message: `Listing successfully published to ${targetPlatform}!`,
      data: listing
    });
  } catch (err) {
    console.error(`[Import Controller] Direct publishing error:`, err.message);
    
    // Save error on listing
    try {
      const listing = await Listing.findById(req.params.id);
      if (listing) {
        listing.errorMessage = err.message;
        listing.status = 'failed';
        await listing.save();
      }
    } catch (dbErr) {
      console.error('[Import Controller] Failed to update error status on listing:', dbErr.message);
    }

    res.status(500).json({
      success: false,
      message: `Publish failed: ${err.message}`
    });
  }
};
