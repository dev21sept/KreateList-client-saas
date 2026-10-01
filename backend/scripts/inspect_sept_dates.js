const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Order = require('../models/Order');
  const Listing = require('../models/Listing');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  const orders = await Order.find({ user: userId }).sort({ createdDate: 1 }).lean();
  console.log(`Total Orders in DB: ${orders.length}`);

  const byDay = {};
  orders.forEach(o => {
    const d = new Date(o.createdDate || o.createdAt || 0);
    const dayKey = d.toISOString().substring(0, 10);
    byDay[dayKey] = (byDay[dayKey] || 0) + 1;
  });

  console.log('\nOrders count by date:');
  Object.keys(byDay).sort().forEach(k => {
    console.log(`  ${k}: ${byDay[k]} orders`);
  });

  const soldListings = await Listing.find({ user: userId, status: 'sold' }).sort({ soldAt: 1 }).lean();
  console.log(`\nTotal Sold Listings: ${soldListings.length}`);
  const soldByDay = {};
  soldListings.forEach(sl => {
    const d = new Date(sl.soldAt || sl.updatedAt || sl.createdAt || 0);
    const dayKey = d.toISOString().substring(0, 10);
    soldByDay[dayKey] = (soldByDay[dayKey] || 0) + 1;
  });
  console.log('\nSold Listings count by date:');
  Object.keys(soldByDay).sort().forEach(k => {
    console.log(`  ${k}: ${soldByDay[k]} listings`);
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
