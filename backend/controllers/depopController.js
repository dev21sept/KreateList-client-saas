const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { scrapeDepopShop } = require('../services/externalImportService');
const { publishToDepop } = require('../services/backendPublishService');
const { loginToDepopInteractive } = require('../services/depopLoginService');

async function resolveDepopUsernameViaPuppeteer(accessToken) {
  let browser = null;
  try {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    try {
      puppeteer.use(StealthPlugin());
    } catch (e) {}

    console.log('[Depop Controller] Launching Puppeteer Stealth to resolve username...');
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    const proxyUrl = process.env.HTTP_PROXY_URL;
    let proxyAuth = null;
    if (proxyUrl) {
      try {
        const parsedUrl = new URL(proxyUrl);
        const cleanProxyUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        launchOptions.args.push(`--proxy-server=${cleanProxyUrl}`);
        if (parsedUrl.username && parsedUrl.password) {
          proxyAuth = {
            username: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password)
          };
        }
      } catch (e) {
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
      }
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      const fs = require('fs');
      const checkPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
      for (const p of checkPaths) {
        if (fs.existsSync(p)) {
          launchOptions.executablePath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://www.depop.com/', { waitUntil: 'networkidle2', timeout: 30000 });

    const result = await page.evaluate(async (token) => {
      try {
        const tryFetch = async (url) => {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            return data.username || data.username_canonical || data.usernameCanonical || null;
          }
          throw new Error(`Status ${res.status}`);
        };

        return await tryFetch('https://webapi.depop.com/api/v1/auth/session/')
          .catch(() => tryFetch('https://webapi.depop.com/api/v1/users/me'))
          .catch(() => tryFetch('https://webapi.depop.com/api/users/me'));
      } catch (err) {
        return null;
      }
    }, accessToken);

    return result;
  } catch (err) {
    console.error('[Depop Controller] Failed to resolve username via Puppeteer:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

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

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'accessToken is required.' });
    }

    let resolvedUsername = username ? username.trim() : '';
    if (resolvedUsername === 'depop_user' || resolvedUsername.includes('@') || !resolvedUsername) {
      console.log(`[Depop Controller] Resolving actual username for token from connection request...`);
      try {
        const cleanToken = accessToken.trim().replace(/^Bearer\s+/i, '');
        const parts = cleanToken.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
          const payloadObj = JSON.parse(decodedPayload);
          if (payloadObj.username) resolvedUsername = payloadObj.username;
          else if (payloadObj.username_canonical) resolvedUsername = payloadObj.username_canonical;
          else if (payloadObj.sub) resolvedUsername = payloadObj.sub;
        }
      } catch (err) {
        console.warn(`[Depop Controller] Failed to resolve username during connect:`, err.message);
      }

      if (resolvedUsername === 'depop_user' || !resolvedUsername || resolvedUsername.includes('@')) {
        console.log(`[Depop Controller] Falling back to Puppeteer to resolve actual username...`);
        const puppeteerUsername = await resolveDepopUsernameViaPuppeteer(accessToken);
        if (puppeteerUsername) {
          resolvedUsername = puppeteerUsername;
        }
      }

      if (resolvedUsername === 'depop_user' || !resolvedUsername || resolvedUsername.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'Could not resolve your actual Depop username. Please ensure you are logged into Depop on your browser and try again.'
        });
      }
    }

    user.depopAccount = {
      connected: true,
      username: resolvedUsername,
      accessToken: accessToken.trim(),
      sessionCookie: (req.body.sessionCookie || '').trim(),
      usePartnerApi: !!req.body.usePartnerApi,
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
    
    const user = await User.findById(req.user.id);
    const depopAccount = user?.depopAccount || {};
    const scrapedListings = await scrapeDepopShop(cleanUsername, depopAccount);

    if (user && user.depopAccount && depopAccount.username && user.depopAccount.username !== depopAccount.username) {
      user.depopAccount.username = depopAccount.username;
      user.markModified('depopAccount');
      await user.save();
      console.log(`[Depop Controller] Saved resolved username (${depopAccount.username}) to DB`);
    }

    let importCount = 0;
    let duplicateCount = 0;
    const importedItems = [];

    for (const item of scrapedListings) {
      // Check for duplicate in DB for this user in Product collection
      let existingProduct = null;
      if (item.sku) {
        existingProduct = await Product.findOne({ user: req.user.id, sku: item.sku, source: 'depop' });
      }

      if (!existingProduct) {
        const duplicateQuery = { 
          user: req.user.id, 
          source: 'depop',
          $or: [
            { depopListingId: item.depopListingId },
            { depopUrl: item.depopUrl }
          ]
        };
        existingProduct = await Product.findOne(duplicateQuery);
      }

      if (existingProduct) {
        // If it exists, merge the Depop details
        if (!existingProduct.depopListingId || !existingProduct.depopUrl) {
          existingProduct.depopListingId = item.depopListingId;
          existingProduct.depopUrl = item.depopUrl;
          if (item.brand && !existingProduct.brand) existingProduct.brand = item.brand;
          if (item.size && !existingProduct.size) existingProduct.size = item.size;
          existingProduct.updated_at = Date.now();
          await existingProduct.save();
        }
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
        size: item.size || '',
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

    let listing = await Listing.findById(listingId);
    if (!listing) {
      const Product = require('../models/Product');
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
          listing.depopListingId = prod.depopListingId;
          listing.depopUrl = prod.depopUrl;
          listing.depopStatus = prod.status === 'active' ? 'published' : 'delisted';
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

    if (!user.depopAccount?.connected || !user.depopAccount?.accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Your Depop account is not connected on the server. Please connect your Depop account first.'
      });
    }

    const existingListingId = listing.depopListingId;
    const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || (user.depopAccount && user.depopAccount.usePartnerApi));

    if (existingListingId && !isPartner) {
      return res.status(400).json({
        success: false,
        message: 'Updating active listings on Depop without a Depop Partner API integration is not supported. Please edit the listing directly on Depop.'
      });
    }

    console.log(`[Depop Controller] Direct publishing listing: ${listingId} to Depop`);
    const publishResult = await publishToDepop(listing, user.depopAccount);

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.depopStatus = 'published';
    listing.errorMessage = null;
    listing.depopListingId = publishResult.id;
    listing.depopUrl = publishResult.url;

    await listing.save();

    // Automatically update matched Product model cache to keep Channel Inventory synced!
    try {
      const Product = require('../models/Product');
      await Product.findOneAndUpdate(
        { user: listing.user, sku: listing.sku, source: 'depop' },
        { status: 'active', depopListingId: publishResult.id, depopUrl: publishResult.url, updated_at: Date.now() }
      );
      console.log(`[Depop Controller] Updated synced Product status to active for SKU: ${listing.sku}`);
    } catch (cacheErr) {
      console.warn(`[Depop Controller] Failed to update matched Product cache:`, cacheErr.message);
    }

    console.log(`[Depop Controller] Direct publishing successful! URL: ${publishResult.url}`);

    res.status(200).json({
      success: true,
      message: existingListingId ? 'Listing successfully updated on Depop!' : 'Listing successfully published to Depop!',
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
    
    const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || (user.depopAccount && user.depopAccount.usePartnerApi));
    const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;

    let liveListings = [];
    if (isPartner && apiKey) {
      console.log(`[Depop Controller] Fetching live inventory via official Partner API`);
      const { getListingsFromDepopPartner } = require('../services/depopPartnerService');
      liveListings = await getListingsFromDepopPartner(apiKey);
    } else {
      const depopAccount = user.depopAccount || {};
      const username = depopAccount.username;
      console.log(`[Depop Controller] Fetching live inventory for Depop (${username}) via Scraping`);
      
      liveListings = await scrapeDepopShop(username, depopAccount);

      if (depopAccount.username && user.depopAccount.username !== depopAccount.username) {
        user.depopAccount.username = depopAccount.username;
        user.markModified('depopAccount');
        await user.save();
        console.log(`[Depop Controller] Saved resolved username (${depopAccount.username}) to DB in getLive`);
      }
    }
    
    const savedProducts = [];
    for (const item of liveListings) {
      let existingProduct = null;
      if (item.sku) {
        existingProduct = await Product.findOne({ user: req.user.id, sku: item.sku, source: 'depop' });
      }

      if (!existingProduct) {
        const duplicateQuery = { 
          user: req.user.id, 
          source: 'depop',
          $or: [
            { depopListingId: item.depopListingId },
            { depopUrl: item.depopUrl }
          ]
        };
        existingProduct = await Product.findOne(duplicateQuery);
      }

      if (existingProduct) {
        // Update details to match the latest live state
        existingProduct.title = item.title;
        existingProduct.description = item.description;
        existingProduct.selling_price = parseFloat(item.price) || 0;
        existingProduct.brand = item.brand || '';
        existingProduct.size = item.size || '';
        existingProduct.images = item.images;
        existingProduct.status = item.status === 'active' ? 'live' : 'inactive';
        existingProduct.updated_at = Date.now();
        await existingProduct.save();
        savedProducts.push(existingProduct);
      } else {
        const productPayload = {
          user: req.user.id,
          title: item.title,
          description: item.description,
          selling_price: parseFloat(item.price) || 0,
          sku: item.sku,
          brand: item.brand || '',
          size: item.size || '',
          images: item.images,
          source: 'depop',
          status: item.status === 'active' ? 'live' : 'inactive',
          depopListingId: item.depopListingId,
          depopUrl: item.depopUrl,
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
    console.error(`[Depop Controller] Error getting live inventory:`, err.message);
    res.status(200).json({ success: false, message: err.message, data: [] });
  }
};
