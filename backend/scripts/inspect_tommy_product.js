const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const Listing = require('../models/Listing');
const Product = require('../models/Product');
const User = require('../models/User');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const listing = await Listing.findOne({ sku: /9-5-26/i });
  console.log('LISTING:', {
    _id: listing?._id,
    sku: listing?.sku,
    title: listing?.title,
    mercariListingId: listing?.mercariListingId,
    mercariStatus: listing?.mercariStatus,
    platformData: listing?.platformData?.mercari
  });

  const products = await Product.find({
    $or: [
      { mercariListingId: 'm46831018170' },
      { sku: /9-5-26/i },
      { title: /Tommy Bahama/i }
    ]
  });

  console.log('MATCHING PRODUCTS:', products.map(p => ({
    _id: p._id,
    source: p.source,
    platform: p.platform,
    title: p.title,
    sku: p.sku,
    status: p.status,
    mercariListingId: p.mercariListingId,
    selling_price: p.selling_price
  })));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
