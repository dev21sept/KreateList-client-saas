const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Order = require('../models/Order');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  // 1. All eBay products by status
  const allEbayProducts = await Product.find({ user: userId, source: 'ebay' }).lean();
  console.log(`Total eBay Products in DB: ${allEbayProducts.length}`);

  const statusCounts = {};
  allEbayProducts.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  console.log('eBay Products by status:', statusCounts);

  // 2. Check for duplicate itemId/ebayListingId
  const idMap = new Map();
  const duplicateIds = [];
  allEbayProducts.forEach(p => {
    const id = String(p.ebayListingId || p.itemId || '');
    if (id) {
      if (idMap.has(id)) {
        duplicateIds.push({ id, titles: [idMap.get(id).title, p.title], statuses: [idMap.get(id).status, p.status] });
      } else {
        idMap.set(id, p);
      }
    }
  });
  console.log(`Unique eBay Listing IDs: ${idMap.size}`);
  console.log(`Duplicate Listing IDs found: ${duplicateIds.length}`, duplicateIds);

  // 3. Check active eBay products
  const activeEbay = allEbayProducts.filter(p => p.status === 'active');
  console.log(`Active eBay Products count: ${activeEbay.length}`);

  // 4. Check if any active products have duplicate titles or SKUs
  const titleMap = new Map();
  const duplicateTitles = [];
  activeEbay.forEach(p => {
    const t = (p.title || '').trim().toLowerCase();
    if (titleMap.has(t)) {
      duplicateTitles.push({ title: p.title, id1: titleMap.get(t).ebayListingId, id2: p.ebayListingId });
    } else {
      titleMap.set(t, p);
    }
  });
  console.log(`Unique active eBay Titles: ${titleMap.size}`);
  console.log(`Duplicate active titles: ${duplicateTitles.length}`);
  if (duplicateTitles.length > 0) {
    console.log('Duplicate titles list:', duplicateTitles.slice(0, 10));
  }

  // 5. Check if 6 items are marked inactive, sold, draft, or delisted
  const inactiveEbay = allEbayProducts.filter(p => p.status !== 'active');
  console.log(`\nNon-active eBay products (${inactiveEbay.length}):`);
  inactiveEbay.forEach(p => {
    console.log(`- [${p.status}] ID: ${p.ebayListingId || p.itemId}, Title: "${p.title}", SKU: "${p.sku}"`);
  });

  // 6. Check if there are 6 eBay items in Orders (Sold items) that were recently synced
  const recentOrders = await Order.find({ user: userId, platform: 'ebay' }).lean();
  console.log(`\nTotal eBay Orders in DB: ${recentOrders.length}`);
  
  process.exit(0);
}

run().catch(e => {
  console.error('Inspect error:', e);
  process.exit(1);
});
