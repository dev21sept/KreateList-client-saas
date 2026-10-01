const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Listing = require('../models/Listing');
  const Product = require('../models/Product');

  const items = await Listing.find({ poshmarkListingId: { $exists: true, $ne: '' }, title: /APFU|Oak Hill|Tommy Hilfiger/i }).limit(5).lean();
  console.log(`Found ${items.length} master listings:`);
  items.forEach(l => {
    console.log('\n--- Master Listing ---');
    console.log('Title:', l.title);
    console.log('eBay ID:', l.ebayListingId);
    console.log('Poshmark ID:', l.poshmarkListingId);
    console.log('Poshmark Thumbnail:', l.platformData?.poshmark?.thumbnail);
    console.log('Poshmark Images[0]:', l.platformData?.poshmark?.images?.[0]);
  });

  const totalMaster = await Listing.countDocuments();
  const ebayActive = await Listing.countDocuments({ ebayListingId: { $exists: true, $ne: '' } });
  const poshActive = await Listing.countDocuments({ poshmarkListingId: { $exists: true, $ne: '' } });
  const mercActive = await Listing.countDocuments({ mercariListingId: { $exists: true, $ne: '' } });

  console.log('\n=== Database Integrity Check ===');
  console.log('Total Master Listings:', totalMaster);
  console.log('eBay Active Listings:', ebayActive);
  console.log('Poshmark Active Listings:', poshActive);
  console.log('Mercari Active Listings:', mercActive);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
