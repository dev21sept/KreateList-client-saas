const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const poshProds = await Product.find({ source: 'poshmark' }).limit(3).lean();
  console.log('=== Sample 3 Poshmark Products ===');
  poshProds.forEach(p => {
    console.log('Title:', p.title);
    console.log('Images (length: ' + (p.images?.length || 0) + '):', p.images?.slice(0, 3));
    console.log('Thumbnail:', p.thumbnail);
    console.log('---');
  });

  const specificProds = await Product.find({ source: 'poshmark', title: /APFU|Oak Hill|American Apparel|Tommy Hilfiger/i }).limit(4).lean();
  console.log('=== Specific Poshmark Products (APFU / Oak Hill / etc.) ===');
  specificProds.forEach(p => {
    console.log('Title:', p.title);
    console.log('Poshmark Listing ID:', p.poshmarkListingId);
    console.log('Images:', p.images);
    console.log('Thumbnail:', p.thumbnail);
    console.log('---');
  });

  const sampleListing = await Listing.findOne({ poshmarkListingId: { $exists: true, $ne: '' } }).lean();
  console.log('=== Sample Master Listing with Poshmark ===');
  console.log('Title:', sampleListing?.title);
  console.log('Listing thumbnail:', sampleListing?.thumbnail);
  console.log('PlatformData Poshmark:', sampleListing?.platformData?.poshmark);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
