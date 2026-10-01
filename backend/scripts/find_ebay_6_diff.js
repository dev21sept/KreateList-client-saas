const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Order = require('../models/Order');
  const Listing = require('../models/Listing');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  // 1. All active eBay products
  const activeEbay = await Product.find({ user: userId, source: 'ebay', status: 'active' }).sort({ updated_at: -1 }).lean();
  console.log('Active eBay Products count:', activeEbay.length);

  // 2. Check recently modified or deactivated eBay products (last 24-48 hours)
  const recentlyDeactivated = await Product.find({
    user: userId,
    source: 'ebay',
    status: { $ne: 'active' }
  }).sort({ updated_at: -1 }).limit(10).lean();

  console.log('\nRecently deactivated/inactive eBay Products:');
  recentlyDeactivated.forEach((p, i) => {
    console.log(`${i + 1}. [${p.status}] ID: ${p.ebayListingId || p.itemId}, SKU: "${p.sku}", Title: "${p.title}", Updated: ${new Date(p.updated_at || p.updatedAt).toISOString()}`);
  });

  // 3. Check eBay Orders (Sold items) in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentOrders = await Order.find({
    user: userId,
    platform: 'ebay',
    $or: [
      { createdDate: { $gte: sevenDaysAgo.toISOString() } },
      { createdAt: { $gte: sevenDaysAgo } }
    ]
  }).lean();

  console.log(`\nRecent eBay Orders in last 7 days: ${recentOrders.length}`);
  recentOrders.forEach((o, i) => {
    console.log(`${i + 1}. Order: ${o.orderId}, Date: ${o.createdDate || o.createdAt}, Status: ${o.status}`);
    o.lineItems?.forEach(li => {
      console.log(`   - Item: ${li.legacyItemId || li.lineItemId}, Title: "${li.title}", SKU: "${li.sku}", Price: $${li.price}`);
    });
  });

  // 4. Check if there are any eBay products with missing title, missing price, or missing ID
  const noId = activeEbay.filter(p => !p.ebayListingId && !p.itemId);
  const noTitle = activeEbay.filter(p => !p.title || p.title.trim() === '');
  const noPrice = activeEbay.filter(p => !p.selling_price || p.selling_price === 0);
  console.log(`\nAnomalies in active eBay: No ID: ${noId.length}, No Title: ${noTitle.length}, No Price: ${noPrice.length}`);

  // 5. Check if any duplicate SKUs exist in active eBay products
  const skuMap = {};
  activeEbay.forEach(p => {
    const sku = (p.sku || '').trim();
    if (sku && sku !== '-') {
      skuMap[sku] = (skuMap[sku] || 0) + 1;
    }
  });
  const duplicateSkus = Object.keys(skuMap).filter(s => skuMap[s] > 1);
  console.log(`Duplicate SKUs in active eBay: ${duplicateSkus.length}`, duplicateSkus);
  duplicateSkus.forEach(s => {
    const matching = activeEbay.filter(p => (p.sku || '').trim() === s);
    console.log(`SKU "${s}" (Count ${matching.length}):`);
    matching.forEach(m => console.log(`  - ID: ${m.ebayListingId}, Title: "${m.title}"`));
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
