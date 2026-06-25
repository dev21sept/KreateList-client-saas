const Listing = require('../models/Listing');
const User = require('../models/User');
const { normalizeProductImages, generateThumbnail } = require('../utils/imageProcessor');
const ebayService = require('../services/ebayService');
const { getValidToken } = require('./ebayController');
const { sanitizeEbayDescription } = require('../services/descriptionService');

const isAspectValueInvalid = (val) => {
  if (typeof val !== 'string') return true;
  const clean = val.trim().toLowerCase();
  if (!clean || clean === '' || clean === '-' || clean === 'none' || clean === 'n/a' || clean === 'not applicable') {
    return true;
  }
  const isZero = /^(0+(\.0+)?)\s*(oz|gsm|g|lbs|lb|kg|ml|oz\.)?$/i.test(clean);
  return isZero;
};


// @desc    Get all listings for a user
// @route   GET /api/listings
// @access  Private
exports.getListings = async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id })
      .select('-description -itemSpecifics -images')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: listings.length, data: listings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get dashboard stats for a user
// @route   GET /api/listings/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalListings = await Listing.countDocuments({ user: userId });
    const publishedListings = await Listing.countDocuments({ user: userId, status: 'published' });
    const draftListings = await Listing.countDocuments({ user: userId, status: 'draft' });
    const scheduledListings = await Listing.countDocuments({ user: userId, status: 'scheduled' });
    const failedListings = await Listing.countDocuments({ user: userId, status: 'failed' });

    const recentActivity = await Listing.find({ user: userId })
      .select('-description -itemSpecifics -images')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total: totalListings,
          published: publishedListings,
          draft: draftListings,
          scheduled: scheduledListings,
          failed: failedListings
        },
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private
exports.createListing = async (req, res) => {
  try {
    req.body.user = req.user.id;

    // Convert base64 images to static files and get absolute URLs
    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = await normalizeProductImages(req.body.images, baseUrl);
      if (req.body.images.length > 0) {
        req.body.thumbnail = await generateThumbnail(req.body.images[0]);
      } else {
        req.body.thumbnail = '';
      }
    }

    if (!req.body.sku) {
      return res.status(400).json({ 
        success: false, 
        message: 'SKU is required.' 
      });
    }

    const listing = await Listing.create(req.body);
    res.status(201).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single listing
// @route   GET /api/listings/:id
// @access  Private
exports.getListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update listing
// @route   PUT /api/listings/:id
// @access  Private
exports.updateListing = async (req, res) => {
  try {
    let listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Convert base64 images to static files and get absolute URLs
    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = await normalizeProductImages(req.body.images, baseUrl);
      
      // Delete old replaced image files from disk
      if (listing.images && Array.isArray(listing.images)) {
        const fs = require('fs');
        const path = require('path');
        const newImages = req.body.images;
        
        listing.images.forEach(oldImg => {
          if (oldImg.includes('/uploads/') && !newImages.includes(oldImg)) {
            const filename = oldImg.split('/uploads/').pop();
            const filepath = path.join(__dirname, '..', 'uploads', filename);
            if (fs.existsSync(filepath)) {
              try {
                fs.unlinkSync(filepath);
                console.log(`[Listing Controller] Deleted replaced image file: ${filepath}`);
              } catch (err) {
                console.error(`[Listing Controller] Error deleting replaced file: ${filepath}`, err.message);
              }
            }
          }
        });
      }

      if (req.body.images.length > 0) {
        req.body.thumbnail = await generateThumbnail(req.body.images[0]);
      } else {
        req.body.thumbnail = '';
      }
    }

    listing = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete listing
// @route   DELETE /api/listings/:id
// @access  Private
exports.deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Delete associated image files from server disk
    if (listing.images && Array.isArray(listing.images)) {
      const fs = require('fs');
      const path = require('path');
      listing.images.forEach(imgUrl => {
        if (imgUrl.includes('/uploads/')) {
          const filename = imgUrl.split('/uploads/').pop();
          const filepath = path.join(__dirname, '..', 'uploads', filename);
          if (fs.existsSync(filepath)) {
            try {
              fs.unlinkSync(filepath);
              console.log(`[Listing Controller] Deleted image file: ${filepath}`);
            } catch (err) {
              console.error(`[Listing Controller] Error deleting file: ${filepath}`, err.message);
            }
          }
        }
      });
    }

    await Listing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Helper to map eBay condition IDs to Inventory API enum strings
function mapConditionIdToEnum(conditionId) {
  const id = String(conditionId || '1000').toLowerCase();
  
  const validEnums = ['NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS', 'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE', 'FOR_PARTS_OR_NOT_WORKING'];
  if (validEnums.includes(id.toUpperCase())) return id.toUpperCase();

  if (id.startsWith('1000')) {
    if (id.includes('wd') || id.includes('defect')) return 'NEW_WITH_DEFECTS';
    if (id.includes('c') || id.includes('g') || id.includes('f')) return 'USED_EXCELLENT';
    return 'NEW';
  }
  if (id.startsWith('1500') || id.startsWith('1750')) {
    return 'LIKE_NEW';
  }
  if (id.startsWith('2000') || id.startsWith('2500') || id.startsWith('2010') || id.startsWith('2020') || id.startsWith('2030')) {
    return 'USED_EXCELLENT';
  }
  if (id.startsWith('2750')) {
    return 'LIKE_NEW';
  }
  if (id.startsWith('3000')) {
    return 'USED_EXCELLENT';
  }
  if (id.startsWith('4000')) {
    return 'USED_VERY_GOOD';
  }
  if (id.startsWith('5000')) {
    return 'USED_GOOD';
  }
  if (id.startsWith('6000')) {
    return 'USED_ACCEPTABLE';
  }
  if (id.startsWith('7000')) {
    return 'FOR_PARTS_OR_NOT_WORKING';
  }
  
  return 'NEW'; // Default fallback
}

// Helper to resolve the closest supported condition ID for a given category
function resolveConditionForCategory(conditionId, validIds) {
  if (!validIds || validIds.length === 0) {
    return conditionId || '1000';
  }

  const cleanId = String(conditionId || '1000');
  const baseId = cleanId.split('_')[0];

  // 1. Exact match (e.g. "1000", "3000", "1000_c" if it exists in validIds)
  if (validIds.includes(cleanId)) {
    return cleanId;
  }

  // 2. Base ID match (e.g. if selected is "1000_c" and category supports "1000")
  if (validIds.includes(baseId)) {
    return baseId;
  }

  // 3. Fallback logic based on condition types
  const isNewType = baseId.startsWith('1');
  const isUsedType = baseId.startsWith('2') || baseId.startsWith('3') || baseId.startsWith('4') || baseId.startsWith('5') || baseId.startsWith('6');
  const isPartsType = baseId.startsWith('7');

  if (isNewType) {
    if (validIds.includes('1000')) return '1000';
    // Fallback to any other new-like condition supported
    const altNew = validIds.find(id => id.startsWith('1'));
    if (altNew) return altNew;
  } else if (isUsedType) {
    if (validIds.includes('3000')) return '3000';
    // Fallback to any other used-like condition supported
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  } else if (isPartsType) {
    if (validIds.includes('7000')) return '7000';
    if (validIds.includes('3000')) return '3000';
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  }

  // Default fallback to first available or 1000
  return validIds[0] || '1000';
}

// @desc    Publish listing to eBay
// @route   POST /api/listings/:id/publish
// @access  Private
exports.publishListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // 1. Resolve a valid user token
    const token = await getValidToken(req.user.id);
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Your eBay account is not connected or session expired. Please connect your eBay account in Settings.' 
      });
    }

    console.log(`[EBAY PUBLISH] User connected, token resolved. Starting publish for SKU: ${listing.sku}`);

    // 2. Ensure merchant location exists on eBay
    let locationKey = listing.locationKey || 'default-location';
    try {
      const locations = await ebayService.getLocations(token);
      const locationExists = locations && locations.some(l => l.merchantLocationKey === locationKey);
      if (!locationExists) {
        if (locations && locations.length > 0) {
          locationKey = locations[0].merchantLocationKey;
        } else {
          const defaultLocationData = {
            location: {
              address: {
                addressLine1: '123 Main St',
                city: 'San Jose',
                stateOrProvince: 'CA',
                postalCode: '95125',
                country: 'US'
              }
            },
            locationWebUrl: 'https://elister.ai',
            name: 'Default Location',
            merchantLocationStatus: 'ENABLED',
            locationTypes: ['STORE']
          };
          await ebayService.createOrUpdateLocation(token, locationKey, defaultLocationData);
        }
      }
    } catch (locErr) {
      console.warn('[EBAY PUBLISH] Merchant location check failed, attempting to use locationKey: ' + locationKey, locErr.message);
    }

    // 3. Upload images to eBay Picture Services (EPS)
    const ebayImageUrls = [];
    if (listing.images && listing.images.length > 0) {
      for (const rawImg of listing.images) {
        const imgUrl = typeof rawImg === 'string' ? rawImg.trim() : '';
        if (!imgUrl) continue;

        const isUrl = /^https?:\/\//i.test(imgUrl);
        const isDataUri = /^data:image\/[a-z0-9.+-]+;base64,/i.test(imgUrl);
        const looksLikeRawBase64 = !isUrl && !isDataUri && imgUrl.length > 2000 && /^[a-z0-9+/=\r\n]+$/i.test(imgUrl);
        const isBase64 = isDataUri || looksLikeRawBase64;

        try {
          let uploadedUrl;
          if (isUrl) {
            console.log(`[EBAY PUBLISH] Uploading image from URL: ${imgUrl.substring(0, 100)} to EPS`);
            uploadedUrl = await ebayService.uploadPictureFromUrl(token, imgUrl);
          } else if (isBase64) {
            console.log(`[EBAY PUBLISH] Uploading base64 image to EPS`);
            uploadedUrl = await ebayService.uploadPicture(token, imgUrl);
          } else {
            console.warn(`[EBAY PUBLISH] Unknown image format, skipping.`);
            continue;
          }
          if (uploadedUrl) {
            ebayImageUrls.push(uploadedUrl);
          }
        } catch (imgErr) {
          console.error(`[EBAY PUBLISH] Failed to upload image to EPS:`, imgErr.message);
          if (isUrl && imgUrl.length < 500) {
            ebayImageUrls.push(imgUrl);
          }
        }
      }
    }

    // 4. Build aspects/specifics
    const aspects = {};
    if (listing.itemSpecifics) {
      // Map has to be converted to standard object representation
      const specsObj = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
      for (const [key, value] of Object.entries(specsObj)) {
        if (value && value.length > 0) {
          const filtered = (Array.isArray(value) ? value : [value])
            .map(v => String(v || ''))
            .filter(v => {
              if (isAspectValueInvalid(v)) return false;
              // Specific check for Fabric Weight: must contain a positive number
              if (key.trim().toLowerCase() === 'fabric weight') {
                const numMatch = v.match(/(\d+(\.\d+)?)/);
                if (!numMatch || parseFloat(numMatch[1]) <= 0) {
                  return false; // discard non-numeric or <= 0 values
                }
              }
              return true;
            });
          if (filtered.length > 0) {
            if (key.trim().toLowerCase() === 'fabric weight') {
              aspects[key] = filtered.map(v => {
                const numMatch = v.match(/(\d+(\.\d+)?)/);
                return String(parseFloat(numMatch[1]).toFixed(1));
              });
            } else {
              aspects[key] = filtered;
            }
          }
        }
      }
    }

    // Overlay common fields if they are missing from aspects
    if (listing.brand && !isAspectValueInvalid(listing.brand) && !aspects['Brand']) aspects['Brand'] = [listing.brand];
    if (listing.color && !isAspectValueInvalid(listing.color) && !aspects['Color']) aspects['Color'] = [listing.color];
    if (listing.size && !isAspectValueInvalid(listing.size) && !aspects['Size']) aspects['Size'] = [listing.size];
    if (listing.material && !isAspectValueInvalid(listing.material) && !aspects['Material']) aspects['Material'] = [listing.material];

    // 5. Structure weight and dimensions
    const packageWeightAndSize = {};

    if (listing.packageWeight) {
      const totalOunces = (listing.packageWeight.lbs || 0) * 16 + (listing.packageWeight.oz || 0);
      if (totalOunces > 0) {
        packageWeightAndSize.weight = {
          value: totalOunces,
          unit: 'OUNCE'
        };
      }
    }

    if (listing.packageDimensions) {
      const { length, width, height } = listing.packageDimensions;
      if (length > 0 || width > 0 || height > 0) {
        packageWeightAndSize.dimensions = {
          length: length || 0,
          width: width || 0,
          height: height || 0,
          unit: 'INCH'
        };
      }
    }

    // 6. Create/Update Inventory Item
    // FORCE UNIQUE SKU for every attempt to ensure fresh data and prevent caching issues on eBay
    const timestamp = Date.now().toString().substring(8);
    const sku = (listing.sku || `SKU-${listing._id.toString().substring(18)}`) + "-" + timestamp;

    // Fetch valid conditions from Taxonomy API for listing.categoryId
    let validConditionIds = [];
    if (listing.categoryId) {
      try {
        console.log(`[EBAY PUBLISH] Fetching supported conditions for category ${listing.categoryId}...`);
        const catConditions = await ebayService.getCategoryConditions(token, listing.categoryId);
        if (catConditions && catConditions.length > 0) {
          validConditionIds = catConditions.map(c => String(c.id || c.condition_id || ''));
          console.log(`[EBAY PUBLISH] Supported conditions for category ${listing.categoryId}:`, validConditionIds);
        }
      } catch (err) {
        console.warn(`[EBAY PUBLISH] Failed to fetch category conditions, using static mapping. Error: ${err.message}`);
      }
    }

    const resolvedConditionId = resolveConditionForCategory(listing.conditionId, validConditionIds);
    const ebayConditionEnum = mapConditionIdToEnum(resolvedConditionId);
    console.log(`[EBAY PUBLISH] Selected ConditionID: ${listing.conditionId}, Resolved ConditionID: ${resolvedConditionId}, Mapped Enum: ${ebayConditionEnum}`);

    const inventoryItemData = {
      availability: {
        shipToLocationAvailability: {
          quantity: listing.quantity || 1
        }
      },
      condition: ebayConditionEnum,
      product: {
        title: listing.title ? listing.title.substring(0, 80) : '',
        description: sanitizeEbayDescription(listing.description),
        aspects: aspects,
        imageUrls: ebayImageUrls.length > 0 ? ebayImageUrls : ['https://via.placeholder.com/500']
      }
    };

    if (listing.conditionNote) {
      inventoryItemData.conditionDescription = listing.conditionNote;
    }

    if (packageWeightAndSize.weight || packageWeightAndSize.dimensions) {
      inventoryItemData.packageWeightAndSize = packageWeightAndSize;
    }

    console.log('[EBAY PUBLISH] Creating inventory item on eBay...');
    await ebayService.createOrReplaceInventoryItem(token, sku, inventoryItemData);

    // Sleep for 2 seconds to allow eBay availability database to propagate and prevent "Availability not found"
    console.log('[EBAY PUBLISH] Sleeping for 2 seconds for eBay inventory propagation...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Resolve business policies
    let fulfillmentPolicyId = listing.fulfillmentPolicyId;
    let paymentPolicyId = listing.paymentPolicyId;
    let returnPolicyId = listing.returnPolicyId;

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      try {
        const [fPolicies, pPolicies, rPolicies] = await Promise.all([
          !fulfillmentPolicyId ? ebayService.getFulfillmentPolicies(token) : null,
          !paymentPolicyId ? ebayService.getPaymentPolicies(token) : null,
          !returnPolicyId ? ebayService.getReturnPolicies(token) : null
        ]);

        if (!fulfillmentPolicyId) {
          if (fPolicies && fPolicies.length > 0) {
            fulfillmentPolicyId = fPolicies[0].fulfillmentPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultFulfillmentPolicy(token);
            fulfillmentPolicyId = newPolicy.fulfillmentPolicyId;
          }
        }

        if (!paymentPolicyId) {
          if (pPolicies && pPolicies.length > 0) {
            paymentPolicyId = pPolicies[0].paymentPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultPaymentPolicy(token);
            paymentPolicyId = newPolicy.paymentPolicyId;
          }
        }

        if (!returnPolicyId) {
          if (rPolicies && rPolicies.length > 0) {
            returnPolicyId = rPolicies[0].returnPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultReturnPolicy(token);
            returnPolicyId = newPolicy.returnPolicyId;
          }
        }
      } catch (policyErr) {
        console.error('[EBAY PUBLISH] Error resolving policies:', policyErr.message);
        throw new Error(`Failed to configure shipping/payment policies: ${policyErr.message}`);
      }
    }

    // 8. Handle existing offers (to prevent SKU conflicts)
    const existingOffers = await ebayService.getOffers(token, sku);
    if (existingOffers && existingOffers.length > 0) {
      for (const existingOffer of existingOffers) {
        try {
          console.log(`[EBAY PUBLISH] Deleting existing offer: ${existingOffer.offerId}`);
          await ebayService.deleteOffer(token, existingOffer.offerId);
        } catch (delErr) {
          console.warn(`[EBAY PUBLISH] Failed to delete existing offer ${existingOffer.offerId}:`, delErr.message);
        }
      }
    }

    // 9. Create Offer
    const offerData = {
      sku: sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: listing.quantity || 1,
      pricingSummary: {
        price: {
          value: String(listing.price),
          currency: 'USD'
        }
      },
      listingDescription: sanitizeEbayDescription(listing.description),
      categoryId: listing.categoryId || '26315',
      merchantLocationKey: locationKey,
      listingPolicies: {
        fulfillmentPolicyId,
        paymentPolicyId,
        returnPolicyId
      }
    };

    console.log('[EBAY PUBLISH] Creating offer on eBay...');
    const createOfferRes = await ebayService.createOffer(token, offerData);
    const offerId = createOfferRes.offerId;

    // 10. Publish Offer
    console.log(`[EBAY PUBLISH] Publishing offer: ${offerId}...`);
    const publishRes = await ebayService.publishOffer(token, offerId);
    const ebayListingId = publishRes.listingId;

    // 11. Save publication details in database
    listing.status = 'published';
    listing.sku = sku;
    listing.ebayListingId = ebayListingId;
    listing.ebayUrl = `https://www.ebay.com/itm/${ebayListingId}`;
    listing.errorMessage = null;
    await listing.save();

    console.log(`[EBAY PUBLISH] Successfully published listing! eBay ID: ${ebayListingId}`);
    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    console.error('[EBAY PUBLISH] Publish listing failed:', err.response?.data || err.message);
    const errDetails = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, message: `eBay API Error: ${errDetails}` });
  }
};

// @desc    Check for duplicate listing by first image content
// @route   POST /api/listings/check-duplicate
// @access  Private
exports.checkDuplicateListing = async (req, res) => {
  try {
    const { image, platform } = req.body;
    if (!image || !platform) {
      return res.status(400).json({ success: false, message: 'Image and platform are required.' });
    }

    const { findDuplicateListing } = require('../utils/duplicateChecker');
    const duplicate = await findDuplicateListing(req.user.id, platform, image);
    
    if (duplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        listingId: duplicate._id,
        title: duplicate.title
      });
    }

    res.status(200).json({ success: true, isDuplicate: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const axios = require('axios');

async function checkUrlActive(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
      },
      timeout: 5000,
      maxRedirects: 5
    });

    const finalUrl = response.request?.res?.responseUrl || url;
    
    // If it's a Poshmark listing URL, and we got redirected to home/closet/member page:
    if (url.includes('/listing/') && !finalUrl.includes('/listing/')) {
      console.log(`[Verify Live] Poshmark listing URL redirected to: ${finalUrl}`);
      return false;
    }
    // If it's an eBay listing URL, and we got redirected:
    if (url.includes('/itm/') && !finalUrl.includes('/itm/')) {
      console.log(`[Verify Live] eBay listing URL redirected to: ${finalUrl}`);
      return false;
    }

    return true;
  } catch (err) {
    // Only mark as dead if we get a definitive 404 Not Found
    if (err.response && err.response.status === 404) {
      console.log(`[Verify Live] URL explicitly returned 404: ${url}`);
      return false;
    }
    // If it's a 403 (Forbidden due to Bot protection), 503, 429, or network timeout, assume it's still alive (or we got blocked)
    console.log(`[Verify Live] Request to ${url} failed with status ${err.response?.status || 'Network Error'}. Assuming still active.`);
    return true;
  }
}

// @desc    Verify if a listing URL is active, and reset to draft if not found
// @route   POST /api/listings/:id/verify-live
// @access  Private
exports.verifyListingLive = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    let url = '';
    if (listing.platform === 'poshmark') {
      url = listing.poshmarkUrl;
    } else if (listing.platform === 'ebay') {
      url = listing.ebayUrl;
    } else if (listing.platform === 'vinted') {
      url = listing.vintedUrl;
    } else if (listing.platform === 'depop') {
      url = listing.depopUrl;
    }

    if (!url) {
      listing.status = 'draft';
      await listing.save();
      return res.status(200).json({ success: true, isLive: false, status: 'draft', data: listing });
    }

    const isLive = await checkUrlActive(url);
    if (!isLive) {
      listing.status = 'draft';
      if (listing.platform === 'poshmark') {
        listing.poshmarkListingId = undefined;
        listing.poshmarkUrl = undefined;
      } else if (listing.platform === 'ebay') {
        listing.ebayListingId = undefined;
        listing.ebayUrl = undefined;
      } else if (listing.platform === 'vinted') {
        listing.vintedListingId = undefined;
        listing.vintedUrl = undefined;
      } else if (listing.platform === 'depop') {
        listing.depopListingId = undefined;
        listing.depopUrl = undefined;
      }
      await listing.save();
      return res.status(200).json({ success: true, isLive: false, status: 'draft', data: listing });
    }

    res.status(200).json({ success: true, isLive: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

