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
let ordersCronTask = null;
let inventoryCronTask = null;

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
          if (ebayProd.status === 'inactive') {
            if (listing.ebayStatus === 'published' || listing.ebayStatus === 'active') {
              listing.ebayStatus = 'delisted';
              if (listing.platformData?.ebay) listing.platformData.ebay.status = 'delisted';
              changed = true;
            }
          } else if (ebayProd.status === 'active') {
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
          } else if (poshProd.status === 'active') {
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
          } else if (mercProd.status === 'active') {
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
          if (etsyProd.status === 'inactive') {
            if (listing.etsyStatus === 'published' || listing.etsyStatus === 'active') {
              listing.etsyStatus = 'delisted';
              if (listing.platformData?.etsy) listing.platformData.etsy.status = 'delisted';
              changed = true;
            }
          } else if (etsyProd.status === 'active') {
            if (listing.etsyStatus !== 'published') {
              listing.etsyStatus = 'published';
              if (listing.platformData?.etsy) listing.platformData.etsy.status = 'published';
              changed = true;
            }
          }
        }
      }

      // 5. Restore Master Listing to published if any connected channel is active
      const hasActiveChannel = [listing.ebayStatus, listing.poshmarkStatus, listing.mercariStatus, listing.etsyStatus, listing.depopStatus].some(s => s === 'published' || s === 'active');
      if (hasActiveChannel && listing.status === 'sold') {
        listing.status = 'published';
        listing.quantity = 1;
        listing.soldOn = null;
        listing.soldOrderId = null;
        listing.soldAt = null;
        listing.soldPlatform = null;
        listing.errorMessage = null;
        changed = true;
      }

      if (changed) {
        listing.markModified('platformData');
        await listing.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`[Status Recheck] Updated ${updatedCount} master listing(s) after channel status verification.`);
    }
  } catch (err) {
    console.error('[Status Recheck] Error rechecking listing statuses:', err.message);
  }
}

/**
 * Executes a full sales/orders sync cycle for all connected users (Every 10 min).
 */
async function runBackgroundSyncCycle() {
  if (isOrdersSyncRunning) {
    console.log('[Background Sales Worker] Previous sales sync cycle is still running. Skipping this tick.');
    return;
  }

  isOrdersSyncRunning = true;
  console.log('[Background Sales Worker] Starting automated multi-channel orders & auto-delist sync cycle...');

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
        console.log(`[Background Sales Worker] Syncing sales for: ${user.email} (ID: ${user._id})`);

        // 1. eBay Sync
        const isEbayConnected = (user.ebayAccount?.connected && (user.ebayAccount?.accessToken || user.ebayAccount?.refreshToken)) || (user.ebay?.connected);
        if (isEbayConnected) {
          try {
            console.log(`[Background Sales Worker] Syncing eBay orders for ${user.email}...`);
            await syncEbayOrders({ user: { id: user._id.toString() } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Sales Worker] eBay sales sync error for ${user.email}:`, ebayErr.message);
          }
        }

        // 2. Mercari Sync
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          try {
            await syncMercariOrders(user.mercariAccount, user._id.toString());
          } catch (mercErr) {
            console.warn(`[Background Sales Worker] Mercari sales sync error for ${user.email}:`, mercErr.message);
          }
        }

        // 3. Poshmark Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
          try {
            await syncPoshmarkOrders(user.poshmarkAccount, user._id.toString());
          } catch (poshErr) {
            console.warn(`[Background Sales Worker] Poshmark sales sync error for ${user.email}:`, poshErr.message);
          }
        }

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

        // 4. Recheck Master Listing Platform Statuses
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
 * Starts the automated periodic background sync workers.
 */
function startBackgroundSyncWorker() {
  if (ordersCronTask) {
    console.log('[Background Sync Worker] Workers already initialized.');
    return;
  }

  console.log('[Background Sync Worker] Initializing automated background workers:');
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
  recheckMasterListingStatuses
};
