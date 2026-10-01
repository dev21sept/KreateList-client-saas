const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  // Active products in Product collection
  const activeProducts = await Product.find({ user: userId, status: { $in: ['active', 'live', 'published'] } }).lean();
  const activeEbayIds = new Set(activeProducts.map(p => p.ebayListingId || p.itemId || p.liveListingId).filter(Boolean));
  const activePoshIds = new Set(activeProducts.map(p => p.poshmarkListingId).filter(Boolean));
  const activeMercIds = new Set(activeProducts.map(p => p.mercariListingId).filter(Boolean));

  console.log(`Active Products: eBay=${activeEbayIds.size}, Poshmark=${activePoshIds.size}, Mercari=${activeMercIds.size}`);

  const soldListings = await Listing.find({ user: userId, status: 'sold' }).lean();
  console.log(`Total Sold Listings: ${soldListings.length}`);

  let activeInStore = [];
  let trulySold = [];

  for (const sl of soldListings) {
    const hasEbayActive = sl.ebayListingId && activeEbayIds.has(sl.ebayListingId);
    const hasPoshActive = sl.poshmarkListingId && activePoshIds.has(sl.poshmarkListingId);
    const hasMercActive = sl.mercariListingId && activeMercIds.has(sl.mercariListingId);

    const isLive = hasEbayActive || hasPoshActive || hasMercActive;

    if (isLive) {
      activeInStore.push({
        _id: sl._id,
        title: sl.title,
        sku: sl.sku,
        soldAt: sl.soldAt,
        soldOn: sl.soldOn,
        hasEbayActive,
        hasPoshActive,
        hasMercActive
      });
    } else {
      trulySold.push(sl);
    }
  }

  console.log(`\nSold Listings that are actually LIVE store items: ${activeInStore.length}`);
  activeInStore.forEach((a, i) => {
    console.log(`  [${i + 1}] Title: "${a.title}" | SoldAt: ${a.soldAt} | SoldOn: ${a.soldOn} | Live: eBay=${a.hasEbayActive}, Posh=${a.hasPoshActive}`);
  });

  console.log(`\nTruly Sold Listings (0 active store products): ${trulySold.length}`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
