const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const ebayService = require('../services/ebayService');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const activeEbay = await Product.find({ user: userId, source: 'ebay', status: 'active' }).sort({ updated_at: -1 }).lean();
  console.log(`Current Active eBay Products in DB: ${activeEbay.length}`);

  // Let's check eBay live Trading API total count
  const token = await ebayService.getValidEbayToken(userId);
  const tradingData = await ebayService.getTradingListings(token, 'ActiveList', 1, 100);
  console.log('Live eBay Trading API ActiveList Total Entries:', tradingData?.pagination?.totalEntries || tradingData?.totalEntries);

  // Let's check the 2 newly added/updated items that were inactive before:
  // Items 1 & 2 from previous comparison:
  // ID: 206581576669 (Polo Ralph Lauren Philip Classic Chino Shorts Mens 40)
  // ID: 206581578143 (Jack Archer Chino Pants Mens 40x32 Deep Blue)
  const item1 = await Product.findOne({ user: userId, ebayListingId: '206581576669' }).lean();
  const item2 = await Product.findOne({ user: userId, ebayListingId: '206581578143' }).lean();

  console.log('\nItem 1:', { id: item1?.ebayListingId, title: item1?.title, status: item1?.status, price: item1?.selling_price });
  console.log('Item 2:', { id: item2?.ebayListingId, title: item2?.title, status: item2?.status, price: item2?.selling_price });

  // Let's check if there are 1029 active listings on eBay directly
  let page = 1;
  let hasMore = true;
  const liveIds = new Set();
  while (hasMore && page <= 25) {
    const data = await ebayService.getTradingListings(token, 'ActiveList', page, 100);
    const items = data?.items || [];
    const totalPages = data?.totalPages || 1;
    items.forEach(it => { if (it.itemId) liveIds.add(String(it.itemId)); });
    if (page >= totalPages || items.length < 100) hasMore = false;
    else page++;
  }

  console.log(`\nExact live item count on eBay seller account right now: ${liveIds.size}`);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
