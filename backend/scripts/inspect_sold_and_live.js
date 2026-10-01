const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Listing = require('../models/Listing');
  const Product = require('../models/Product');
  const Order = require('../models/Order');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  // 1. Inspect "Fox Racing Casual Chino Shorts"
  const foxListings = await Listing.find({ user: userId, title: /Fox Racing Casual Chino Shorts/i }).lean();
  console.log('\n--- Fox Racing in Listing collection ---');
  foxListings.forEach(l => {
    console.log({
      _id: l._id,
      title: l.title,
      status: l.status,
      soldAt: l.soldAt,
      soldOn: l.soldOn,
      ebayListingId: l.ebayListingId,
      poshmarkListingId: l.poshmarkListingId,
      ebayStatus: l.ebayStatus,
      poshmarkStatus: l.poshmarkStatus
    });
  });

  const foxProducts = await Product.find({ user: userId, title: /Fox Racing Casual Chino Shorts/i }).lean();
  console.log('\n--- Fox Racing in Product collection ---');
  foxProducts.forEach(p => {
    console.log({
      _id: p._id,
      source: p.source,
      title: p.title,
      status: p.status,
      ebayListingId: p.ebayListingId || p.itemId,
      poshmarkListingId: p.poshmarkListingId,
      selling_price: p.selling_price || p.price
    });
  });

  // 2. Check all sold listings in Listing collection
  const soldListings = await Listing.find({ user: userId, status: 'sold' }).lean();
  console.log(`\nTotal sold listings in DB: ${soldListings.length}`);

  // Check how many sold listings actually match an ACTIVE product in Product collection
  const activeProducts = await Product.find({ user: userId, status: { $in: ['active', 'live', 'published'] } }).lean();
  const activeEbayIds = new Set(activeProducts.map(p => p.ebayListingId || p.itemId || p.liveListingId).filter(Boolean));
  const activePoshIds = new Set(activeProducts.map(p => p.poshmarkListingId).filter(Boolean));
  const activeMercIds = new Set(activeProducts.map(p => p.mercariListingId).filter(Boolean));

  let mistakenlySold = [];
  for (const sl of soldListings) {
    const isEbayActive = sl.ebayListingId && activeEbayIds.has(sl.ebayListingId);
    const isPoshActive = sl.poshmarkListingId && activePoshIds.has(sl.poshmarkListingId);
    const isMercActive = sl.mercariListingId && activeMercIds.has(sl.mercariListingId);

    if (isEbayActive || isPoshActive || isMercActive) {
      mistakenlySold.push({
        title: sl.title,
        sku: sl.sku,
        isEbayActive,
        isPoshActive,
        isMercActive,
        soldAt: sl.soldAt,
        soldOn: sl.soldOn
      });
    }
  }

  console.log(`\nMistakenly marked as SOLD while currently ACTIVE in Product: ${mistakenlySold.length}`);
  mistakenlySold.slice(0, 15).forEach(m => console.log('  ->', m));

  // 3. Inspect Orders collection date ranges
  const orders = await Order.find({ user: userId }).lean();
  console.log(`\nTotal Orders in DB: ${orders.length}`);
  const ordersByMonth = {};
  orders.forEach(o => {
    const d = new Date(o.createdDate || o.createdAt || 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ordersByMonth[key] = (ordersByMonth[key] || 0) + 1;
  });
  console.log('Orders by month:', ordersByMonth);

  // 4. Inspect Sold listings date ranges
  const soldByMonth = {};
  soldListings.forEach(sl => {
    const d = new Date(sl.soldAt || sl.updatedAt || sl.createdAt || 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    soldByMonth[key] = (soldByMonth[key] || 0) + 1;
  });
  console.log('Sold Listings by month:', soldByMonth);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
