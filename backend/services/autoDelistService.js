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
async function handleItemSold({ userId, soldPlatform, sku, listingId, title, orderId }) {
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
    const queryConditions = [];
    if (sku) {
      queryConditions.push({ sku: sku.trim() });
    }
    if (listingId) {
      queryConditions.push({ ebayListingId: listingId });
      queryConditions.push({ mercariListingId: listingId });
      queryConditions.push({ poshmarkListingId: listingId });
      queryConditions.push({ depopListingId: listingId });
      queryConditions.push({ etsyListingId: listingId });
    }
    if (title) {
      queryConditions.push({ title: title.trim() });
    }

    let masterListing = null;
    if (queryConditions.length > 0) {
      masterListing = await Listing.findOne({
        user: userId,
        $or: queryConditions
      });
    }

    if (masterListing) {
      results.foundListing = true;
      console.log(`[Auto-Delist] Matched Master Listing: "${masterListing.title}" (ID: ${masterListing._id}, SKU: ${masterListing.sku})`);

      // Update Local Database master listing to Sold / Delisted
      masterListing.status = 'delisted';
      masterListing.quantity = 0;
      masterListing.soldOn = normPlatform;
      masterListing.soldAt = new Date();
      masterListing.errorMessage = `Sold on ${normPlatform.toUpperCase()}${orderId ? ` (Order #${orderId})` : ''}`;
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

      // EBAY Auto-Delist (Quantity to 0 or end offer)
      if (normPlatform !== 'ebay' && masterListing.ebayListingId && (masterListing.ebayStatus === 'published' || masterListing.platform === 'ebay')) {
        console.log(`[Auto-Delist] Triggering eBay inventory zeroing for SKU: ${masterListing.sku}...`);
        try {
          const ebayToken = await ebayService.getValidEbayToken(userId);
          if (ebayToken && masterListing.sku) {
            await ebayService.createOrReplaceInventoryItem(ebayToken, masterListing.sku, {
              availability: {
                shipToLocationAvailability: { quantity: 0 }
              }
            });
            masterListing.ebayStatus = 'delisted';
            await masterListing.save();
            results.delistActions.ebay = { success: true, status: 'zeroed_quantity', sku: masterListing.sku };
            console.log(`[Auto-Delist] Successfully zeroed eBay quantity for SKU: ${masterListing.sku}`);
          }
        } catch (ebayErr) {
          console.error(`[Auto-Delist] eBay inventory zeroing failed:`, ebayErr.message);
          results.delistActions.ebay = { success: false, error: ebayErr.message };
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
