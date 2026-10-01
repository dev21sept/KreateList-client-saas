const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const { matchPlatformProductsStrict } = require('../utils/listingMatcher');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const ebayProds = await Product.find({ user: userId, source: 'ebay', status: 'active' }).lean();
  const poshProds = await Product.find({ user: userId, source: 'poshmark', status: 'active' }).lean();
  const mercProds = await Product.find({ user: userId, source: 'mercari', status: 'active' }).lean();

  console.log('Active Channel Products:');
  console.log('eBay active products:', ebayProds.length);
  console.log('Poshmark active products:', poshProds.length);
  console.log('Mercari active products:', mercProds.length);

  const { masterListings, platformStats, duplicateGroups } = matchPlatformProductsStrict({
    ebay: ebayProds,
    poshmark: poshProds,
    mercari: mercProds,
    etsy: [],
    amazon: []
  });

  console.log('\n=== Strict Matching Result ===');
  console.log('Total Master Listings:', masterListings.length);
  console.log('Platform Stats:', platformStats);
  console.log('Duplicate Groups:', duplicateGroups.length);

  // Count how many master listings have ebayListingId
  const ebayInMaster = masterListings.filter(m => m.ebayListingId && m.ebayListingId !== '-');
  console.log(`Master listings with eBay: ${ebayInMaster.length}`);

  // If ebayProds.length is 1028 and ebayInMaster.length is 1022, let's find the 6 items!
  const masterEbayIds = new Set(ebayInMaster.map(m => String(m.ebayListingId)));
  const missingEbay = ebayProds.filter(p => !masterEbayIds.has(String(p.ebayListingId || p.itemId)));

  console.log(`\nMissing eBay products in Master (${missingEbay.length}):`);
  missingEbay.forEach((p, i) => {
    console.log(`${i + 1}. ID: ${p.ebayListingId || p.itemId}, SKU: "${p.sku}", Title: "${p.title}", Price: $${p.selling_price}`);
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
