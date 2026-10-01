const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const ebayService = require('../services/ebayService');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  // Let's get the live eBay token and fetch all active listing IDs from Trading API
  const token = await ebayService.getValidEbayToken(userId);
  console.log('Fetching all live active IDs from eBay Trading API...');
  
  let page = 1;
  let hasMore = true;
  const liveTradingItemMap = new Map();

  while (hasMore && page <= 25) {
    const data = await ebayService.getTradingListings(token, 'ActiveList', page, 100);
    const items = data?.items || [];
    const totalPages = data?.totalPages || 1;
    items.forEach(it => {
      if (it.itemId) liveTradingItemMap.set(String(it.itemId), it);
    });
    if (page >= totalPages || items.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`Live active items on eBay: ${liveTradingItemMap.size}`);

  // Now check all eBay products in our database
  const allEbayInDb = await Product.find({ user: userId, source: 'ebay' }).lean();
  console.log(`Total eBay products in DB: ${allEbayInDb.length}`);

  const activeInDb = allEbayInDb.filter(p => p.status === 'active' || p.status === 'live');
  const inactiveInDb = allEbayInDb.filter(p => p.status !== 'active' && p.status !== 'live');

  console.log(`Active in DB: ${activeInDb.length}`);
  console.log(`Inactive in DB: ${inactiveInDb.length}`);

  // Find products that are LIVE on eBay right now but marked INACTIVE in our DB!
  const liveOnEbayButInactiveInDb = [];
  inactiveInDb.forEach(p => {
    const id = String(p.ebayListingId || p.itemId || '');
    if (id && liveTradingItemMap.has(id)) {
      liveOnEbayButInactiveInDb.push({
        id,
        sku: p.sku,
        title: p.title,
        statusInDb: p.status,
        liveTradingItem: liveTradingItemMap.get(id)
      });
    }
  });

  console.log(`\nProducts LIVE on eBay but marked INACTIVE in DB (${liveOnEbayButInactiveInDb.length}):`);
  liveOnEbayButInactiveInDb.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ID: ${item.id}`);
    console.log(`   Title: "${item.title}"`);
    console.log(`   SKU: "${item.sku}"`);
    console.log(`   Status in DB: ${item.statusInDb}`);
    console.log(`   Price on eBay: $${item.liveTradingItem.price}`);
  });

  // Also check products marked ACTIVE in DB but NOT live on eBay
  const activeInDbButNotLiveOnEbay = [];
  activeInDb.forEach(p => {
    const id = String(p.ebayListingId || p.itemId || '');
    if (id && !liveTradingItemMap.has(id)) {
      activeInDbButNotLiveOnEbay.push({
        id,
        sku: p.sku,
        title: p.title
      });
    }
  });

  console.log(`\nProducts ACTIVE in DB but NOT on eBay live (${activeInDbButNotLiveOnEbay.length}):`);
  activeInDbButNotLiveOnEbay.forEach((item, idx) => {
    console.log(`${idx + 1}. ID: ${item.id}, SKU: "${item.sku}", Title: "${item.title}"`);
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
