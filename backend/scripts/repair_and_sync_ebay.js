const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Product = require('../models/Product');
const Listing = require('../models/Listing');
const User = require('../models/User');
const ebayService = require('../services/ebayService');

const { getValidToken } = require('../controllers/ebayController');

async function repair() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const userId = '6a9998d8792e9694c0368c85';

  console.log(`[REPAIR] Getting eBay token for userId ${userId}...`);
  const token = await getValidToken(userId);
  if (!token) {
    console.error('Failed to get eBay access token');
    await mongoose.disconnect();
    return;
  }

  console.log('[REPAIR] Fetching all Active Listings from eBay Trading API...');
  let tradingPage = 1;
  let tradingHasMore = true;
  const entriesPerPage = 100;
  let totalActiveProcessed = 0;
  const activeItemsMap = new Map();

  while (tradingHasMore) {
    const tradingData = await ebayService.getTradingListings(token, 'ActiveList', tradingPage, entriesPerPage);
    const tradingItems = tradingData?.items || [];
    const totalPages = tradingData?.totalPages || 1;
    console.log(`[REPAIR] Trading Active Page ${tradingPage}/${totalPages}: got ${tradingItems.length} items`);

    for (const item of tradingItems) {
      if (item.itemId) {
        activeItemsMap.set(String(item.itemId), item);
        totalActiveProcessed++;
      }
    }

    if (tradingPage >= totalPages || tradingItems.length < entriesPerPage) {
      tradingHasMore = false;
    } else {
      tradingPage++;
    }
  }

  console.log(`[REPAIR] Total active eBay items fetched: ${activeItemsMap.size}`);

  // 1. Update/Upsert Product collection records
  let updatedProducts = 0;
  let insertedProducts = 0;

  for (const [itemId, item] of activeItemsMap.entries()) {
    const existing = await Product.findOne({ user: userId, source: 'ebay', ebayListingId: itemId });
    if (existing) {
      existing.title = item.title;
      if (item.images && item.images.length > 0) {
        existing.images = item.images;
      }
      if (item.price) {
        existing.selling_price = parseFloat(item.price);
      }
      if (item.sku) {
        existing.sku = item.sku;
      }
      existing.ebayUrl = item.viewUrl || `https://www.ebay.com/itm/${itemId}`;
      existing.status = 'active';
      existing.updated_at = Date.now();
      await existing.save();
      updatedProducts++;
    } else {
      await Product.create({
        user: userId,
        title: item.title,
        description: item.title,
        sku: item.sku || '',
        categoryId: item.categoryId || '',
        images: item.images || [],
        selling_price: item.price ? parseFloat(item.price) : 0,
        source: 'ebay',
        status: 'active',
        ebayListingId: itemId,
        ebayUrl: item.viewUrl || `https://www.ebay.com/itm/${itemId}`,
        updated_at: Date.now()
      });
      insertedProducts++;
    }
  }

  console.log(`[REPAIR] Product collection: ${updatedProducts} updated, ${insertedProducts} inserted`);

  // 2. Mark any eBay products not in active list as inactive
  const activeIdsArray = Array.from(activeItemsMap.keys());
  const deactivated = await Product.updateMany(
    { user: userId, source: 'ebay', status: 'active', ebayListingId: { $nin: activeIdsArray } },
    { $set: { status: 'inactive', updated_at: Date.now() } }
  );
  console.log(`[REPAIR] Deactivated ${deactivated.modifiedCount} ended/unsold eBay products`);

  // 3. Update master Listing collection platformData.ebay
  const listings = await Listing.find({ user: userId });
  console.log(`[REPAIR] Checking ${listings.length} listings for platformData.ebay repairs...`);
  let updatedListings = 0;

  for (const l of listings) {
    const ebayId = l.ebayListingId || l.platformData?.ebay?.listingId || l.platformData?.ebay?.liveId;
    if (ebayId && activeItemsMap.has(String(ebayId))) {
      const activeEbayItem = activeItemsMap.get(String(ebayId));
      if (!l.platformData) l.platformData = {};
      
      const realThumb = activeEbayItem.images?.[0] || '';
      const realImages = activeEbayItem.images || [];
      const realPrice = activeEbayItem.price || l.price || 0;
      const realUrl = activeEbayItem.viewUrl || `https://www.ebay.com/itm/${ebayId}`;

      l.platformData.ebay = {
        ...(l.platformData.ebay || {}),
        thumbnail: realThumb,
        images: realImages,
        price: realPrice,
        url: realUrl,
        status: 'published',
        listingId: ebayId,
        liveId: ebayId
      };
      l.ebayStatus = 'published';
      l.ebayListingId = ebayId;
      l.ebayUrl = realUrl;
      l.markModified('platformData');
      await l.save();
      updatedListings++;
    }
  }

  console.log(`[REPAIR] Successfully repaired ${updatedListings} Listing platformData.ebay records!`);

  // 4. Verify specific test items: Levi's 511 and Tommy Bahama Cargo Shorts
  const levisProd = await Product.findOne({ user: userId, ebayListingId: '206544895969' });
  console.log('\n--- VERIFICATION: Levi Jeans Product (206544895969) ---');
  console.log({
    id: levisProd?._id,
    title: levisProd?.title,
    ebayListingId: levisProd?.ebayListingId,
    images: levisProd?.images?.slice(0, 2)
  });

  const levisListing = await Listing.findOne({ user: userId, title: /Levi's 511 Straight Leg Jeans Mens 33x32/i });
  console.log('\n--- VERIFICATION: Levi Jeans Listing platformData.ebay ---');
  console.log(levisListing?.platformData?.ebay);

  const shortsProd = await Product.findOne({ user: userId, ebayListingId: '206544896673' });
  console.log('\n--- VERIFICATION: Tommy Bahama Shorts Product (206544896673) ---');
  console.log({
    id: shortsProd?._id,
    title: shortsProd?.title,
    ebayListingId: shortsProd?.ebayListingId,
    images: shortsProd?.images?.slice(0, 2)
  });

  await mongoose.disconnect();
}

repair().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
