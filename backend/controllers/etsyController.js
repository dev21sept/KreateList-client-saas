const axios = require('axios');
const User = require('../models/User');
const Listing = require('../models/Listing');
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

exports.syncEtsyInventory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.etsyAccount || !user.etsyAccount.connected) {
      return res.status(400).json({ success: false, message: 'Etsy account not connected.' });
    }
    const listings = await etsyService.getEtsyInventory(req.user.id, user.etsyAccount.shopId);
    res.status(200).json({ success: true, message: 'Etsy inventory sync complete.', count: listings.length, listings });
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
      ? listing.material.split(',').map(m => m.trim()).filter(Boolean).slice(0, 13)
      : [];

    let whenMade = listing.etsyWhenMade || '2020_2026';
    if (whenMade === '2000_2009') whenMade = '2000_2006';
    else if (whenMade === '1990_1999') whenMade = '1990s';
    else if (whenMade === '1980_1989') whenMade = '1980s';
    else if (whenMade === 'before_1980') whenMade = '1970s';

    const publishResult = await etsyService.createDraftListing(req.user.id, shopId, {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      quantity: listing.quantity || 1,
      taxonomy_id: listing.categoryId || '1091',
      who_made: listing.etsyWhoMade || 'i_did',
      when_made: whenMade,
      is_supply: listing.etsyIsSupply === true || listing.etsyIsSupply === 'true',
      tags: tags,
      materials: materials
    });

    const etsyListingId = publishResult.listing_id || publishResult.results?.[0]?.listing_id;
    if (!etsyListingId) {
      throw new Error('Etsy did not return a valid listing ID');
    }

    const etsyUrl = `https://www.etsy.com/listing/${etsyListingId}`;

    // Upload images if any exist
    if (listing.images && listing.images.length > 0) {
      console.log(`[Etsy Controller] Uploading ${listing.images.length} images to Etsy listing: ${etsyListingId}`);
      for (const imgUrl of listing.images) {
        try {
          await etsyService.uploadListingImage(req.user.id, shopId, etsyListingId, imgUrl);
        } catch (imgErr) {
          console.error(`[Etsy Controller] Failed to upload image "${imgUrl}" to Etsy:`, imgErr.message);
        }
      }
    }

    // Save publish outcome in listing document
    listing.status = 'published';
    listing.etsyStatus = 'published';
    listing.etsyListingId = String(etsyListingId);
    listing.etsyUrl = etsyUrl;
    await listing.save();

    console.log(`[Etsy Controller] Direct publishing successful! URL: ${etsyUrl}`);
    res.status(200).json({
      success: true,
      message: 'Draft listing successfully created on Etsy!',
      listingId: etsyListingId,
      url: etsyUrl
    });
  } catch (err) {
    console.error(`[Etsy Controller] Error publishing to Etsy:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
