const Listing = require('../models/Listing');
const Product = require('../models/Product');
const User = require('../models/User');

const { deactivateMercariListing } = require('./mercariService');
const { deletePoshmarkListing, deleteDepopListing } = require('./backendPublishService');
const { updateListingState: updateEtsyListingState } = require('./etsyService');
const ebayService = require('./ebayService');

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
 * @returns {Promise<Object>} Summary of delist actions taken
 */
async function handleItemSold({ userId, soldPlatform, sku, listingId, title, orderId, orderDate }) {
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

    // 1. Locate Master Listing in Listing Collection
    let masterListing = null;

    // Priority 1: Direct Marketplace Listing ID
    if (listingId && String(listingId).trim()) {
      const cleanId = String(listingId).trim();
      masterListing = await Listing.findOne({
        user: userId,
        $or: [
          { ebayListingId: cleanId },
          { mercariListingId: cleanId },
          { poshmarkListingId: cleanId },
          { depopListingId: cleanId },
          { etsyListingId: cleanId },
          { 'platformData.ebay.liveId': cleanId },
          { 'platformData.poshmark.liveId': cleanId },
          { 'platformData.mercari.liveId': cleanId }
        ]
      });
    }

    // Priority 2: Exact Title
    if (!masterListing && title && String(title).trim()) {
      masterListing = await Listing.findOne({
        user: userId,
        title: String(title).trim()
      });
    }

    // Priority 3: SKU (with title validation if multiple listings share same SKU/date)
    if (!masterListing && sku && String(sku).trim() && String(sku).trim() !== 'None') {
      const cleanSku = String(sku).trim();
      const candidates = await Listing.find({
        user: userId,
        sku: cleanSku
      });

      if (candidates.length === 1) {
        // If title is available, verify it's not a completely different category/item
        if (title) {
          const orderWords = String(title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const candTitle = (candidates[0].title || '').toLowerCase();
          const overlap = orderWords.filter(w => candTitle.includes(w)).length;
          if (overlap >= 1 || orderWords.length === 0) {
            masterListing = candidates[0];
          }
        } else {
          masterListing = candidates[0];
        }
      } else if (candidates.length > 1 && title) {
        // Find best title match among candidates sharing same SKU
        const orderWords = String(title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
        let bestMatch = null;
        let maxOverlap = 0;
        for (const cand of candidates) {
          const candTitle = (cand.title || '').toLowerCase();
          const overlap = orderWords.filter(w => candTitle.includes(w)).length;
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = cand;
          }
        }
        if (maxOverlap >= 1) {
          masterListing = bestMatch;
        }
      }
    }

    if (masterListing) {
      // Guard: If this order was created before the master listing was imported/created in Master DB, skip marking it as sold
      if (orderDate && masterListing.createdAt) {
        const oTime = new Date(orderDate).getTime();
        const lTime = new Date(masterListing.createdAt).getTime();
        if (oTime < (lTime - 10 * 60 * 1000)) {
          console.log(`[Auto-Delist] Order #${orderId} date (${new Date(oTime).toISOString()}) is before listing import date (${new Date(lTime).toISOString()}). Skipping auto-delist to protect active listing.`);
          return results;
        }
      }

      results.foundListing = true;
      console.log(`[Auto-Delist] Matched Master Listing: "${masterListing.title}" (ID: ${masterListing._id}, SKU: ${masterListing.sku})`);

      // Update Local Database master listing to Sold
      masterListing.status = 'sold';
      masterListing.quantity = 0;
      masterListing.soldOn = normPlatform;
      masterListing.soldPlatform = normPlatform;
      masterListing.soldAt = orderDate ? new Date(orderDate) : new Date();
      masterListing.errorMessage = `Sold on ${normPlatform.toUpperCase()}${orderId ? ` (Order #${orderId})` : ''}`;

      // Set platform status on the channel where it was sold
      if (normPlatform === 'poshmark') {
        masterListing.poshmarkStatus = 'sold';
        if (masterListing.platformData?.poshmark) masterListing.platformData.poshmark.status = 'sold';
      } else if (normPlatform === 'ebay') {
        masterListing.ebayStatus = 'sold';
        if (masterListing.platformData?.ebay) masterListing.platformData.ebay.status = 'sold';
      } else if (normPlatform === 'mercari') {
        masterListing.mercariStatus = 'sold';
        if (masterListing.platformData?.mercari) masterListing.platformData.mercari.status = 'sold';
      } else if (normPlatform === 'etsy') {
        masterListing.etsyStatus = 'sold';
        if (masterListing.platformData?.etsy) masterListing.platformData.etsy.status = 'sold';
      } else if (normPlatform === 'depop') {
        masterListing.depopStatus = 'sold';
        if (masterListing.platformData?.depop) masterListing.platformData.depop.status = 'sold';
      }
      
      await masterListing.save();
      results.updatedMasterListing = true;

      // 2. Cross-Delist on all OTHER platforms where this item was listed
      
      // MERCARI Auto-Delist
      if (normPlatform !== 'mercari' && masterListing.mercariListingId && (masterListing.mercariStatus === 'published' || masterListing.mercariStatus === 'active' || masterListing.platform === 'mercari')) {
        console.log(`[Auto-Delist] Triggering Mercari deactivation for Item ID: ${masterListing.mercariListingId}...`);
        try {
          if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
            const mercRes = await deactivateMercariListing(masterListing.mercariListingId, user.mercariAccount);
            masterListing.mercariStatus = 'delisted';
            if (masterListing.platformData?.mercari) masterListing.platformData.mercari.status = 'delisted';
            await masterListing.save();
            results.delistActions.mercari = { success: true, status: 'delisted', id: masterListing.mercariListingId };
            console.log(`[Auto-Delist] Successfully deactivated Mercari listing: ${masterListing.mercariListingId}`);
          } else {
            results.delistActions.mercari = { success: false, reason: 'Mercari account not connected' };
          }
        } catch (mercErr) {
          console.error(`[Auto-Delist] Mercari deactivation failed:`, mercErr.message);
          results.delistActions.mercari = { success: false, error: mercErr.message };
        }
      }

      // POSHMARK Auto-Delist
      if (normPlatform !== 'poshmark' && masterListing.poshmarkListingId && (masterListing.poshmarkStatus === 'published' || masterListing.platform === 'poshmark')) {
        console.log(`[Auto-Delist] Triggering Poshmark deletion/delist for Item ID: ${masterListing.poshmarkListingId}...`);
        try {
          if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
            await deletePoshmarkListing(masterListing.poshmarkListingId, user.poshmarkAccount);
            masterListing.poshmarkStatus = 'delisted';
            if (masterListing.platformData?.poshmark) masterListing.platformData.poshmark.status = 'delisted';
            await masterListing.save();
            results.delistActions.poshmark = { success: true, status: 'delisted', id: masterListing.poshmarkListingId };
            console.log(`[Auto-Delist] Successfully delisted Poshmark listing: ${masterListing.poshmarkListingId}`);
          } else {
            results.delistActions.poshmark = { success: false, reason: 'Poshmark account not connected' };
          }
        } catch (poshErr) {
          console.error(`[Auto-Delist] Poshmark delist failed:`, poshErr.message);
          results.delistActions.poshmark = { success: false, error: poshErr.message };
        }
      }

      // DEPOP Auto-Delist
      if (normPlatform !== 'depop' && masterListing.depopListingId && (masterListing.depopStatus === 'published' || masterListing.platform === 'depop')) {
        console.log(`[Auto-Delist] Triggering Depop deletion for Item ID: ${masterListing.depopListingId}...`);
        try {
          if (user.depopAccount?.connected) {
            await deleteDepopListing(masterListing.depopListingId, user.depopAccount);
            masterListing.depopStatus = 'delisted';
            if (masterListing.platformData?.depop) masterListing.platformData.depop.status = 'delisted';
            await masterListing.save();
            results.delistActions.depop = { success: true, status: 'delisted', id: masterListing.depopListingId };
            console.log(`[Auto-Delist] Successfully deleted Depop listing: ${masterListing.depopListingId}`);
          } else {
            results.delistActions.depop = { success: false, reason: 'Depop account not connected' };
          }
        } catch (depopErr) {
          console.error(`[Auto-Delist] Depop delist failed:`, depopErr.message);
          results.delistActions.depop = { success: false, error: depopErr.message };
        }
      }

      // ETSY Auto-Delist
      if (normPlatform !== 'etsy' && masterListing.etsyListingId && (masterListing.etsyStatus === 'published' || masterListing.platform === 'etsy')) {
        console.log(`[Auto-Delist] Triggering Etsy deactivation for Item ID: ${masterListing.etsyListingId}...`);
        try {
          if (user.etsyAccount?.connected) {
            const shopId = user.etsyAccount.shopId;
            if (shopId) {
              await updateEtsyListingState(userId, shopId, masterListing.etsyListingId, 'inactive');
              masterListing.etsyStatus = 'delisted';
              if (masterListing.platformData?.etsy) masterListing.platformData.etsy.status = 'delisted';
              await masterListing.save();
              results.delistActions.etsy = { success: true, status: 'inactive', id: masterListing.etsyListingId };
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
      if (normPlatform !== 'ebay' && (masterListing.ebayListingId || masterListing.sku || masterListing.platform === 'ebay')) {
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
            await masterListing.save();
            results.delistActions.ebay = { success: true, status: 'delisted', id: masterListing.ebayListingId };
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
