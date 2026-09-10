const cron = require('node-cron');
const User = require('../models/User');
const Order = require('../models/Order');
const { syncOrders: syncEbayOrders } = require('../controllers/ebayController');
const { syncMercariOrders } = require('./mercariService');
const { syncPoshmarkOrders } = require('./poshmarkOrderService');

let isSyncRunning = false;
let cronTask = null;

/**
 * Executes a full sales/orders sync cycle for all connected users.
 */
async function runBackgroundSyncCycle() {
  if (isSyncRunning) {
    console.log('[Background Sync Worker] Previous sync cycle is still running. Skipping this tick.');
    return;
  }

  isSyncRunning = true;
  console.log('[Background Sync Worker] Starting automated multi-channel orders & status sync cycle...');

  try {
    // Find all users who have at least one marketplace account connected
    const users = await User.find({
      $or: [
        { 'ebay.connected': true },
        { 'poshmarkAccount.connected': true },
        { 'mercariAccount.connected': true },
        { 'depopAccount.connected': true },
        { 'etsyAccount.connected': true }
      ]
    });

    console.log(`[Background Sync Worker] Found ${users.length} users with connected marketplaces.`);

    for (const user of users) {
      try {
        console.log(`[Background Sync Worker] Processing user: ${user.email} (ID: ${user._id})`);

        // 1. eBay Sync
        if (user.ebay?.connected && user.ebay?.accessToken) {
          try {
            console.log(`[Background Sync Worker] Syncing eBay for ${user.email}...`);
            await syncEbayOrders({ user: { id: user._id.toString() } }, null);
          } catch (ebayErr) {
            console.warn(`[Background Sync Worker] eBay sync error for ${user.email}:`, ebayErr.message);
          }
        }

        // 2. Mercari Sync
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          try {
            console.log(`[Background Sync Worker] Syncing Mercari for ${user.email}...`);
            await syncMercariOrders(user.mercariAccount, user._id.toString());
          } catch (mercErr) {
            console.warn(`[Background Sync Worker] Mercari sync error for ${user.email}:`, mercErr.message);
          }
        }

        // 3. Poshmark Sync
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie) {
          try {
            console.log(`[Background Sync Worker] Syncing Poshmark for ${user.email}...`);
            await syncPoshmarkOrders(user.poshmarkAccount, user._id.toString());
          } catch (poshErr) {
            console.warn(`[Background Sync Worker] Poshmark sync error for ${user.email}:`, poshErr.message);
          }
        }

      } catch (userErr) {
        console.error(`[Background Sync Worker] Error processing user ${user.email}:`, userErr.message);
      }
    }

    console.log('[Background Sync Worker] Sync cycle completed successfully.');
  } catch (err) {
    console.error('[Background Sync Worker] Fatal error during sync cycle:', err.message);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Starts the automated periodic background sync worker.
 * Default schedule: Every 5 minutes ('* / 5 * * * *')
 */
function startBackgroundSyncWorker() {
  if (cronTask) {
    console.log('[Background Sync Worker] Worker is already initialized.');
    return;
  }

  console.log('[Background Sync Worker] Initializing automated multi-channel background sync worker (Schedule: every 5 minutes)...');
  
  // Run once on startup after 15 seconds to populate initial sales without slowing down server boot
  setTimeout(() => {
    console.log('[Background Sync Worker] Executing initial startup sync...');
    runBackgroundSyncCycle().catch(e => console.error('[Background Sync Worker] Startup sync error:', e.message));
  }, 15000);

  // Schedule cron every 5 minutes
  cronTask = cron.schedule('*/5 * * * *', () => {
    runBackgroundSyncCycle().catch(e => console.error('[Background Sync Worker] Scheduled sync error:', e.message));
  });
}

function stopBackgroundSyncWorker() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[Background Sync Worker] Worker stopped.');
  }
}

module.exports = {
  startBackgroundSyncWorker,
  stopBackgroundSyncWorker,
  runBackgroundSyncCycle
};
