const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const ebayService = require('../services/ebayService');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const token = await ebayService.getValidEbayToken(user._id);
  console.log('eBay token acquired:', !!token);

  if (!token) {
    console.log('No token');
    process.exit(1);
  }

  // Call Trading API ActiveList
  const tradingData = await ebayService.getTradingListings(token, 'ActiveList', 1, 100);
  console.log('Trading API ActiveList Page 1 response:');
  console.log('Total Entries (from XML pagination):', tradingData?.pagination?.totalEntries || tradingData?.totalEntries);
  console.log('Total Pages:', tradingData?.pagination?.totalPages || tradingData?.totalPages);
  console.log('Items in page 1:', tradingData?.items?.length);

  // Check SoldList as well
  const soldData = await ebayService.getTradingListings(token, 'SoldList', 1, 100);
  console.log('\nTrading API SoldList response:');
  console.log('Total Sold Entries:', soldData?.pagination?.totalEntries || soldData?.totalEntries);

  // Check UnsoldList / Ended
  const unsoldData = await ebayService.getTradingListings(token, 'UnsoldList', 1, 100);
  console.log('\nTrading API UnsoldList response:');
  console.log('Total Unsold Entries:', unsoldData?.pagination?.totalEntries || unsoldData?.totalEntries);

  process.exit(0);
}

run().catch(e => {
  console.error('eBay Trading API error:', e);
  process.exit(1);
});
