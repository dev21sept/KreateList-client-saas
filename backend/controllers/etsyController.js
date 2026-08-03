const axios = require('axios');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Product = require('../models/Product');
const DeletedProduct = require('../models/DeletedProduct');
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
}

const etsyService = require('../services/etsyService');

exports.etsyConnect = async (req, res) => {
  try {
    const crypto = require('crypto');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    function base64Url(buffer) {
      return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }

    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());

    user.etsyCodeVerifier = codeVerifier;
    await user.save();

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const redirectUri = process.env.ETSY_REDIRECT_URI || `${finalProtocol}://${host}/api/etsy/callback`;

    const scopes = 'listings_w listings_r shops_r';
    const state = req.user.id;

    const authUrl = `https://www.etsy.com/oauth/connect?` +
      `response_type=code&` +
      `client_id=${etsyService.ETSY_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;

    res.status(200).json({ success: true, url: authUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.etsyCallback = async (req, res) => {
  const { code, state } = req.query;
  const rawFrontendUrl = process.env.FRONTEND_URL || 'https://app.elister.ai';
  const frontendUrl = rawFrontendUrl.trim().replace(/\/$/, '');

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/integrations?error=missing_parameters&channel=etsy`);
  }

  try {
    const user = await User.findById(state);
    if (!user) {
      return res.redirect(`${frontendUrl}/integrations?error=user_not_found&channel=etsy`);
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const redirectUri = process.env.ETSY_REDIRECT_URI || `${finalProtocol}://${host}/api/etsy/callback`;

    // Exchange code for tokens
    const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: etsyService.ETSY_CLIENT_ID,
        redirect_uri: redirectUri,
        code: code,
        code_verifier: user.etsyCodeVerifier
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Fetch shop information
    const shopInfo = await etsyService.getShopInfo(data.access_token);

    user.etsyAccount = {
      connected: true,
      shopId: shopInfo.shopId,
      shopName: shopInfo.shopName,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpires: expiresAt
    };
    user.etsyCodeVerifier = undefined; // clear it
    await user.save();

    res.redirect(`${frontendUrl}/integrations?success=true&channel=etsy`);
  } catch (err) {
    console.error('[Etsy Controller] Callback OAuth error:', err.response?.data || err.message);
    const errDetails = err.response?.data?.error_description || err.response?.data?.error || err.message;
    res.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(errDetails)}&channel=etsy`);
  }
};

exports.etsyDisconnect = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.etsyAccount = {
      connected: false,
      shopId: '',
      shopName: '',
      accessToken: '',
      refreshToken: '',
      tokenExpires: null
    };
    await user.save();

    res.status(200).json({ success: true, message: 'Etsy account disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Sync Inventory from Etsy for Logged-In User (persists into local Product cache)
// @route   POST /api/etsy/sync
// @access  Private
exports.syncEtsyInventory = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || !user.etsyAccount || !user.etsyAccount.connected) {
      return res.status(400).json({ success: false, message: 'Etsy account not connected.' });
    }

    const shopId = user.etsyAccount.shopId;
    const listings = await etsyService.getEtsyInventory(userId, shopId);

    let totalSynced = 0;
    for (const item of listings) {
      const listingId = item.listing_id ? String(item.listing_id) : null;
      if (!listingId) continue;

      const sku = Array.isArray(item.skus) && item.skus.length > 0 ? item.skus[0] : '';

      const tombstoneMatch = await DeletedProduct.findOne({
        user: userId,
        $or: [
          sku ? { sku } : null,
          item.title ? { title: item.title, source: 'etsy' } : null
        ].filter(Boolean)
      }).lean();

      if (tombstoneMatch) {
        console.log(`[Etsy Sync] Skipping deleted product: ${sku || item.title || 'unknown'}`);
        continue;
      }

      const images = Array.isArray(item.images)
        ? item.images.map(img => img.url_570xN || img.url_fullxfull || img.url_170x135).filter(Boolean)
        : [];

      const product = {
        user: userId,
        title: decodeHtmlEntities(item.title),
        description: decodeHtmlEntities(item.description),
        sku,
        images,
        selling_price: item.price ? (item.price.amount / (item.price.divisor || 100)) : undefined,
        source: 'etsy',
        status: item.elisterStatus === 'active' ? 'active' : 'inactive',
        etsyListingId: listingId,
        etsyUrl: item.url || `https://www.etsy.com/listing/${listingId}`,
        updated_at: Date.now()
      };

      // Dedupe by the Etsy listing ID first (unique per marketplace listing), then SKU.
      let existingProduct = await Product.findOne({ etsyListingId: listingId, user: userId, source: 'etsy' });
      if (!existingProduct && sku) {
        existingProduct = await Product.findOne({ sku, user: userId, source: 'etsy' });
      }

      if (existingProduct) {
        existingProduct.etsyListingId = listingId;
        existingProduct.etsyUrl = product.etsyUrl;
        if (product.selling_price !== undefined) existingProduct.selling_price = product.selling_price;
        
        // Only update updated_at if status changed to preserve listing age
        if (existingProduct.status !== product.status) {
          existingProduct.status = product.status;
          existingProduct.updated_at = Date.now();
        }
        
        if (sku) existingProduct.sku = sku;
        if (item.title) existingProduct.title = decodeHtmlEntities(item.title);
        if (item.description) existingProduct.description = decodeHtmlEntities(item.description);
        if (images.length > 0) existingProduct.images = images;
        await existingProduct.save();
      } else {
        await Product.create(product);
      }
      totalSynced++;
    }

    res.status(200).json({ success: true, message: 'Etsy inventory sync complete.', count: totalSynced });
  } catch (err) {
    console.error('Etsy Sync Inventory Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get locally-cached Etsy inventory (populated by the sync above)
// @route   GET /api/etsy/inventory
// @access  Private
exports.getSyncedInventory = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user.id, source: 'etsy' }).sort({ updated_at: -1 });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.etsyPublish = async (req, res) => {
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
    if (!user || !user.etsyAccount || !user.etsyAccount.connected) {
      return res.status(400).json({ success: false, message: 'Your Etsy account is not connected. Please connect it first.' });
    }

    const { shopId } = user.etsyAccount;
    console.log(`[Etsy Controller] Creating draft listing for SKU: ${listing.sku} on shop: ${shopId}`);

    const tags = listing.styleTag 
      ? listing.styleTag.split(',')
          .map(t => {
            let clean = t.replace(/[-/]/g, ' '); // replace hyphens and slashes with spaces
            clean = clean.replace(/[^a-zA-Z0-9\s]/g, ''); // keep only letters, numbers, and spaces
            return clean.replace(/\s+/g, ' ').trim(); // normalize spaces
          })
          .filter(Boolean)
          .slice(0, 13)
      : [];
    const materials = listing.material
      ? listing.material.split(',')
          .map(m => {
            let clean = m.replace(/[-/]/g, ' '); // replace hyphens and slashes with spaces
            clean = clean.replace(/[^a-zA-Z0-9\s]/g, ''); // keep only letters, numbers, and spaces
            return clean.replace(/\s+/g, ' ').trim(); // normalize spaces
          })
          .filter(Boolean)
          .slice(0, 13)
      : [];

    let whenMade = listing.etsyWhenMade || '2020_2026';
    if (whenMade === '2000_2009') whenMade = '2000_2006';
    else if (whenMade === '1990_1999') whenMade = '1990s';
    else if (whenMade === '1980_1989') whenMade = '1980s';
    else if (whenMade === 'before_1980') whenMade = '1970s';

    const existingListingId = listing.etsyListingId;
    let publishResult;
    let etsyListingId;

    if (existingListingId) {
      console.log(`[Etsy Controller] Updating existing Etsy listing: ${existingListingId} on shop: ${shopId}`);
      publishResult = await etsyService.updateEtsyListing(req.user.id, shopId, existingListingId, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        quantity: listing.quantity || 1,
        who_made: listing.etsyWhoMade || 'i_did',
        when_made: whenMade,
        is_supply: listing.etsyIsSupply === true || listing.etsyIsSupply === 'true',
        shipping_profile_id: listing.etsyShippingProfileId || undefined,
        tags: tags,
        materials: materials
      });
      etsyListingId = existingListingId;
    } else {
      console.log(`[Etsy Controller] Creating draft listing for SKU: ${listing.sku} on shop: ${shopId}`);
      publishResult = await etsyService.createDraftListing(req.user.id, shopId, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        quantity: listing.quantity || 1,
        taxonomy_id: listing.categoryId || '1091',
        who_made: listing.etsyWhoMade || 'i_did',
        when_made: whenMade,
        is_supply: listing.etsyIsSupply === true || listing.etsyIsSupply === 'true',
        shipping_profile_id: listing.etsyShippingProfileId || undefined,
        tags: tags,
        materials: materials
      });
      etsyListingId = publishResult.listing_id || publishResult.results?.[0]?.listing_id;
    }

    if (!etsyListingId) {
      throw new Error('Etsy did not return a valid listing ID');
    }

    const etsyUrl = `https://www.etsy.com/listing/${etsyListingId}`;

    // Upload images if any exist (only on initial creation to avoid duplicating images)
    if (!existingListingId && listing.images && listing.images.length > 0) {
      console.log(`[Etsy Controller] Uploading ${listing.images.length} images to Etsy listing: ${etsyListingId}`);
      for (const imgUrl of listing.images) {
        try {
          await etsyService.uploadListingImage(req.user.id, shopId, etsyListingId, imgUrl);
        } catch (imgErr) {
          console.error(`[Etsy Controller] Failed to upload image "${imgUrl}" to Etsy:`, imgErr.message);
        }
      }
    }

    // Update listing properties if they exist
    if (listing.etsyAttributes && listing.etsyAttributes.size > 0) {
      console.log(`[Etsy Controller] Updating properties for Etsy listing: ${etsyListingId}`);
      try {
        const attributesObj = listing.etsyAttributes instanceof Map 
          ? Object.fromEntries(listing.etsyAttributes) 
          : listing.etsyAttributes;

        for (const [propertyIdStr, valueArray] of Object.entries(attributesObj)) {
          try {
            const propertyId = parseInt(propertyIdStr);
            if (!isNaN(propertyId) && valueArray && valueArray.length > 0) {
              const valueIds = [];
              const values = [];

              valueArray.forEach(val => {
                if (/^\d+$/.test(val)) {
                  valueIds.push(parseInt(val));
                } else {
                  values.push(val);
                }
              });

              console.log(`[Etsy Controller] Sending property update for Property ID: ${propertyId}, Value IDs: ${valueIds}, Values: ${values}`);
              await etsyService.updateListingProperty(req.user.id, shopId, etsyListingId, propertyId, valueIds, values);
            }
          } catch (propErr) {
            console.error(`[Etsy Controller] Failed to update listing property ${propertyIdStr}:`, propErr.response?.data || propErr.message);
          }
        }
      } catch (mapErr) {
        console.error(`[Etsy Controller] Error processing etsyAttributes:`, mapErr.message);
      }
    }

    // Now make the listing active (live) on Etsy!
    try {
      console.log(`[Etsy Controller] Activating listing ${etsyListingId} to make it live on Etsy...`);
      await etsyService.updateListingState(req.user.id, shopId, etsyListingId, 'active');
      console.log(`[Etsy Controller] Listing ${etsyListingId} is now live!`);
    } catch (actErr) {
      console.error(`[Etsy Controller] Failed to activate listing:`, actErr.response?.data || actErr.message);
    }

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.etsyStatus = 'published';
    listing.etsyListingId = String(etsyListingId);
    listing.etsyUrl = etsyUrl;
    await listing.save();

    // Automatically update matched Product model cache to keep Channel Inventory synced!
    try {
      const Product = require('../models/Product');
      await Product.findOneAndUpdate(
        { user: listing.user, sku: listing.sku, source: 'etsy' },
        { status: 'active', etsyListingId: String(etsyListingId), etsyUrl: etsyUrl, updated_at: Date.now() }
      );
      console.log(`[Etsy Controller] Updated synced Product status to active for SKU: ${listing.sku}`);
    } catch (cacheErr) {
      console.warn(`[Etsy Controller] Failed to update matched Product cache:`, cacheErr.message);
    }

    console.log(`[Etsy Controller] Direct publishing successful! URL: ${etsyUrl}`);
    res.status(200).json({
      success: true,
      message: existingListingId ? 'Listing successfully updated on Etsy!' : 'Draft listing successfully created on Etsy!',
      listingId: etsyListingId,
      url: etsyUrl
    });
  } catch (err) {
    console.error(`[Etsy Controller] Error publishing to Etsy:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEtsyShippingProfiles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.etsyAccount || !user.etsyAccount.connected) {
      return res.status(200).json({ success: true, data: [] });
    }
    const profiles = await etsyService.getShippingProfiles(req.user.id, user.etsyAccount.shopId);
    res.status(200).json({ success: true, data: profiles });
  } catch (err) {
    console.error('[Etsy Controller] getEtsyShippingProfiles error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEtsyCategoryProperties = async (req, res) => {
  try {
    const taxonomyId = req.params.id;
    if (!taxonomyId) {
      return res.status(400).json({ success: false, message: 'Taxonomy ID is required.' });
    }
    const properties = await etsyService.getCategoryProperties(req.user.id, taxonomyId);
    res.status(200).json({ success: true, data: properties });
  } catch (err) {
    console.error('[Etsy Controller] getEtsyCategoryProperties error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveEtsyCategory = async (req, res) => {
  try {
    const { path: categoryPath } = req.query;
    if (!categoryPath) {
      return res.status(400).json({ success: false, message: 'Category path is required.' });
    }
    const { getEtsyTaxonomy } = require('./etsyAiController');
    const taxonomy = await getEtsyTaxonomy();
    
    // Exact match first
    let matchedCat = taxonomy.find(cat => cat.fullName.toLowerCase() === categoryPath.toLowerCase().trim());
    
    // Fuzzy match if not found
    if (!matchedCat) {
      matchedCat = taxonomy.find(cat => cat.fullName.toLowerCase().includes(categoryPath.toLowerCase().trim()));
    }
    
    // Level-based parts matching fallback
    if (!matchedCat) {
      const parts = categoryPath.split('>').map(p => p.trim().toLowerCase());
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        matchedCat = taxonomy.find(cat => cat.name.toLowerCase() === lastPart);
        if (!matchedCat) {
          matchedCat = taxonomy.find(cat => cat.name.toLowerCase().includes(lastPart));
        }
      }
    }
    
    if (matchedCat) {
      return res.status(200).json({ success: true, data: matchedCat });
    } else {
      return res.status(200).json({ success: false, message: 'No match found.' });
    }
  } catch (err) {
    console.error('[Etsy Controller] resolveEtsyCategory error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
