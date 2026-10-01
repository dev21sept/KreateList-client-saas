const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const ebayCount = await Product.countDocuments({ status: 'active', source: 'ebay' });
  const poshCount = await Product.countDocuments({ status: { $in: ['active', 'live'] }, source: 'poshmark' });
  const mercCount = await Product.countDocuments({ status: 'active', source: 'mercari' });
  const listingTotal = await Listing.countDocuments();
  const listingActive = await Listing.countDocuments({ status: { $in: ['active', 'published'] } });
  const listingSold = await Listing.countDocuments({ status: 'sold' });

  console.log('Product and Listing counts:', { ebayCount, poshCount, mercCount, listingTotal, listingActive, listingSold });

  // Let's inspect some sample products from Mercari
  const mercariSample = await Product.find({ status: 'active', source: 'mercari' }).limit(10).lean();
  console.log('\n--- Sample Mercari Products ---');
  mercariSample.forEach(m => {
    console.log(`[Mercari] Title: "${m.title}", Price: $${m.selling_price || m.price}, SKU: ${m.sku}, ID: ${m.mercariListingId || m._id}`);
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
