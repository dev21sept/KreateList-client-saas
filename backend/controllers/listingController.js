const Listing = require('../models/Listing');
const User = require('../models/User');
const { normalizeProductImages } = require('../utils/imageProcessor');
const ebayService = require('../services/ebayService');
const { getValidToken } = require('./ebayController');


// @desc    Get all listings for a user
// @route   GET /api/listings
// @access  Private
exports.getListings = async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id }).sort({ createdAt: -1 });
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
    await Listing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to map eBay condition IDs to Inventory API enum strings
function mapConditionIdToEnum(conditionId) {
  const id = String(conditionId);
  if (id === '1000') return 'NEW';
  if (id === '1500' || id === '1750') return 'LIKE_NEW';
  if (id === '2000' || id === '2500') return 'VERY_GOOD';
  if (id === '3000') return 'GOOD';
  if (id === '4000' || id === '5000' || id === '6000') return 'ACCEPTABLE';
  if (id === '7000') return 'FOR_PARTS_OR_NOT_WORKING';
  return 'NEW'; // Default fallback
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
    let locationKey = 'default-location';
    try {
      const locations = await ebayService.getLocations(token);
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
    } catch (locErr) {
      console.warn('[EBAY PUBLISH] Merchant location check failed, attempting to use default-location key.', locErr.message);
    }

    // 3. Upload images to eBay Picture Services (EPS)
    const ebayImageUrls = [];
    if (listing.images && listing.images.length > 0) {
      for (const imgUrl of listing.images) {
        try {
          console.log(`[EBAY PUBLISH] Uploading image: ${imgUrl} to EPS`);
          const uploadedUrl = await ebayService.uploadPictureFromUrl(token, imgUrl);
          ebayImageUrls.push(uploadedUrl);
        } catch (imgErr) {
          console.error(`[EBAY PUBLISH] Failed to upload image ${imgUrl} to EPS:`, imgErr.message);
          ebayImageUrls.push(imgUrl); // Fallback to original URL
        }
      }
    }

    // 4. Build aspects/specifics
    const aspects = {};
    if (listing.itemSpecifics) {
      // Map has to be converted to standard object representation
      const specsObj = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
      for (const [key, value] of Object.entries(specsObj)) {
        if (value && value.length > 0 && value[0]) {
          aspects[key] = Array.isArray(value) ? value : [value];
        }
      }
    }

    // Overlay common fields if they are missing from aspects
    if (listing.brand && !aspects['Brand']) aspects['Brand'] = [listing.brand];
    if (listing.color && !aspects['Color']) aspects['Color'] = [listing.color];
    if (listing.size && !aspects['Size']) aspects['Size'] = [listing.size];
    if (listing.material && !aspects['Material']) aspects['Material'] = [listing.material];

    // 5. Structure weight and dimensions
    const packageWeightAndSize = {
      packageType: 'MAILING_BOX'
    };

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
    const sku = listing.sku || `SKU-${listing._id}`;
    const inventoryItemData = {
      availability: {
        shipToLocationAvailability: {
          quantity: listing.quantity || 1
        }
      },
      condition: mapConditionIdToEnum(listing.conditionId || '1000'),
      product: {
        title: listing.title,
        description: listing.description,
        aspects: aspects,
        imageUrls: ebayImageUrls.length > 0 ? ebayImageUrls : ['https://via.placeholder.com/500']
      }
    };

    if (packageWeightAndSize.weight || packageWeightAndSize.dimensions) {
      inventoryItemData.packageWeightAndSize = packageWeightAndSize;
    }

    console.log('[EBAY PUBLISH] Creating inventory item on eBay...');
    await ebayService.createOrReplaceInventoryItem(token, sku, inventoryItemData);

    // 7. Resolve business policies
    let fulfillmentPolicyId, paymentPolicyId, returnPolicyId;

    try {
      const [fPolicies, pPolicies, rPolicies] = await Promise.all([
        ebayService.getFulfillmentPolicies(token),
        ebayService.getPaymentPolicies(token),
        ebayService.getReturnPolicies(token)
      ]);

      if (fPolicies && fPolicies.length > 0) {
        fulfillmentPolicyId = fPolicies[0].fulfillmentPolicyId;
      } else {
        const newPolicy = await ebayService.initDefaultFulfillmentPolicy(token);
        fulfillmentPolicyId = newPolicy.fulfillmentPolicyId;
      }

      if (pPolicies && pPolicies.length > 0) {
        paymentPolicyId = pPolicies[0].paymentPolicyId;
      } else {
        const newPolicy = await ebayService.initDefaultPaymentPolicy(token);
        paymentPolicyId = newPolicy.paymentPolicyId;
      }

      if (rPolicies && rPolicies.length > 0) {
        returnPolicyId = rPolicies[0].returnPolicyId;
      } else {
        const newPolicy = await ebayService.initDefaultReturnPolicy(token);
        returnPolicyId = newPolicy.returnPolicyId;
      }
    } catch (policyErr) {
      console.error('[EBAY PUBLISH] Error resolving policies:', policyErr.message);
      throw new Error(`Failed to configure shipping/payment policies: ${policyErr.message}`);
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
      price: {
        value: listing.price,
        currency: 'USD'
      },
      listingDescription: listing.description,
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

