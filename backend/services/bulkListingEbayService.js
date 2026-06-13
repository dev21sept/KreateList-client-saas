const Listing = require('../models/Listing');
const User = require('../models/User');
const { normalizeProductImages, generateThumbnail } = require('../utils/imageProcessor');
const ebayService = require('./ebayService');
const { getValidToken } = require('../controllers/ebayController');

const isAspectValueInvalid = (val) => {
  if (typeof val !== 'string') return true;
  const clean = val.trim().toLowerCase();
  if (!clean || clean === '' || clean === '-' || clean === 'none' || clean === 'n/a' || clean === 'not applicable') {
    return true;
  }
  const isZero = /^(0+(\.0+)?)\s*(oz|gsm|g|lbs|lb|kg|ml|oz\.)?$/i.test(clean);
  return isZero;
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
  if (id.startsWith('1500') || id.startsWith('1750')) return 'LIKE_NEW';
  if (id.startsWith('2000') || id.startsWith('2500') || id.startsWith('2010') || id.startsWith('2020') || id.startsWith('2030')) return 'USED_EXCELLENT';
  if (id.startsWith('2750')) return 'LIKE_NEW';
  if (id.startsWith('3000')) return 'USED_EXCELLENT';
  if (id.startsWith('4000')) return 'USED_VERY_GOOD';
  if (id.startsWith('5000')) return 'USED_GOOD';
  if (id.startsWith('6000')) return 'USED_ACCEPTABLE';
  if (id.startsWith('7000')) return 'FOR_PARTS_OR_NOT_WORKING';

  return 'NEW';
}

// Helper to resolve condition ID for category
function resolveConditionForCategory(conditionId, validIds) {
  if (!validIds || validIds.length === 0) return conditionId || '1000';
  const cleanId = String(conditionId || '1000');
  const baseId = cleanId.split('_')[0];

  if (validIds.includes(cleanId)) return cleanId;
  if (validIds.includes(baseId)) return baseId;

  const isNewType = baseId.startsWith('1');
  const isUsedType = baseId.startsWith('2') || baseId.startsWith('3') || baseId.startsWith('4') || baseId.startsWith('5') || baseId.startsWith('6');
  const isPartsType = baseId.startsWith('7');

  if (isNewType) {
    if (validIds.includes('1000')) return '1000';
    const altNew = validIds.find(id => id.startsWith('1'));
    if (altNew) return altNew;
  } else if (isUsedType) {
    if (validIds.includes('3000')) return '3000';
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  } else if (isPartsType) {
    if (validIds.includes('7000')) return '7000';
    if (validIds.includes('3000')) return '3000';
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  }

  return validIds[0] || '1000';
}

/**
 * Bulk saves draft listings
 */
exports.bulkSaveDrafts = async (userId, listingsData, baseUrl) => {
  const savedListings = [];
  
  for (const item of listingsData) {
    try {
      item.user = userId;
      item.platform = 'ebay';
      item.status = 'draft';

      // Normalize images
      if (item.images && Array.isArray(item.images)) {
        item.images = await normalizeProductImages(item.images, baseUrl);
        if (item.images.length > 0) {
          item.thumbnail = await generateThumbnail(item.images[0]);
        } else {
          item.thumbnail = '';
        }
      }

      // Generate dynamic SKU if not present
      if (!item.sku) {
        const productCount = await Listing.countDocuments();
        let currentNum = productCount + 1 + savedListings.length;
        let isUnique = false;
        let skuCode = '';
        while (!isUnique) {
          skuCode = `KL${currentNum}A`;
          const existingListing = await Listing.findOne({ sku: skuCode });
          if (!existingListing) {
            isUnique = true;
          } else {
            currentNum++;
          }
        }
        item.sku = skuCode;
      }

      let listing;
      if (item._id || item.id) {
        const id = item._id || item.id;
        listing = await Listing.findById(id);
        if (listing) {
          Object.assign(listing, item);
          await listing.save();
        } else {
          listing = await Listing.create(item);
        }
      } else {
        listing = await Listing.create(item);
      }

      savedListings.push({ success: true, listing });
    } catch (err) {
      console.error('[BULK SAVE DRAFT ERROR]', err);
      savedListings.push({ success: false, error: err.message, itemTitle: item.title });
    }
  }

  return savedListings;
};

/**
 * Publishes a single listing to eBay. Extracted from controllers/listingController.js
 */
async function publishSingleEbayListing(listing, token) {
  try {
    // 1. Ensure merchant location exists on eBay
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
      console.warn('[BULK EBAY PUBLISH] Merchant location check failed, using locationKey: ' + locationKey, locErr.message);
    }

    // 2. Upload images to EPS
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
            uploadedUrl = await ebayService.uploadPictureFromUrl(token, imgUrl);
          } else if (isBase64) {
            uploadedUrl = await ebayService.uploadPicture(token, imgUrl);
          } else {
            continue;
          }
          if (uploadedUrl) {
            ebayImageUrls.push(uploadedUrl);
          }
        } catch (imgErr) {
          console.error(`[BULK EBAY PUBLISH] Failed to upload image to EPS:`, imgErr.message);
          if (isUrl && imgUrl.length < 500) {
            ebayImageUrls.push(imgUrl);
          }
        }
      }
    }

    // 3. Build aspects/specifics
    const aspects = {};
    if (listing.itemSpecifics) {
      const specsObj = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
      for (const [key, value] of Object.entries(specsObj)) {
        if (value && value.length > 0) {
          const filtered = (Array.isArray(value) ? value : [value])
            .map(v => String(v || ''))
            .filter(v => !isAspectValueInvalid(v));
          if (filtered.length > 0) {
            aspects[key] = filtered;
          }
        }
      }
    }

    if (listing.brand && !isAspectValueInvalid(listing.brand) && !aspects['Brand']) aspects['Brand'] = [listing.brand];
    if (listing.color && !isAspectValueInvalid(listing.color) && !aspects['Color']) aspects['Color'] = [listing.color];
    if (listing.size && !isAspectValueInvalid(listing.size) && !aspects['Size']) aspects['Size'] = [listing.size];
    if (listing.material && !isAspectValueInvalid(listing.material) && !aspects['Material']) aspects['Material'] = [listing.material];

    // 4. Structure weight and dimensions
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

    // 5. Structure inventory item with unique SKU code
    const timestamp = Date.now().toString().substring(8);
    const sku = (listing.sku || `SKU-${listing._id.toString().substring(18)}`) + "-" + timestamp;

    let validConditionIds = [];
    if (listing.categoryId) {
      try {
        const catConditions = await ebayService.getCategoryConditions(token, listing.categoryId);
        if (catConditions && catConditions.length > 0) {
          validConditionIds = catConditions.map(c => String(c.id || c.condition_id || ''));
        }
      } catch (err) {
        console.warn(`[BULK EBAY PUBLISH] Failed to fetch category conditions. Error: ${err.message}`);
      }
    }

    const resolvedConditionId = resolveConditionForCategory(listing.conditionId, validConditionIds);
    const ebayConditionEnum = mapConditionIdToEnum(resolvedConditionId);

    const inventoryItemData = {
      availability: {
        shipToLocationAvailability: {
          quantity: listing.quantity || 1
        }
      },
      condition: ebayConditionEnum,
      product: {
        title: listing.title,
        description: listing.description,
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

    // 6. Create inventory item on eBay
    await ebayService.createOrReplaceInventoryItem(token, sku, inventoryItemData);

    // Sleep for inventory propagation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Resolve policies
    let fulfillmentPolicyId = listing.fulfillmentPolicyId;
    let paymentPolicyId = listing.paymentPolicyId;
    let returnPolicyId = listing.returnPolicyId;

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      const [fPolicies, pPolicies, rPolicies] = await Promise.all([
        !fulfillmentPolicyId ? ebayService.getFulfillmentPolicies(token) : null,
        !paymentPolicyId ? ebayService.getPaymentPolicies(token) : null,
        !returnPolicyId ? ebayService.getReturnPolicies(token) : null
      ]);

      if (!fulfillmentPolicyId) {
        fulfillmentPolicyId = fPolicies && fPolicies.length > 0 ? fPolicies[0].fulfillmentPolicyId : (await ebayService.initDefaultFulfillmentPolicy(token)).fulfillmentPolicyId;
      }
      if (!paymentPolicyId) {
        paymentPolicyId = pPolicies && pPolicies.length > 0 ? pPolicies[0].paymentPolicyId : (await ebayService.initDefaultPaymentPolicy(token)).paymentPolicyId;
      }
      if (!returnPolicyId) {
        returnPolicyId = rPolicies && rPolicies.length > 0 ? rPolicies[0].returnPolicyId : (await ebayService.initDefaultReturnPolicy(token)).returnPolicyId;
      }
    }

    // 8. Delete conflicting offers
    const existingOffers = await ebayService.getOffers(token, sku);
    if (existingOffers && existingOffers.length > 0) {
      for (const existingOffer of existingOffers) {
        try {
          await ebayService.deleteOffer(token, existingOffer.offerId);
        } catch (delErr) {
          console.warn(`[BULK EBAY PUBLISH] Failed to delete existing offer ${existingOffer.offerId}:`, delErr.message);
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
      listingDescription: listing.description,
      categoryId: listing.categoryId || '26315',
      merchantLocationKey: locationKey,
      listingPolicies: {
        fulfillmentPolicyId,
        paymentPolicyId,
        returnPolicyId
      }
    };

    const createOfferRes = await ebayService.createOffer(token, offerData);
    const offerId = createOfferRes.offerId;

    // 10. Publish Offer
    const publishRes = await ebayService.publishOffer(token, offerId);
    const ebayListingId = publishRes.listingId;

    // Save success in database
    listing.status = 'published';
    listing.sku = sku;
    listing.ebayListingId = ebayListingId;
    listing.ebayUrl = `https://www.ebay.com/itm/${ebayListingId}`;
    listing.errorMessage = null;
    await listing.save();

    return { success: true, listingId: listing._id, ebayListingId, ebayUrl: listing.ebayUrl };
  } catch (err) {
    console.error(`[BULK EBAY PUBLISH FAIL] ID ${listing._id}:`, err.response?.data || err.message);
    const errDetails = err.response?.data?.errors?.[0]?.message || err.message;
    
    listing.status = 'failed';
    listing.errorMessage = `eBay API Error: ${errDetails}`;
    await listing.save();

    return { success: false, listingId: listing._id, error: errDetails, title: listing.title };
  }
}

/**
 * Publishes listings in bulk
 */
exports.bulkPublishListings = async (userId, listingsData, baseUrl) => {
  const token = await getValidToken(userId);
  if (!token) {
    throw new Error('Your eBay account is not connected or session expired. Please connect your eBay account in Settings.');
  }

  const results = [];
  for (const itemData of listingsData) {
    try {
      let listing;
      if (itemData._id || itemData.id) {
        // Existing listing (saved draft or failed publishing)
        const id = itemData._id || itemData.id;
        listing = await Listing.findById(id);
        if (!listing) {
          results.push({ success: false, error: 'Listing not found in database', title: itemData.title });
          continue;
        }
        
        // Update local fields first
        Object.assign(listing, itemData);
        if (itemData.images && Array.isArray(itemData.images)) {
          listing.images = await normalizeProductImages(itemData.images, baseUrl);
          if (listing.images.length > 0) {
            listing.thumbnail = await generateThumbnail(listing.images[0]);
          }
        }
        await listing.save();
      } else {
        // Create new local listing first
        itemData.user = userId;
        itemData.platform = 'ebay';
        itemData.status = 'draft';

        if (itemData.images && Array.isArray(itemData.images)) {
          itemData.images = await normalizeProductImages(itemData.images, baseUrl);
          if (itemData.images.length > 0) {
            itemData.thumbnail = await generateThumbnail(itemData.images[0]);
          }
        }

        // SKU code
        if (!itemData.sku) {
          const productCount = await Listing.countDocuments();
          let currentNum = productCount + 1 + results.length;
          let isUnique = false;
          let skuCode = '';
          while (!isUnique) {
            skuCode = `KL${currentNum}A`;
            const existingListing = await Listing.findOne({ sku: skuCode });
            if (!existingListing) {
              isUnique = true;
            } else {
              currentNum++;
            }
          }
          itemData.sku = skuCode;
        }

        listing = await Listing.create(itemData);
      }

      // Publish the listing to eBay
      const res = await publishSingleEbayListing(listing, token);
      results.push(res);
    } catch (err) {
      console.error('[BULK EXECUTION ERROR]', err);
      results.push({ success: false, error: err.message, title: itemData.title });
    }
  }

  return results;
};
