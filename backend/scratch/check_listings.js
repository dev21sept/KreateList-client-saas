const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';
console.log('Connecting to database:', mongoUri);

mongoose.connect(mongoUri)
  .then(async () => {
    const Listing = require('../models/Listing');
    console.log('Fetching recent eBay listings...');
    const listings = await Listing.find({ platform: 'ebay' })
      .sort({ updatedAt: -1 })
      .limit(30);

    console.log(`Found ${listings.length} listings. details:`);
    for (const l of listings) {
      console.log('----------------------------------------------------');
      console.log(`ID: ${l._id}`);
      console.log(`Title: ${l.title}`);
      console.log(`SKU: ${l.sku}`);
      console.log(`Status: ${l.status}`);
      console.log(`Ebay URL: ${l.ebayUrl}`);
      console.log(`Error Message: ${l.errorMessage}`);
      console.log(`Updated At: ${l.updatedAt}`);
    }

    // Let's also check if there are any other failed listings on other platforms
    const failedListings = await Listing.find({ status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(10);
    if (failedListings.length > 0) {
      console.log('\n====================================================');
      console.log('FAILED LISTINGS (ANY PLATFORM):');
      for (const fl of failedListings) {
        console.log(`ID: ${fl._id} | Platform: ${fl.platform} | Title: ${fl.title} | Error: ${fl.errorMessage}`);
      }
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
