const Listing = require('../models/Listing');
const Product = require('../models/Product');
const User = require('../models/User');

const { deactivateMercariListing } = require('./mercariService');
const { delistPoshmarkListing, delistDepopListing } = require('./backendPublishService');
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
          { 'platformData.mercari.liveId': cleanId },
          { 'platformData.etsy.liveId': cleanId },
          { 'platformData.depop.liveId': cleanId }
        ]
      });
    }

    // Helper for title keyword tokenization
    const getSignificantTokens = (t) => {
      if (!t) return [];
      const stopWords = new Set([
        'mens', 'men', 'womens', 'women', 'shirt', 'pants', 'pant', 'jacket', 'coat', 'sweater',
        'shoes', 'boots', 'size', 'with', 'and', 'the', 'for', 'good', 'preowned', 'cotton',
        'vintage', 'black', 'white', 'blue', 'gray', 'grey', 'brown', 'red', 'green', 'yellow',
        'used', 'new', 'condition', 'long', 'sleeve', 'short', 'front', 'back', 'neck', 'fit'
      ]);
      return String(t)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
    };

    const areTitlesSimilar = (t1, t2) => {
      if (!t1 || !t2) return false;
      const tok1 = getSignificantTokens(t1);
      const tok2 = getSignificantTokens(t2);
      if (tok1.length === 0 || tok2.length === 0) {
        return t1.trim().toLowerCase() === t2.trim().toLowerCase();
      }
      const set2 = new Set(tok2);
      const common = tok1.filter(w => set2.has(w));
      const minLen = Math.min(tok1.length, tok2.length);
      return common.length >= 2 || (common.length >= 1 && minLen <= 2) || (common.length / minLen >= 0.5);
    };

    // Priority 2: Case-insensitive Exact Title
    if (!masterListing && title && String(title).trim()) {
      const cleanTitle = String(title).trim();
      masterListing = await Listing.findOne({
        user: userId,
        title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }

    // Priority 3: SKU Match
    if (!masterListing && sku && String(sku).trim() && String(sku).trim() !== 'None' && String(sku).trim() !== '-') {
      const cleanSku = String(sku).trim();
      const candidates = await Listing.find({
        user: userId,
        sku: { $regex: new RegExp(`^${cleanSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });

      if (candidates.length === 1) {
        if (title) {
          if (areTitlesSimilar(title, candidates[0].title)) {
            masterListing = candidates[0];
          } else {
            // Still accept if SKU is unique and title is somewhat related
            masterListing = candidates[0];
          }
        } else {
          masterListing = candidates[0];
        }
      } else if (candidates.length > 1 && title) {
        let bestMatch = null;
        for (const cand of candidates) {
          if (areTitlesSimilar(title, cand.title)) {
            bestMatch = cand;
            break;
          }
        }
        masterListing = bestMatch || candidates[0];
      }
    }

    // Priority 4: Fuzzy Title Match
    if (!masterListing && title && String(title).trim()) {
      const allListings = await Listing.find({ user: userId }).select('title sku status');
      for (const cand of allListings) {
        if (areTitlesSimilar(title, cand.title)) {
          masterListing = cand;
          break;
        }
      }
    }

    if (masterListing) {
      results.foundListing = true;
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

      // Set platform status on the channel where it was sold
      if (normPlatform === 'poshmark') {
        masterListing.poshmarkStatus = 'sold';
        if (masterListing.platformData?.poshmark) masterListing.platformData.poshmark.status = 'sold';
        if (masterListing.listingsMap?.poshmark) masterListing.listingsMap.poshmark.status = 'sold';
      } else if (normPlatform === 'ebay') {
        masterListing.ebayStatus = 'sold';
        if (masterListing.platformData?.ebay) masterListing.platformData.ebay.status = 'sold';
        if (masterListing.listingsMap?.ebay) masterListing.listingsMap.ebay.status = 'sold';
      } else if (normPlatform === 'mercari') {
        masterListing.mercariStatus = 'sold';
        if (masterListing.platformData?.mercari) masterListing.platformData.mercari.status = 'sold';
        if (masterListing.listingsMap?.mercari) masterListing.listingsMap.mercari.status = 'sold';
      } else if (normPlatform === 'etsy') {
        masterListing.etsyStatus = 'sold';
        if (masterListing.platformData?.etsy) masterListing.platformData.etsy.status = 'sold';
        if (masterListing.listingsMap?.etsy) masterListing.listingsMap.etsy.status = 'sold';
      } else if (normPlatform === 'depop') {
        masterListing.depopStatus = 'sold';
        if (masterListing.platformData?.depop) masterListing.platformData.depop.status = 'sold';
        if (masterListing.listingsMap?.depop) masterListing.listingsMap.depop.status = 'sold';
      }
      
      await masterListing.save();
      results.updatedMasterListing = true;

      // 2. Cross-Delist on all OTHER platforms where this item was listed
      
      // MERCARI Auto-Delist (Deactivate / Stop)
      if (normPlatform !== 'mercari' && masterListing.mercariListingId && (masterListing.mercariStatus === 'published' || masterListing.mercariStatus === 'active' || masterListing.platform === 'mercari')) {
        console.log(`[Auto-Delist] Triggering Mercari deactivation for Item ID: ${masterListing.mercariListingId}...`);
        try {
          if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
            const mercRes = await deactivateMercariListing(masterListing.mercariListingId, user.mercariAccount);
            masterListing.mercariStatus = 'delisted';
            if (masterListing.platformData?.mercari) masterListing.platformData.mercari.status = 'delisted';
            if (masterListing.listingsMap?.mercari) masterListing.listingsMap.mercari.status = 'delisted';
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

      // POSHMARK Auto-Delist (Mark as "Not for Sale" - NFS, never delete)
      if (normPlatform !== 'poshmark' && masterListing.poshmarkListingId && (masterListing.poshmarkStatus === 'published' || masterListing.platform === 'poshmark')) {
        console.log(`[Auto-Delist] Triggering Poshmark Not-For-Sale delist for Item ID: ${masterListing.poshmarkListingId}...`);
        try {
          if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
            await delistPoshmarkListing(masterListing.poshmarkListingId, user.poshmarkAccount);
            masterListing.poshmarkStatus = 'delisted';
            if (masterListing.platformData?.poshmark) masterListing.platformData.poshmark.status = 'delisted';
            if (masterListing.listingsMap?.poshmark) masterListing.listingsMap.poshmark.status = 'delisted';
            await masterListing.save();
            results.delistActions.poshmark = { success: true, status: 'delisted', id: masterListing.poshmarkListingId };
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
      if (normPlatform !== 'depop' && masterListing.depopListingId && (masterListing.depopStatus === 'published' || masterListing.platform === 'depop')) {
        console.log(`[Auto-Delist] Triggering Depop inactive delist for Item ID: ${masterListing.depopListingId}...`);
        try {
          if (user.depopAccount?.connected) {
            await delistDepopListing(masterListing.depopListingId, user.depopAccount);
            masterListing.depopStatus = 'delisted';
            if (masterListing.platformData?.depop) masterListing.platformData.depop.status = 'delisted';
            if (masterListing.listingsMap?.depop) masterListing.listingsMap.depop.status = 'delisted';
            await masterListing.save();
            results.delistActions.depop = { success: true, status: 'delisted', id: masterListing.depopListingId };
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
      if (normPlatform !== 'etsy' && masterListing.etsyListingId && (masterListing.etsyStatus === 'published' || masterListing.platform === 'etsy')) {
        console.log(`[Auto-Delist] Triggering Etsy deactivation for Item ID: ${masterListing.etsyListingId}...`);
        try {
          if (user.etsyAccount?.connected) {
            const shopId = user.etsyAccount.shopId;
            if (shopId) {
              await updateEtsyListingState(userId, shopId, masterListing.etsyListingId, 'inactive');
              masterListing.etsyStatus = 'delisted';
              if (masterListing.platformData?.etsy) masterListing.platformData.etsy.status = 'delisted';
              if (masterListing.listingsMap?.etsy) masterListing.listingsMap.etsy.status = 'delisted';
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
            if (masterListing.listingsMap?.ebay) {
              masterListing.listingsMap.ebay.status = 'delisted';
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
