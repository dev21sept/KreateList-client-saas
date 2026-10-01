const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const totalEbay = await Product.countDocuments({ user: userId, source: 'ebay' });
  const activeEbay = await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' });
  const inactiveEbay = await Product.countDocuments({ user: userId, source: 'ebay', status: 'inactive' });
  const draftEbay = await Product.countDocuments({ user: userId, source: 'ebay', status: 'draft' });

  console.log('Product Collection:');
  console.log('Total eBay:', totalEbay);
  console.log('Active eBay:', activeEbay);
  console.log('Inactive eBay:', inactiveEbay);
  console.log('Draft eBay:', draftEbay);

  // Check how many eBay items are returned by the API /api/listings/channel-products?platform=ebay
  // Let's check the query in channel-products controller
  const channelQuery = { user: userId, source: 'ebay', status: 'active' };
  const count = await Product.countDocuments(channelQuery);
  console.log('Channel Products query count (status: active):', count);

  // Check if any items have status 'live' vs 'active'
  const liveCount = await Product.countDocuments({ user: userId, source: 'ebay', status: 'live' });
  console.log('Status live count:', liveCount);

  // Check unique titles vs unique IDs
  const activeProds = await Product.find(channelQuery).lean();
  const titleSet = new Set(activeProds.map(p => (p.title || '').trim().toLowerCase()));
  const idSet = new Set(activeProds.map(p => String(p.ebayListingId || p.itemId || '')));
  console.log(`Active count: ${activeProds.length}, Unique IDs: ${idSet.size}, Unique Titles: ${titleSet.size}`);

  if (activeProds.length !== titleSet.size) {
    console.log(`Difference between total active (${activeProds.length}) and unique titles (${titleSet.size}) is: ${activeProds.length - titleSet.size}`);
  }

  // Find exact duplicates in titles among active items
  const titleMap = {};
  activeProds.forEach(p => {
    const t = (p.title || '').trim().toLowerCase();
    titleMap[t] = (titleMap[t] || []);
    titleMap[t].push(p);
  });

  const duplicates = Object.keys(titleMap).filter(t => titleMap[t].length > 1);
  console.log(`\nFound ${duplicates.length} duplicate title groups in active eBay products:`);
  duplicates.forEach((t, i) => {
    console.log(`\nGroup ${i + 1}: "${titleMap[t][0].title}" (Count: ${titleMap[t].length})`);
    titleMap[t].forEach(p => {
      console.log(`  - ID: ${p.ebayListingId || p.itemId}, SKU: "${p.sku}", Price: $${p.selling_price}, Created: ${p.created_at || p.createdAt}`);
    });
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
