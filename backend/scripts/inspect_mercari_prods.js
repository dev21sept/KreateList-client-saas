const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const Listing = require('../models/Listing');
const Product = require('../models/Product');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  const mercariProds = await Product.find({ 
    $or: [
      { source: 'mercari' },
      { platform: 'mercari' },
      { mercariListingId: { $exists: true, $ne: null } }
    ]
  }).limit(20);

  console.log(`Total Mercari products found: ${mercariProds.length}`);
  console.log(mercariProds.map(p => ({
    _id: p._id,
    source: p.source,
    platform: p.platform,
    title: p.title,
    sku: p.sku,
    status: p.status,
    mercariListingId: p.mercariListingId,
    liveId: p.liveId,
    item_id: p.item_id
  })));

  const tommyListing = await Listing.findOne({ sku: /9-5-26/i });
  console.log('Tommy Bahama Listing:', {
    _id: tommyListing?._id,
    sku: tommyListing?.sku,
    status: tommyListing?.status,
    mercariListingId: tommyListing?.mercariListingId,
    mercariStatus: tommyListing?.mercariStatus,
    mercariPrice: tommyListing?.mercariPrice,
    platformData: tommyListing?.platformData
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
