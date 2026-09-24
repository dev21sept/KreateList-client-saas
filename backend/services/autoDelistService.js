const Listing = require('../models/Listing');
const Product = require('../models/Product');
const User = require('../models/User');

const { deactivateMercariListing } = require('./mercariService');
const { delistPoshmarkListing, delistDepopListing } = require('./backendPublishService');
const { updateListingState: updateEtsyListingState } = require('./etsyService');
const ebayService = require('./ebayService');
const { findBestMatchingListing } = require('../utils/listingMatcher');

/**
 * Handles cross-platform auto-delisting when an item sells on any channel.
 * 
 * @param {Object} params
 * @param {string|ObjectId} params.userId MongoDB User ID
 * @param {string} params.soldPlatform Platform where the item was sold ('ebay', 'poshmark', 'mercari', 'depop', 'etsy')
 * @param {string} [params.sku] SKU of the sold item
 * @param {string} [params.listingId] Platform listing ID of the sold item (e.g. m..., Poshmark ID, eBay Item ID)
 * @param {string} [params.title] Title of the sold item
 * @param {string} [params.orderId] Order ID associated with the sale
 * @param {Date|string} [params.orderDate] Date of the sale
 * @param {number} [params.soldPrice] Sale price
 * @returns {Promise<Object>} Summary of delist actions taken
 */
async function handleItemSold({ userId, soldPlatform, sku, listingId, title, orderId, orderDate, soldPrice }) {
  const normPlatform = String(soldPlatform || '').toLowerCase().trim();
  const results = {
    foundListing: false,
    updatedMasterListing: false,
    delistActions: {}
  };

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[Auto-Delist] User ${userId} not found.`);
      return results;
    }

    // 1. Locate Master Listing using multi-tier matching (Listing ID -> SKU -> Exact Title -> Prefix -> Token Overlap)
    const userListings = await Listing.find({ user: userId });
    const masterListing = findBestMatchingListing(userListings, {
      listingId,
      sku,
      title,
      platform: normPlatform
    });

    if (masterListing) {
      results.foundListing = true;

      // Check which platforms actually need delisting (only if published/active and not already successfully delisted)
      const shouldDelistMercari = normPlatform !== 'mercari' &&
        Boolean(masterListing.mercariListingId) &&
        (masterListing.mercariStatus === 'published' || masterListing.mercariStatus === 'active') &&
        !masterListing.autoDelistLog?.mercari?.success;

      const shouldDelistPoshmark = normPlatform !== 'poshmark' &&
        Boolean(masterListing.poshmarkListingId) &&
        (masterListing.poshmarkStatus === 'published' || masterListing.poshmarkStatus === 'active') &&
        !masterListing.autoDelistLog?.poshmark?.success;

      const shouldDelistDepop = normPlatform !== 'depop' &&
        Boolean(masterListing.depopListingId) &&
        (masterListing.depopStatus === 'published' || masterListing.depopStatus === 'active') &&
        !masterListing.autoDelistLog?.depop?.success;

      const shouldDelistEtsy = normPlatform !== 'etsy' &&
        Boolean(masterListing.etsyListingId) &&
        (masterListing.etsyStatus === 'published' || masterListing.etsyStatus === 'active') &&
        !masterListing.autoDelistLog?.etsy?.success;

      const shouldDelistEbay = normPlatform !== 'ebay' &&
        Boolean(masterListing.ebayListingId || masterListing.platformData?.ebay?.liveId) &&
        (masterListing.ebayStatus === 'published' || masterListing.ebayStatus === 'active') &&
        !masterListing.autoDelistLog?.ebay?.success;

      const hasAnyPlatformToDelist = shouldDelistMercari || shouldDelistPoshmark || shouldDelistDepop || shouldDelistEtsy || shouldDelistEbay;

      // If already marked as sold and no other connected platforms need delisting, skip redundant operations
      if (masterListing.status === 'sold' && !hasAnyPlatformToDelist) {
        return results;
      }

      console.log(`[Auto-Delist] Matched Master Listing: "${masterListing.title}" (ID: ${masterListing._id}, SKU: ${masterListing.sku})`);

      // Update Local Database master listing to Sold
      masterListing.status = 'sold';
      masterListing.quantity = 0;
      masterListing.soldOn = normPlatform;
      masterListing.soldPlatform = normPlatform;
      if (orderId) masterListing.soldOrderId = String(orderId);
      if (soldPrice) masterListing.soldPrice = parseFloat(soldPrice);
      masterListing.soldAt = orderDate ? new Date(orderDate) : new Date();
      masterListing.errorMessage = `Sold on ${normPlatform.toUpperCase()}${orderId ? ` (Order #${orderId})` : ''}`;

      // Set platform status on the channel where it was sold as 'sold'
      const platField = `${normPlatform}Status`;
      masterListing[platField] = 'sold';
      if (masterListing.platformData?.[normPlatform]) masterListing.platformData[normPlatform].status = 'sold';
      if (masterListing.listingsMap?.[normPlatform]) masterListing.listingsMap[normPlatform].status = 'sold';

      // Set other platform statuses to 'delisted' (never 'sold' on multiple platforms)
      const otherPlatforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'depop', 'amazon'].filter(p => p !== normPlatform);
      for (const op of otherPlatforms) {
        const opStatusField = `${op}Status`;
        const opIdField = `${op}ListingId`;
        if (masterListing[opIdField] || masterListing[opStatusField] === 'published' || masterListing[opStatusField] === 'active') {
          masterListing[opStatusField] = 'delisted';
          if (masterListing.platformData?.[op]) masterListing.platformData[op].status = 'delisted';
          if (masterListing.listingsMap?.[op]) masterListing.listingsMap[op].status = 'delisted';
        }
      }
      
      await masterListing.save();
      results.updatedMasterListing = true;

      // Initialize delist actions from existing log if present
      results.delistActions = typeof masterListing.autoDelistLog === 'object' && !Array.isArray(masterListing.autoDelistLog)
        ? { ...masterListing.autoDelistLog }
        : {};

      // 2. Cross-Delist on all OTHER platforms where this item was listed
      
      // MERCARI Auto-Delist (Deactivate / Stop)
      if (shouldDelistMercari) {
        console.log(`[Auto-Delist] Triggering Mercari deactivation for Item ID: ${masterListing.mercariListingId}...`);
        try {
          if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
            const mercRes = await deactivateMercariListing(masterListing.mercariListingId, user.mercariAccount);
            masterListing.mercariStatus = 'delisted';
            if (masterListing.platformData?.mercari) masterListing.platformData.mercari.status = 'delisted';
            if (masterListing.listingsMap?.mercari) masterListing.listingsMap.mercari.status = 'delisted';
            results.delistActions.mercari = { success: true, status: 'delisted', id: masterListing.mercariListingId, timestamp: new Date() };
            console.log(`[Auto-Delist] Successfully deactivated Mercari listing: ${masterListing.mercariListingId}`);
          } else {
            results.delistActions.mercari = { success: false, reason: 'Mercari account not connected' };
          }
        } catch (mercErr) {
          console.error(`[Auto-Delist] Mercari deactivation failed:`, mercErr.message);
          results.delistActions.mercari = { success: false, error: mercErr.message };
        }
      }

      // POSHMARK Auto-Delist (Mark as "Not for Sale" - NFS, never delete)
      if (shouldDelistPoshmark) {
        console.log(`[Auto-Delist] Triggering Poshmark Not-For-Sale delist for Item ID: ${masterListing.poshmarkListingId}...`);
        try {
          if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
            await delistPoshmarkListing(masterListing.poshmarkListingId, user.poshmarkAccount);
            masterListing.poshmarkStatus = 'delisted';
            if (masterListing.platformData?.poshmark) masterListing.platformData.poshmark.status = 'delisted';
            if (masterListing.listingsMap?.poshmark) masterListing.listingsMap.poshmark.status = 'delisted';
            results.delistActions.poshmark = { success: true, status: 'delisted', id: masterListing.poshmarkListingId, timestamp: new Date() };
            console.log(`[Auto-Delist] Successfully marked Poshmark listing as Not for Sale: ${masterListing.poshmarkListingId}`);
          } else {
            results.delistActions.poshmark = { success: false, reason: 'Poshmark account not connected' };
          }
        } catch (poshErr) {
          console.error(`[Auto-Delist] Poshmark delist failed:`, poshErr.message);
          results.delistActions.poshmark = { success: false, error: poshErr.message };
        }
      }

      // DEPOP Auto-Delist (Set inactive / quantity 0, never delete)
      if (shouldDelistDepop) {
        console.log(`[Auto-Delist] Triggering Depop inactive delist for Item ID: ${masterListing.depopListingId}...`);
        try {
          if (user.depopAccount?.connected) {
            await delistDepopListing(masterListing.depopListingId, user.depopAccount);
            masterListing.depopStatus = 'delisted';
            if (masterListing.platformData?.depop) masterListing.platformData.depop.status = 'delisted';
            if (masterListing.listingsMap?.depop) masterListing.listingsMap.depop.status = 'delisted';
            results.delistActions.depop = { success: true, status: 'delisted', id: masterListing.depopListingId, timestamp: new Date() };
            console.log(`[Auto-Delist] Successfully marked Depop listing as inactive: ${masterListing.depopListingId}`);
          } else {
            results.delistActions.depop = { success: false, reason: 'Depop account not connected' };
          }
        } catch (depopErr) {
          console.error(`[Auto-Delist] Depop delist failed:`, depopErr.message);
          results.delistActions.depop = { success: false, error: depopErr.message };
        }
      }

      // ETSY Auto-Delist (Set inactive state)
      if (shouldDelistEtsy) {
        console.log(`[Auto-Delist] Triggering Etsy deactivation for Item ID: ${masterListing.etsyListingId}...`);
        try {
          if (user.etsyAccount?.connected) {
            const shopId = user.etsyAccount.shopId;
            if (shopId) {
              await updateEtsyListingState(userId, shopId, masterListing.etsyListingId, 'inactive');
              masterListing.etsyStatus = 'delisted';
              if (masterListing.platformData?.etsy) masterListing.platformData.etsy.status = 'delisted';
              if (masterListing.listingsMap?.etsy) masterListing.listingsMap.etsy.status = 'delisted';
              results.delistActions.etsy = { success: true, status: 'inactive', id: masterListing.etsyListingId, timestamp: new Date() };
              console.log(`[Auto-Delist] Successfully deactivated Etsy listing: ${masterListing.etsyListingId}`);
            }
          } else {
            results.delistActions.etsy = { success: false, reason: 'Etsy account not connected' };
          }
        } catch (etsyErr) {
          console.error(`[Auto-Delist] Etsy delist failed:`, etsyErr.message);
          results.delistActions.etsy = { success: false, error: etsyErr.message };
        }
      }

      // EBAY Auto-Delist
      if (shouldDelistEbay) {
        console.log(`[Auto-Delist] Triggering eBay delist for Item ID: ${masterListing.ebayListingId} / SKU: ${masterListing.sku}...`);
        try {
          const ebayToken = await ebayService.getValidEbayToken(userId);
          if (ebayToken) {
            let delistedSuccess = false;
            
            // 1. Trading API EndItem by ItemID
            if (masterListing.ebayListingId) {
              try {
                const endRes = await ebayService.endTradingItem(ebayToken, masterListing.ebayListingId, 'NotAvailable');
                if (endRes.success) {
                  delistedSuccess = true;
                  console.log(`[Auto-Delist] Successfully ended eBay item via Trading API: ${masterListing.ebayListingId}`);
                }
              } catch (endErr) {
                console.warn(`[Auto-Delist] Trading API EndItem attempt failed:`, endErr.message);
              }
            }

            // 2. Offer / Inventory API delisting
            const ebaySku = masterListing.sku || masterListing.platformData?.ebay?.sku;
            if (ebaySku) {
              try {
                const offers = await ebayService.getOffers(ebayToken, ebaySku);
                if (offers && offers.length > 0) {
                  for (const offer of offers) {
                    if (offer.status === 'PUBLISHED') {
                      await ebayService.withdrawOffer(ebayToken, offer.offerId);
                      delistedSuccess = true;
                      console.log(`[Auto-Delist] Successfully withdrew eBay offer: ${offer.offerId}`);
                    }
                  }
                }
                await ebayService.createOrReplaceInventoryItem(ebayToken, ebaySku, {
                  availability: {
                    shipToLocationAvailability: { quantity: 0 }
                  }
                });
                delistedSuccess = true;
              } catch (invErr) {
                console.warn(`[Auto-Delist] Inventory zeroing attempt failed:`, invErr.message);
              }
            }

            masterListing.ebayStatus = 'delisted';
            if (masterListing.platformData?.ebay) {
              masterListing.platformData.ebay.status = 'delisted';
            }
            if (masterListing.listingsMap?.ebay) {
              masterListing.listingsMap.ebay.status = 'delisted';
            }
            results.delistActions.ebay = { success: true, status: 'delisted', id: masterListing.ebayListingId, timestamp: new Date() };
            console.log(`[Auto-Delist] eBay status marked as delisted for ${masterListing._id}`);
          } else {
            results.delistActions.ebay = { success: false, reason: 'eBay token unavailable' };
          }
        } catch (ebayErr) {
          console.error(`[Auto-Delist] eBay delist failed:`, ebayErr.message);
          results.delistActions.ebay = { success: false, error: ebayErr.message };
        }
      }

      // Save delistActions to master listing
      masterListing.autoDelistLog = results.delistActions;
      masterListing.markModified('autoDelistLog');
      masterListing.markModified('platformData');
      masterListing.markModified('listingsMap');
      await masterListing.save();

      // Also attach to Order record for Sold Tracker display
      if (orderId) {
        try {
          const Order = require('../models/Order');
          await Order.findOneAndUpdate(
            { user: userId, orderId: String(orderId) },
            {
              listingId: masterListing._id,
              delistActions: results.delistActions
            }
          );
        } catch (ordErr) {
          console.warn('[Auto-Delist] Failed to update Order record:', ordErr.message);
        }
      }
    }

    // 3. Mark Channel Inventory (Product model cache) as inactive across all channels
    const resolvedSku = sku || masterListing?.sku;
    if (resolvedSku) {
      const updateResult = await Product.updateMany(
        { user: userId, sku: resolvedSku, status: { $ne: 'inactive' } },
        { status: 'inactive', updated_at: Date.now() }
      );
      if (updateResult.modifiedCount > 0) {
        console.log(`[Auto-Delist] Updated ${updateResult.modifiedCount} Product model(s) to inactive for SKU: ${resolvedSku}`);
      }
    }

  } catch (err) {
    console.error(`[Auto-Delist] Uncaught error during auto-delisting:`, err.message);
  }

  return results;
}

module.exports = {
  handleItemSold
};
