const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const Listing = require('../models/Listing');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const item = await Listing.findOne({ sku: /9-5-26/i });
  if (item) {
    console.log('ITEM FOUND BY SKU:', {
      _id: item._id,
      title: item.title,
      sku: item.sku,
      status: item.status,
      mercariListingId: item.mercariListingId,
      mercariStatus: item.mercariStatus,
      mercariPrice: item.mercariPrice,
      platformData: item.platformData?.mercari,
      listingsMap: item.listingsMap?.mercari
    });
  } else {
    console.log('No item found with sku 9-5-26');
    const items = await Listing.find({ title: /Tommy Bahama/i });
    console.log('Found by title:', items.map(i => ({
      _id: i._id,
      title: i.title,
      sku: i.sku,
      mercariListingId: i.mercariListingId,
      mercariStatus: i.mercariStatus
    })));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
