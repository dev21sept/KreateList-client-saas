const cron = require('node-cron');
const User = require('../models/User');
const Order = require('../models/Order');
const Listing = require('../models/Listing');
const Product = require('../models/Product');
const { syncOrders: syncEbayOrders, syncInventory: syncEbayInventory } = require('../controllers/ebayController');
const { syncMercariOrders } = require('./mercariService');
const { syncPoshmarkOrders } = require('./poshmarkOrderService');
const { syncEtsyInventory } = require('../controllers/etsyController');
const { scrapePoshmarkCloset } = require('./externalImportService');

let isOrdersSyncRunning = false;
let isInventorySyncRunning = false;
let lastOrdersSyncTime = null;
let ordersCronTask = null;
let inventoryCronTask = null;

// Helper: Significant tokens for title matching
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

/**
 * Reconciles all Orders for a user with Master Listings to guarantee that
 * every sold order accurately reflects as `status: 'sold'` in Master Crosslisting.
 */
async function reconcileOrdersAndMasterListings(userId) {
  try {
    const orders = await Order.find({ user: userId });
    const listings = await Listing.find({ user: userId });

    let reconciledCount = 0;
    for (const order of orders) {
      const lineItem = order.lineItems?.[0];
      const ordTitle = lineItem?.title || order.title || '';
      const ordSku = lineItem?.sku || order.sku || '';
      const ordPlatId = String(lineItem?.legacyItemId || lineItem?.lineItemId || order.platformListingId || order.ebayOrderId || order.orderId || '').trim();
      const normPlatform = String(order.platform || 'ebay').toLowerCase();

      // Find matching listing
      let match = null;

      // 1. By ID
      if (ordPlatId) {
        match = listings.find(l => 
          l.ebayListingId === ordPlatId ||
          l.poshmarkListingId === ordPlatId ||
          l.mercariListingId === ordPlatId ||
          l.etsyListingId === ordPlatId ||
          l.depopListingId === ordPlatId ||
          l.platformData?.ebay?.liveId === ordPlatId ||
          l.platformData?.poshmark?.liveId === ordPlatId ||
          l.platformData?.mercari?.liveId === ordPlatId
        );
      }

      // 2. By direct listingId on order
      if (!match && order.listingId) {
        match = listings.find(l => l._id.toString() === order.listingId.toString());
      }

      // 3. By exact title (case-insensitive)
      if (!match && ordTitle) {
        match = listings.find(l => l.title && l.title.trim().toLowerCase() === ordTitle.trim().toLowerCase());
      }

      // 4. By SKU
      if (!match && ordSku && ordSku !== '-' && ordSku !== 'None') {
        match = listings.find(l => l.sku && l.sku.trim().toLowerCase() === ordSku.trim().toLowerCase());
      }

      // 5. By fuzzy title
      if (!match && ordTitle) {
        match = listings.find(l => areTitlesSimilar(ordTitle, l.title));
      }

      if (match) {
        // Link order
        if (!order.listingId || order.listingId.toString() !== match._id.toString()) {
          order.listingId = match._id;
          await order.save();
        }

        // Mark listing as sold
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

        const platField = `${normPlatform}Status`;
        if (match[platField] !== 'sold') {
          match[platField] = 'sold';
          if (match.platformData?.[normPlatform]) match.platformData[normPlatform].status = 'sold';
          if (match.listingsMap?.[normPlatform]) match.listingsMap[normPlatform].status = 'sold';
          listingChanged = true;
        }

        if (listingChanged) {
          match.markModified('platformData');
          match.markModified('listingsMap');
          await match.save();
          reconciledCount++;
        }
      }
    }

    if (reconciledCount > 0) {
      console.log(`[Order Reconciler] Linked and marked ${reconciledCount} master listing(s) as SOLD for User: ${userId}`);
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
    console.log(`[Status Recheck] Rechecking platform statuses for ${listings.length} listings (User: ${userId})...`);

    let updatedCount = 0;
    for (const listing of listings) {
      let changed = false;

      // 1. Check eBay status
      if (listing.ebayListingId) {
        const ebayProd = await Product.findOne({ user: userId, ebayListingId: listing.ebayListingId, source: 'ebay' });
        if (ebayProd) {
          if (ebayProd.status === 'inactive' || ebayProd.status === 'sold') {
            const targetStat = ebayProd.status === 'sold' ? 'sold' : 'delisted';
            if (listing.ebayStatus !== targetStat) {
              listing.ebayStatus = targetStat;
              if (listing.platformData?.ebay) listing.platformData.ebay.status = targetStat;
              changed = true;
            }
          } else if (ebayProd.status === 'active' && listing.status !== 'sold') {
            if (listing.ebayStatus !== 'published') {
              listing.ebayStatus = 'published';
              if (listing.platformData?.ebay) listing.platformData.ebay.status = 'published';
              changed = true;
            }
          }
        }
      }

      // 2. Check Poshmark status
      if (listing.poshmarkListingId) {
        const poshProd = await Product.findOne({ user: userId, poshmarkListingId: listing.poshmarkListingId, source: 'poshmark' });
        if (poshProd) {
          if (poshProd.status === 'inactive' || poshProd.status === 'sold') {
            const targetStat = poshProd.status === 'sold' ? 'sold' : 'delisted';
            if (listing.poshmarkStatus !== targetStat) {
              listing.poshmarkStatus = targetStat;
              if (listing.platformData?.poshmark) listing.platformData.poshmark.status = targetStat;
              changed = true;
            }
          } else if (poshProd.status === 'active' && listing.status !== 'sold') {
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
          if (mercProd.status === 'inactive' || mercProd.status === 'sold') {
            const targetStat = mercProd.status === 'sold' ? 'sold' : 'delisted';
            if (listing.mercariStatus !== targetStat) {
              listing.mercariStatus = targetStat;
              if (listing.platformData?.mercari) listing.platformData.mercari.status = targetStat;
              changed = true;
            }
          } else if (mercProd.status === 'active' && listing.status !== 'sold') {
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
          if (etsyProd.status === 'inactive' || etsyProd.status === 'sold') {
            const targetStat = etsyProd.status === 'sold' ? 'sold' : 'delisted';
            if (listing.etsyStatus !== targetStat) {
              listing.etsyStatus = targetStat;
              if (listing.platformData?.etsy) listing.platformData.etsy.status = targetStat;
              changed = true;
            }
          } else if (etsyProd.status === 'active' && listing.status !== 'sold') {
            if (listing.etsyStatus !== 'published') {
              listing.etsyStatus = 'published';
              if (listing.platformData?.etsy) listing.platformData.etsy.status = 'published';
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
  console.log('[Background Sales Worker] Starting 24/7 automated multi-channel sales & auto-delist sync cycle...');

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

    console.log(`[Background Sales Worker] Found ${users.length} users with connected marketplaces.`);

    for (const user of users) {
      try {
        const userId = user._id.toString();
        console.log(`[Background Sales Worker] Syncing sales for: ${user.email} (ID: ${userId})`);

        // 1. eBay Orders Sync
        const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
        if (isEbayConnected) {
          try {
            console.log(`[Background Sales Worker] Syncing eBay orders for ${user.email}...`);
            await syncEbayOrders({ user: { id: userId } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Sales Worker] eBay sales sync error for ${user.email}:`, ebayErr.message);
          }
        }

        // 2. Mercari Orders Sync
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          try {
            await syncMercariOrders(user.mercariAccount, userId);
          } catch (mercErr) {
            console.warn(`[Background Sales Worker] Mercari sales sync error for ${user.email}:`, mercErr.message);
          }
        }

        // 3. Poshmark Orders Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
          try {
            await syncPoshmarkOrders(user.poshmarkAccount, userId);
          } catch (poshErr) {
            console.warn(`[Background Sales Worker] Poshmark sales sync error for ${user.email}:`, poshErr.message);
          }
        }

        // 4. Reconcile Orders with Master Listings
        await reconcileOrdersAndMasterListings(userId);

      } catch (userErr) {
        console.error(`[Background Sales Worker] Error processing user ${user.email}:`, userErr.message);
      }
    }

    console.log('[Background Sales Worker] Sales sync cycle completed successfully.');
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
    console.log('[Background Inventory Worker] Previous inventory sync is still running. Skipping this tick.');
    return;
  }

  isInventorySyncRunning = true;
  console.log('[Background Inventory Worker] Starting 30-min automated All-Platform Inventory Sync & Status Recheck...');

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

    console.log(`[Background Inventory Worker] Found ${users.length} users with connected marketplaces to sync inventory.`);

    for (const user of users) {
      try {
        const userId = user._id.toString();
        console.log(`[Background Inventory Worker] Syncing inventory for user: ${user.email}`);

        // 1. eBay Inventory Sync
        const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
        if (isEbayConnected) {
          try {
            console.log(`[Background Inventory Worker] Syncing eBay inventory for ${user.email}...`);
            await syncEbayInventory({ user: { id: userId } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Inventory Worker] eBay inventory sync error:`, ebayErr.message);
          }
        }

        // 2. Etsy Inventory Sync
        if (user.etsyAccount?.connected && user.etsyAccount?.shopId) {
          try {
            console.log(`[Background Inventory Worker] Syncing Etsy inventory for ${user.email}...`);
            await syncEtsyInventory({ user: { id: userId } }, null);
          } catch (etsyErr) {
            console.warn(`[Background Inventory Worker] Etsy inventory sync error:`, etsyErr.message);
          }
        }

        // 3. Poshmark Inventory Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.username) {
          try {
            console.log(`[Background Inventory Worker] Syncing Poshmark closet for @${user.poshmarkAccount.username}...`);
            const scraped = await scrapePoshmarkCloset(user.poshmarkAccount.username, user.poshmarkAccount);
            if (Array.isArray(scraped) && scraped.length > 0) {
              for (const item of scraped) {
                let existing = null;
                if (item.sku) {
                  existing = await Product.findOne({ user: userId, sku: item.sku, source: 'poshmark' });
                }
                if (!existing && item.poshmarkListingId) {
                  existing = await Product.findOne({ user: userId, poshmarkListingId: item.poshmarkListingId, source: 'poshmark' });
                }
                if (existing) {
                  existing.poshmarkListingId = item.poshmarkListingId;
                  existing.poshmarkUrl = item.poshmarkUrl;
                  existing.status = item.status === 'active' ? 'active' : 'inactive';
                  existing.updated_at = Date.now();
                  await existing.save();
                } else {
                  await Product.create({
                    user: userId,
                    title: item.title,
                    description: item.description,
                    price: item.price,
                    sku: item.sku || '',
                    images: item.images || [],
                    source: 'poshmark',
                    poshmarkListingId: item.poshmarkListingId,
                    poshmarkUrl: item.poshmarkUrl,
                    status: item.status === 'active' ? 'active' : 'inactive',
                    updated_at: Date.now()
                  });
                }
              }
            }
          } catch (poshErr) {
            console.warn(`[Background Inventory Worker] Poshmark inventory sync notice:`, poshErr.message);
          }
        }

        // 4. Recheck Master Listing Platform Statuses & Reconcile Orders
        await recheckMasterListingStatuses(userId);

      } catch (userErr) {
        console.error(`[Background Inventory Worker] Error processing user ${user.email}:`, userErr.message);
      }
    }

    console.log('[Background Inventory Worker] 30-min All-Platform Inventory Sync & Status Recheck completed.');
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
  console.log(' - All-Platform Inventory Sync & Status Recheck: Every 30 minutes');

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

  // Schedule all-platform inventory sync & status recheck every 30 minutes
  inventoryCronTask = cron.schedule('*/30 * * * *', () => {
    runBackgroundInventorySyncCycle().catch(e => console.error('[Background Sync Worker] Scheduled 30-min inventory sync error:', e.message));
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

module.exports = {
  startBackgroundSyncWorker,
  stopBackgroundSyncWorker,
  runBackgroundSyncCycle,
  runBackgroundInventorySyncCycle,
  recheckMasterListingStatuses,
  reconcileOrdersAndMasterListings
};
