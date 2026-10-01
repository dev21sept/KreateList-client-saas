const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Order = require('../models/Order');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  // Let's check all orders in Order collection grouped by platform
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
  console.log(`Total Orders in DB: ${orders.length}`);

  const orderPlatforms = {};
  orders.forEach(o => {
    const plat = o.platform || (o.ebayOrderId ? 'ebay' : (o.poshmarkOrderId ? 'poshmark' : 'other'));
    orderPlatforms[plat] = (orderPlatforms[plat] || 0) + 1;
  });
  console.log('Orders by platform:', orderPlatforms);

  // Check the last 10 orders across all platforms
  console.log('\nLast 10 Orders:');
  orders.slice(0, 10).forEach((o, i) => {
    console.log(`\nOrder #${i + 1}: Platform: ${o.platform}, OrderId: ${o.orderId || o.ebayOrderId || o.poshmarkOrderId}, Date: ${o.createdDate || o.createdAt}`);
    o.lineItems?.forEach(li => {
      console.log(`  - Title: "${li.title}", SKU: "${li.sku}", ItemId: ${li.legacyItemId || li.lineItemId || li.itemId}`);
    });
  });

  // Check if any eBay products in Product collection have status: 'inactive' with sold or delisted reasons
  const inactiveWithReason = await Product.find({
    user: userId,
    source: 'ebay',
    status: 'inactive'
  }).sort({ updated_at: -1 }).limit(10).lean();

  console.log('\nTop 10 Inactive eBay Products:');
  inactiveWithReason.forEach(p => {
    console.log(`- ID: ${p.ebayListingId || p.itemId}, Title: "${p.title}", SKU: "${p.sku}", Updated: ${p.updated_at || p.updatedAt}`);
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
