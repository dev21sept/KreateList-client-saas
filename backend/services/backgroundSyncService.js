const cron = require('node-cron');
const User = require('../models/User');
const Order = require('../models/Order');
const Listing = require('../models/Listing');
const Product = require('../models/Product');
const { syncOrders: syncEbayOrders, syncInventory: syncEbayInventory } = require('../controllers/ebayController');
const { syncMercariOrders, scrapeMercariCloset } = require('./mercariService');
const { syncPoshmarkOrders } = require('./poshmarkOrderService');
const { syncEtsyInventory } = require('../controllers/etsyController');
const { scrapePoshmarkCloset } = require('./externalImportService');
const { findBestMatchingListing } = require('../utils/listingMatcher');

let isOrdersSyncRunning = false;
let isInventorySyncRunning = false;
let lastOrdersSyncTime = null;
let ordersCronTask = null;
let inventoryCronTask = null;

/**
 * Reconciles all Orders for a user with Master Listings with SMART MULTI-TIER MATCHING.
 * - Ensures genuine sold orders accurately reflect as `status: 'sold'` in Master Crosslisting.
 * - Sets the selling channel as 'sold' and all other connected channels as 'delisted'.
 * - Self-heals/restores any false-positive sold listings that do not match a genuine order.
 */
async function reconcileOrdersAndMasterListings(userId) {
  try {
    const orders = await Order.find({
      user: userId,
      $or: [
        { createdDate: { $gte: new Date('2026-09-01T00:00:00.000Z') } },
        { orderDate: { $gte: new Date('2026-09-01T00:00:00.000Z') } },
        { createdAt: { $gte: new Date('2026-09-01T00:00:00.000Z') }, createdDate: { $exists: false } }
      ]
    });
    const listings = await Listing.find({ user: userId });

    // Active store products guard
    const activeProducts = await Product.find({
      user: userId,
      status: { $in: ['active', 'live', 'published'] }
    }).lean();

    const activeEbayIds = new Set(activeProducts.map(p => p.ebayListingId).filter(Boolean));
    const activePoshIds = new Set(activeProducts.map(p => p.poshmarkListingId).filter(Boolean));
    const activeMercIds = new Set(activeProducts.map(p => p.mercariListingId).filter(Boolean));
    const activeTitles = new Set(activeProducts.map(p => (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()));

    const isListingLiveInStore = (l) => {
      if (!l) return false;
      if (l.ebayListingId && activeEbayIds.has(l.ebayListingId)) return true;
      if (l.poshmarkListingId && activePoshIds.has(l.poshmarkListingId)) return true;
      if (l.mercariListingId && activeMercIds.has(l.mercariListingId)) return true;
      const norm = (l.title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      return activeTitles.has(norm);
    };

    const matchedListingIds = new Set();
    let reconciledCount = 0;

    for (const order of orders) {
      const lineItem = order.lineItems?.[0];
      const ordSku = lineItem?.sku || order.sku || '';
      const ordItemId = String(lineItem?.legacyItemId || lineItem?.lineItemId || order.platformListingId || '').trim();
      const ordTitle = lineItem?.title || order.title || order.productTitle || '';
      const normPlatform = String(order.platform || 'ebay').toLowerCase();

      // Find matching listing using multi-tier matching (Listing ID -> SKU -> Exact Title -> Prefix -> Token Overlap)
      let match = findBestMatchingListing(listings, {
        listingId: ordItemId,
        sku: ordSku,
        title: ordTitle,
        platform: normPlatform
      });

      // If not found and order has multiple line items, check each line item
      if (!match && Array.isArray(order.lineItems) && order.lineItems.length > 1) {
        for (const item of order.lineItems) {
          match = findBestMatchingListing(listings, {
            listingId: item.lineItemId || item.legacyItemId,
            sku: item.sku,
            title: item.title,
            platform: normPlatform
          });
          if (match) break;
        }
      }

      // If matched listing is currently LIVE in seller store, do NOT mark as sold
      if (match && isListingLiveInStore(match)) {
        continue;
      }

      if (match) {
        matchedListingIds.add(match._id.toString());

        // Link order
        if (!order.listingId || order.listingId.toString() !== match._id.toString()) {
          order.listingId = match._id;
          await order.save();
        }

        // Mark Master Listing as Sold
        let listingChanged = false;
        if (match.status !== 'sold') {
          match.status = 'sold';
          match.quantity = 0;
          match.soldOn = normPlatform;
          match.soldPlatform = normPlatform;
          match.soldOrderId = order.orderId;
          match.soldPrice = parseFloat(order.totalAmount || match.price || 0);
          match.soldAt = order.createdDate || order.createdAt || new Date();
          match.errorMessage = `Sold on ${normPlatform.toUpperCase()} (Order #${order.orderId})`;
          listingChanged = true;
        }

        // Set Sold Platform as 'sold'
        const platField = `${normPlatform}Status`;
        if (match[platField] !== 'sold') {
          match[platField] = 'sold';
          if (match.platformData?.[normPlatform]) match.platformData[normPlatform].status = 'sold';
          if (match.listingsMap?.[normPlatform]) match.listingsMap[normPlatform].status = 'sold';
          listingChanged = true;
        }

        // Set ALL OTHER platforms as 'delisted' (never 'sold' on multiple platforms)
        const otherPlatforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'depop', 'amazon'].filter(p => p !== normPlatform);
        for (const op of otherPlatforms) {
          const opStatusField = `${op}Status`;
          const opIdField = `${op}ListingId`;
          if (match[opIdField] || match[opStatusField] === 'published' || match[opStatusField] === 'active') {
            if (match[opStatusField] !== 'delisted') {
              match[opStatusField] = 'delisted';
              if (match.platformData?.[op]) match.platformData[op].status = 'delisted';
              if (match.listingsMap?.[op]) match.listingsMap[op].status = 'delisted';
              listingChanged = true;
            }
          }
        }

        if (listingChanged) {
          match.markModified('platformData');
          match.markModified('listingsMap');
          await match.save();
          reconciledCount++;
        }
      } else {
        // If order does not match any Master Crosslisting listing, un-link listingId
        if (order.listingId) {
          order.listingId = null;
          await order.save();
        }
      }
    }

    // Self-healing: If a master listing is marked 'sold' but is NOT in matchedListingIds,
    // restore it immediately to 'published' with quantity 1
    let restoredCount = 0;
    for (const l of listings) {
      if (l.status === 'sold' && !matchedListingIds.has(l._id.toString())) {
        l.status = 'published';
        l.quantity = 1;
        l.soldOn = null;
        l.soldOrderId = null;
        l.soldAt = null;
        l.soldPlatform = null;
        l.errorMessage = null;

        // Restore platform statuses for all connected platforms (both 'sold' and 'delisted' false positives)
        if (l.ebayListingId && (l.ebayStatus === 'sold' || l.ebayStatus === 'delisted')) {
          l.ebayStatus = 'published';
          if (l.platformData?.ebay) l.platformData.ebay.status = 'published';
          if (l.listingsMap?.ebay) l.listingsMap.ebay.status = 'published';
        }
        if (l.poshmarkListingId && (l.poshmarkStatus === 'sold' || l.poshmarkStatus === 'delisted')) {
          l.poshmarkStatus = 'published';
          if (l.platformData?.poshmark) l.platformData.poshmark.status = 'published';
          if (l.listingsMap?.poshmark) l.listingsMap.poshmark.status = 'published';
        }
        if (l.mercariListingId && (l.mercariStatus === 'sold' || l.mercariStatus === 'delisted')) {
          l.mercariStatus = 'published';
          if (l.platformData?.mercari) l.platformData.mercari.status = 'published';
          if (l.listingsMap?.mercari) l.listingsMap.mercari.status = 'published';
        }
        if (l.etsyListingId && (l.etsyStatus === 'sold' || l.etsyStatus === 'delisted')) {
          l.etsyStatus = 'published';
          if (l.platformData?.etsy) l.platformData.etsy.status = 'published';
          if (l.listingsMap?.etsy) l.listingsMap.etsy.status = 'published';
        }
        if (l.depopListingId && (l.depopStatus === 'sold' || l.depopStatus === 'delisted')) {
          l.depopStatus = 'published';
          if (l.platformData?.depop) l.platformData.depop.status = 'published';
          if (l.listingsMap?.depop) l.listingsMap.depop.status = 'published';
        }

        l.markModified('platformData');
        l.markModified('listingsMap');
        await l.save();
        restoredCount++;
      } else if (l.status === 'published' && !matchedListingIds.has(l._id.toString())) {
        // Also self-heal any published/active master listing whose channel status was falsely left as 'sold' or 'delisted'
        let platChanged = false;
        const platforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'depop'];
        for (const p of platforms) {
          const idField = `${p}ListingId`;
          const statusField = `${p}Status`;
          if (l[idField] && (l[statusField] === 'sold' || l[statusField] === 'delisted')) {
            l[statusField] = 'published';
            if (l.platformData?.[p]) l.platformData[p].status = 'published';
            if (l.listingsMap?.[p]) l.listingsMap[p].status = 'published';
            platChanged = true;
          }
        }
        if (platChanged) {
          l.markModified('platformData');
          l.markModified('listingsMap');
          await l.save();
          restoredCount++;
        }
      }
    }

    if (reconciledCount > 0 || restoredCount > 0) {
      console.log(`[Order Reconciler] User: ${userId} => Reconciled ${reconciledCount} real sold items, Restored/Fixed ${restoredCount} listings.`);
    }
  } catch (err) {
    console.error('[Order Reconciler] Error reconciling orders with listings:', err.message);
  }
}

/**
 * Rechecks and synchronizes platform statuses across Master Listings.
 */
async function recheckMasterListingStatuses(userId) {
  try {
    const listings = await Listing.find({ user: userId });

    let updatedCount = 0;
    for (const listing of listings) {
      let changed = false;

      // 1. Check eBay status
      if (listing.ebayListingId) {
        const ebayProd = await Product.findOne({ user: userId, ebayListingId: listing.ebayListingId, source: 'ebay' });
        if (ebayProd) {
          if (ebayProd.status === 'sold') {
            if (listing.ebayStatus !== 'sold') {
              listing.ebayStatus = 'sold';
              if (listing.platformData?.ebay) listing.platformData.ebay.status = 'sold';
              changed = true;
            }
          } else if ((ebayProd.status === 'active' || ebayProd.status === 'live') && listing.status !== 'sold') {
            if (listing.ebayStatus !== 'published') {
              listing.ebayStatus = 'published';
              if (listing.platformData?.ebay) listing.platformData.ebay.status = 'published';
              changed = true;
            }
          } else if (listing.status !== 'sold' && listing.ebayStatus === 'delisted' && ebayProd.status !== 'sold') {
            // Restore false-positive delisted item
            listing.ebayStatus = 'published';
            if (listing.platformData?.ebay) listing.platformData.ebay.status = 'published';
            changed = true;
          }
        } else if (listing.status !== 'sold' && listing.ebayStatus !== 'published') {
          listing.ebayStatus = 'published';
          if (listing.platformData?.ebay) listing.platformData.ebay.status = 'published';
          changed = true;
        }
      }

      // 2. Check Poshmark status
      if (listing.poshmarkListingId) {
        const poshProd = await Product.findOne({ user: userId, poshmarkListingId: listing.poshmarkListingId, source: 'poshmark' });
        if (poshProd) {
          if (poshProd.status === 'sold') {
            if (listing.poshmarkStatus !== 'sold') {
              listing.poshmarkStatus = 'sold';
              if (listing.platformData?.poshmark) listing.platformData.poshmark.status = 'sold';
              changed = true;
            }
          } else if ((poshProd.status === 'active' || poshProd.status === 'live') && listing.status !== 'sold') {
            if (listing.poshmarkStatus !== 'published') {
              listing.poshmarkStatus = 'published';
              if (listing.platformData?.poshmark) listing.platformData.poshmark.status = 'published';
              changed = true;
            }
          }
        }
      }

      // 3. Check Mercari status
      if (listing.mercariListingId) {
        const mercProd = await Product.findOne({ user: userId, mercariListingId: listing.mercariListingId, source: 'mercari' });
        if (mercProd) {
          if (mercProd.status === 'sold') {
            if (listing.mercariStatus !== 'sold') {
              listing.mercariStatus = 'sold';
              if (listing.platformData?.mercari) listing.platformData.mercari.status = 'sold';
              changed = true;
            }
          } else if ((mercProd.status === 'active' || mercProd.status === 'live') && listing.status !== 'sold') {
            if (listing.mercariStatus !== 'published') {
              listing.mercariStatus = 'published';
              if (listing.platformData?.mercari) listing.platformData.mercari.status = 'published';
              changed = true;
            }
          }
        }
      }

      // 4. Check Etsy status
      if (listing.etsyListingId) {
        const etsyProd = await Product.findOne({ user: userId, etsyListingId: listing.etsyListingId, source: 'etsy' });
        if (etsyProd) {
          if (etsyProd.status === 'sold') {
            if (listing.etsyStatus !== 'sold') {
              listing.etsyStatus = 'sold';
              if (listing.platformData?.etsy) listing.platformData.etsy.status = 'sold';
              changed = true;
            }
          } else if ((etsyProd.status === 'active' || etsyProd.status === 'live') && listing.status !== 'sold') {
            if (listing.etsyStatus !== 'published') {
              listing.etsyStatus = 'published';
              if (listing.platformData?.etsy) listing.platformData.etsy.status = 'published';
              changed = true;
            }
          }
        }
      }

      // 5. Check Depop status
      if (listing.depopListingId) {
        const depopProd = await Product.findOne({ user: userId, depopListingId: listing.depopListingId, source: 'depop' });
        if (depopProd) {
          if (depopProd.status === 'inactive' || depopProd.status === 'sold') {
            const targetStat = depopProd.status === 'sold' ? 'sold' : 'delisted';
            if (listing.depopStatus !== targetStat) {
              listing.depopStatus = targetStat;
              if (listing.platformData?.depop) listing.platformData.depop.status = targetStat;
              changed = true;
            }
          } else if ((depopProd.status === 'active' || depopProd.status === 'live') && listing.status !== 'sold') {
            if (listing.depopStatus !== 'published') {
              listing.depopStatus = 'published';
              if (listing.platformData?.depop) listing.platformData.depop.status = 'published';
              changed = true;
            }
          }
        }
      }

      if (changed) {
        listing.markModified('platformData');
        listing.markModified('listingsMap');
        await listing.save();
        updatedCount++;
      }
    }

    // Always run order-to-listing reconciliation to ensure all sold items are synced
    await reconcileOrdersAndMasterListings(userId);

    if (updatedCount > 0) {
      console.log(`[Status Recheck] Updated ${updatedCount} master listing(s) after channel status verification.`);
    }
  } catch (err) {
    console.error('[Status Recheck] Error rechecking listing statuses:', err.message);
  }
}

/**
 * Executes a full sales/orders sync cycle for all connected users (Every 10 min 24/7).
 */
async function runBackgroundSyncCycle() {
  // Watchdog: If previous cycle has been running for > 5 minutes, force release lock
  if (isOrdersSyncRunning) {
    if (lastOrdersSyncTime && Date.now() - lastOrdersSyncTime > 300000) {
      console.warn('[Background Sales Worker] Previous cycle timed out (>5 min). Force resetting lock.');
      isOrdersSyncRunning = false;
    } else {
      console.log('[Background Sales Worker] Previous sales sync cycle is still running. Skipping this tick.');
      return;
    }
  }

  isOrdersSyncRunning = true;
  lastOrdersSyncTime = Date.now();

  try {
    const users = await User.find({
      $or: [
        { 'ebayAccount.connected': true },
        { 'ebay.connected': true },
        { 'poshmarkAccount.connected': true },
        { 'mercariAccount.connected': true },
        { 'depopAccount.connected': true },
        { 'etsyAccount.connected': true }
      ]
    });

    for (const user of users) {
      try {
        const userId = user._id.toString();

        // 1. eBay Orders Sync
        const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
        if (isEbayConnected) {
          try {
            await syncEbayOrders({ user: { id: userId } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Sales Worker] eBay sales sync notice for ${user.email}:`, ebayErr.message);
          }
        }

        // 2. Mercari Orders Sync
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          try {
            await syncMercariOrders(user.mercariAccount, userId);
          } catch (mercErr) {
            console.warn(`[Background Sales Worker] Mercari sales sync notice for ${user.email}:`, mercErr.message);
          }
        }

        // 3. Poshmark Orders Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
          try {
            await syncPoshmarkOrders(user.poshmarkAccount, userId);
          } catch (poshErr) {
            console.warn(`[Background Sales Worker] Poshmark sales sync notice for ${user.email}:`, poshErr.message);
          }
        }

        // 4. Reconcile Orders with Master Listings
        await reconcileOrdersAndMasterListings(userId);

      } catch (userErr) {
        console.error(`[Background Sales Worker] Error processing user ${user.email}:`, userErr.message);
      }
    }
  } catch (err) {
    console.error('[Background Sales Worker] Fatal error during sales sync cycle:', err.message);
  } finally {
    isOrdersSyncRunning = false;
  }
}

/**
 * Executes an automated 30-minute All-Platform Inventory Sync & Status Recheck.
 */
async function runBackgroundInventorySyncCycle() {
  if (isInventorySyncRunning) {
    return;
  }

  isInventorySyncRunning = true;

  try {
    const users = await User.find({
      $or: [
        { 'ebayAccount.connected': true },
        { 'ebay.connected': true },
        { 'poshmarkAccount.connected': true },
        { 'mercariAccount.connected': true },
        { 'etsyAccount.connected': true },
        { 'amazonAccount.connected': true },
        { 'depopAccount.connected': true }
      ]
    });

    for (const user of users) {
      try {
        const userId = user._id.toString();

        // 1. eBay Inventory Sync
        const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
        if (isEbayConnected) {
          try {
            await syncEbayInventory({ user: { id: userId } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Inventory Worker] eBay inventory sync notice:`, ebayErr.message);
          }
        }

        // 2. Etsy Inventory Sync
        if (user.etsyAccount?.connected && user.etsyAccount?.shopId) {
          try {
            await syncEtsyInventory({ user: { id: userId } }, null);
          } catch (etsyErr) {
            console.warn(`[Background Inventory Worker] Etsy inventory sync notice:`, etsyErr.message);
          }
        }

        // 3. Poshmark Inventory Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.username) {
          try {
            console.log(`[Background Inventory Worker] Syncing Poshmark closet for @${user.poshmarkAccount.username}...`);
            const scraped = await scrapePoshmarkCloset(user.poshmarkAccount.username, user.poshmarkAccount);
            if (Array.isArray(scraped) && scraped.length > 0) {
              const activePoshIds = new Set(scraped.filter(i => i.status === 'active').map(i => i.poshmarkListingId).filter(Boolean));
              
              const poshOps = scraped.map(item => ({
                updateOne: {
                  filter: { user: userId, source: 'poshmark', poshmarkListingId: item.poshmarkListingId },
                  update: {
                    $set: {
                      title: item.title,
                      description: item.description,
                      selling_price: parseFloat(item.price) || 0,
                      sku: item.sku || '',
                      images: item.images || [],
                      status: item.status === 'active' ? 'active' : 'inactive',
                      poshmarkUrl: item.poshmarkUrl,
                      updated_at: Date.now()
                    }
                  },
                  upsert: item.status === 'active'
                }
              }));

              if (poshOps.length > 0) {
                await Product.bulkWrite(poshOps, { ordered: false });
              }

              if (activePoshIds.size > 0) {
                await Product.updateMany(
                  {
                    user: userId,
                    source: 'poshmark',
                    status: 'active',
                    poshmarkListingId: { $nin: Array.from(activePoshIds) }
                  },
                  { $set: { status: 'inactive', updated_at: Date.now() } }
                );

                await Listing.updateMany(
                  {
                    user: userId,
                    poshmarkListingId: { $nin: Array.from(activePoshIds) },
                    poshmarkStatus: { $in: ['published', 'active', 'delisted'] }
                  },
                  {
                    $set: { poshmarkStatus: 'none', poshmarkListingId: null, poshmarkUrl: null },
                    $unset: { 'listingsMap.poshmark': "", 'platformData.poshmark': "" }
                  }
                );
              }
            }
          } catch (poshErr) {
            console.warn(`[Background Inventory Worker] Poshmark inventory sync notice:`, poshErr.message);
          }
        }

        // 4. Mercari Inventory Sync
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          try {
            console.log(`[Background Inventory Worker] Syncing Mercari closet for ${user.email}...`);
            const scrapedMerc = await scrapeMercariCloset(user.mercariAccount?.username || 'user', user.mercariAccount);
            if (Array.isArray(scrapedMerc) && scrapedMerc.length > 0) {
              const activeMercIds = new Set(scrapedMerc.filter(i => i.status === 'active').map(i => i.mercariListingId).filter(Boolean));

              const mercOps = scrapedMerc.map(item => ({
                updateOne: {
                  filter: { user: userId, source: 'mercari', mercariListingId: item.mercariListingId },
                  update: {
                    $set: {
                      title: item.title,
                      selling_price: parseFloat(item.price) || 0,
                      images: item.images,
                      status: item.status === 'active' ? 'active' : 'inactive',
                      mercariUrl: item.mercariUrl,
                      updated_at: Date.now()
                    }
                  },
                  upsert: item.status === 'active'
                }
              }));

              if (mercOps.length > 0) {
                await Product.bulkWrite(mercOps, { ordered: false });
              }

              if (activeMercIds.size > 0) {
                await Product.updateMany(
                  {
                    user: userId,
                    source: 'mercari',
                    status: 'active',
                    mercariListingId: { $nin: Array.from(activeMercIds) }
                  },
                  { $set: { status: 'inactive', updated_at: Date.now() } }
                );

                await Listing.updateMany(
                  {
                    user: userId,
                    mercariListingId: { $nin: Array.from(activeMercIds) },
                    mercariStatus: { $in: ['published', 'active', 'delisted'] }
                  },
                  {
                    $set: { mercariStatus: 'none', mercariListingId: null, mercariUrl: null },
                    $unset: { 'listingsMap.mercari': "", 'platformData.mercari': "" }
                  }
                );
              }
            }
          } catch (mercErr) {
            console.warn(`[Background Inventory Worker] Mercari inventory sync notice:`, mercErr.message);
          }
        }

        // 5. Recheck Master Listing Platform Statuses & Reconcile Orders
        await recheckMasterListingStatuses(userId);

      } catch (userErr) {
        console.error(`[Background Inventory Worker] Error processing user ${user.email}:`, userErr.message);
      }
    }

    console.log('[Background Inventory Worker] 12-hour All-Platform Inventory Import & Sync cycle completed.');
  } catch (err) {
    console.error('[Background Inventory Worker] Fatal error during inventory sync cycle:', err.message);
  } finally {
    isInventorySyncRunning = false;
  }
}

/**
 * Starts the automated periodic background sync workers (24/7 background cron).
 */
function startBackgroundSyncWorker() {
  if (ordersCronTask) {
    console.log('[Background Sync Worker] Workers already initialized.');
    return;
  }

  console.log('[Background Sync Worker] Initializing 24/7 automated background workers:');
  console.log(' - Sales & Auto-Delist Sync: Every 10 minutes');
  console.log(' - All-Platform Closet Import & Inventory Sync: Every 12 hours (00:00 & 12:00)');

  // Initial sales sync after 15 seconds
  setTimeout(() => {
    console.log('[Background Sync Worker] Running initial startup sales sync...');
    runBackgroundSyncCycle().catch(e => console.error('[Background Sync Worker] Initial sales sync error:', e.message));
  }, 15000);

  // Initial inventory sync & status recheck after 45 seconds
  setTimeout(() => {
    console.log('[Background Sync Worker] Running initial startup inventory sync & status recheck...');
    runBackgroundInventorySyncCycle().catch(e => console.error('[Background Sync Worker] Initial inventory sync error:', e.message));
  }, 45000);

  // Schedule sales & auto-delist sync every 10 minutes
  ordersCronTask = cron.schedule('*/10 * * * *', () => {
    runBackgroundSyncCycle().catch(e => console.error('[Background Sync Worker] Scheduled sales sync error:', e.message));
  });

  // Schedule all-platform closet import & inventory sync every 12 hours (00:00 and 12:00)
  inventoryCronTask = cron.schedule('0 */12 * * *', () => {
    console.log('[Background Inventory Worker] Triggering scheduled 12-hour full closet import & inventory sync cycle...');
    runBackgroundInventorySyncCycle().catch(e => console.error('[Background Sync Worker] Scheduled 12-hour inventory sync error:', e.message));
  });
}

function stopBackgroundSyncWorker() {
  if (ordersCronTask) {
    ordersCronTask.stop();
    ordersCronTask = null;
  }
  if (inventoryCronTask) {
    inventoryCronTask.stop();
    inventoryCronTask = null;
  }
  console.log('[Background Sync Worker] All workers stopped.');
}

/**
 * Synchronizes live marketplace inventory for a specific user across all connected channels.
 */
async function syncUserInventory(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const results = {
    ebay: { status: 'skipped', count: 0 },
    etsy: { status: 'skipped', count: 0 },
    poshmark: { status: 'skipped', count: 0 },
    mercari: { status: 'skipped', count: 0 }
  };

  // 1. eBay Inventory Sync
  const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
  if (isEbayConnected) {
    try {
      const ebayRes = await syncEbayInventory({ user: { id: userId } }, null);
      results.ebay = { status: 'success', count: ebayRes?.count || 0 };
    } catch (ebayErr) {
      console.warn(`[Sync User Inventory] eBay inventory sync notice:`, ebayErr.message);
      results.ebay = { status: 'failed', error: ebayErr.message };
    }
  }

  // 2. Etsy Inventory Sync
  if (user.etsyAccount?.connected && user.etsyAccount?.shopId) {
    try {
      const etsyRes = await syncEtsyInventory({ user: { id: userId } }, null);
      results.etsy = { status: 'success', count: etsyRes?.count || 0 };
    } catch (etsyErr) {
      console.warn(`[Sync User Inventory] Etsy inventory sync notice:`, etsyErr.message);
      results.etsy = { status: 'failed', error: etsyErr.message };
    }
  }

  // 3. Poshmark Inventory Sync
  if (user.poshmarkAccount?.connected && user.poshmarkAccount?.username) {
    try {
      console.log(`[Sync User Inventory] Syncing Poshmark closet for @${user.poshmarkAccount.username}...`);
      const scraped = await scrapePoshmarkCloset(user.poshmarkAccount.username, user.poshmarkAccount);
      if (Array.isArray(scraped) && scraped.length > 0) {
        const activePoshIds = new Set(scraped.filter(i => i.status === 'active').map(i => i.poshmarkListingId).filter(Boolean));
        
        const poshOps = scraped.map(item => ({
          updateOne: {
            filter: { user: userId, source: 'poshmark', poshmarkListingId: item.poshmarkListingId },
            update: {
              $set: {
                title: item.title,
                description: item.description,
                selling_price: parseFloat(item.price) || 0,
                sku: item.sku || '',
                images: item.images || [],
                status: item.status === 'active' ? 'active' : 'inactive',
                poshmarkUrl: item.poshmarkUrl,
                updated_at: Date.now()
              }
            },
            upsert: item.status === 'active'
          }
        }));

        if (poshOps.length > 0) {
          await Product.bulkWrite(poshOps, { ordered: false });
        }

        if (activePoshIds.size > 0) {
          await Product.updateMany(
            {
              user: userId,
              source: 'poshmark',
              status: 'active',
              poshmarkListingId: { $nin: Array.from(activePoshIds) }
            },
            { $set: { status: 'inactive', updated_at: Date.now() } }
          );

          await Listing.updateMany(
            {
              user: userId,
              poshmarkListingId: { $nin: Array.from(activePoshIds) },
              poshmarkStatus: { $in: ['published', 'active', 'delisted'] }
            },
            {
              $set: { poshmarkStatus: 'none', poshmarkListingId: null, poshmarkUrl: null },
              $unset: { 'listingsMap.poshmark': "", 'platformData.poshmark': "" }
            }
          );
        }
        results.poshmark = { status: 'success', count: scraped.length };
      }
    } catch (poshErr) {
      console.warn(`[Sync User Inventory] Poshmark inventory sync notice:`, poshErr.message);
      results.poshmark = { status: 'failed', error: poshErr.message };
    }
  }

  // 4. Mercari Inventory Sync
  if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
    try {
      console.log(`[Sync User Inventory] Syncing Mercari closet for ${user.email}...`);
      const scrapedMerc = await scrapeMercariCloset(user.mercariAccount?.username || 'user', user.mercariAccount);
      if (Array.isArray(scrapedMerc) && scrapedMerc.length > 0) {
        const activeMercIds = new Set(scrapedMerc.filter(i => i.status === 'active').map(i => i.mercariListingId).filter(Boolean));

        const mercOps = scrapedMerc.map(item => ({
          updateOne: {
            filter: { user: userId, source: 'mercari', mercariListingId: item.mercariListingId },
            update: {
              $set: {
                title: item.title,
                selling_price: parseFloat(item.price) || 0,
                images: item.images,
                status: item.status === 'active' ? 'active' : 'inactive',
                mercariUrl: item.mercariUrl,
                updated_at: Date.now()
              }
            },
            upsert: item.status === 'active'
          }
        }));

        if (mercOps.length > 0) {
          await Product.bulkWrite(mercOps, { ordered: false });
        }

        if (activeMercIds.size > 0) {
          await Product.updateMany(
            {
              user: userId,
              source: 'mercari',
              status: 'active',
              mercariListingId: { $nin: Array.from(activeMercIds) }
            },
            { $set: { status: 'inactive', updated_at: Date.now() } }
          );

          await Listing.updateMany(
            {
              user: userId,
              mercariListingId: { $nin: Array.from(activeMercIds) },
              mercariStatus: { $in: ['published', 'active', 'delisted'] }
            },
            {
              $set: { mercariStatus: 'none', mercariListingId: null, mercariUrl: null },
              $unset: { 'listingsMap.mercari': "", 'platformData.mercari': "" }
            }
          );
        }
        results.mercari = { status: 'success', count: scrapedMerc.length };
      }
    } catch (mercErr) {
      console.warn(`[Sync User Inventory] Mercari inventory sync notice:`, mercErr.message);
      results.mercari = { status: 'failed', error: mercErr.message };
    }
  }

  // 5. Recheck Master Listing Platform Statuses & Reconcile Orders
  await recheckMasterListingStatuses(userId);
  await reconcileOrdersAndMasterListings(userId);

  // 6. Record and calculate Sync Summary (New items vs Merged items)
  try {
    const connectedPlatforms = [];
    if (isEbayConnected) connectedPlatforms.push('eBay');
    if (user.poshmarkAccount?.connected) connectedPlatforms.push('Poshmark');
    if (user.mercariAccount?.connected) connectedPlatforms.push('Mercari');
    if (user.etsyAccount?.connected) connectedPlatforms.push('Etsy');

    const totalProcessed = (results.ebay?.count || 0) + (results.poshmark?.count || 0) + (results.mercari?.count || 0) + (results.etsy?.count || 0);
    
    const allUserListings = await Listing.find({ user: userId, status: { $ne: 'sold' } }).lean();
    let multiChannelCount = 0;
    let singleChannelCount = 0;
    allUserListings.forEach(l => {
      let activeChannels = 0;
      if (l.ebayListingId && (l.ebayStatus === 'published' || l.ebayStatus === 'active')) activeChannels++;
      if (l.poshmarkListingId && (l.poshmarkStatus === 'published' || l.poshmarkStatus === 'active')) activeChannels++;
      if (l.mercariListingId && (l.mercariStatus === 'published' || l.mercariStatus === 'active')) activeChannels++;
      if (l.etsyListingId && (l.etsyStatus === 'published' || l.etsyStatus === 'active')) activeChannels++;
      if (l.depopListingId && (l.depopStatus === 'published' || l.depopStatus === 'active')) activeChannels++;
      if (activeChannels > 1) multiChannelCount++;
      else singleChannelCount++;
    });

    const newItemsCount = totalProcessed > 0 ? Math.max(0, totalProcessed - multiChannelCount) : singleChannelCount;
    const mergedItemsCount = Math.max(0, multiChannelCount);

    user.lastSyncSummary = {
      syncedAt: new Date(),
      totalProcessed: totalProcessed || allUserListings.length,
      newItemsCount: newItemsCount,
      mergedItemsCount: mergedItemsCount,
      platforms: connectedPlatforms,
      shownToUser: false
    };
    user.markModified('lastSyncSummary');
    await user.save();
    console.log(`[Sync Summary] Recorded for User ${userId}: Processed=${totalProcessed || allUserListings.length}, New=${newItemsCount}, Merged=${mergedItemsCount}`);
  } catch (sumErr) {
    console.warn(`[Sync Summary] Failed to record sync summary:`, sumErr.message);
  }

  return results;
}

module.exports = {
  startBackgroundSyncWorker,
  stopBackgroundSyncWorker,
  runBackgroundSyncCycle,
  runBackgroundInventorySyncCycle,
  syncUserInventory,
  recheckMasterListingStatuses,
  reconcileOrdersAndMasterListings
};

