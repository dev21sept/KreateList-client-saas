const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Listing = require('../models/Listing');
  const Product = require('../models/Product');

  const titles = [
    'Tommy Bahama Cargo Shorts Mens M Blue Elastic Waist',
    'US Army APFU 8415-01-623-8626',
    "Levi's 511 Straight Slim Fit Jeans Mens 30x32",
    "VTG Levi's 517 Bootcut Jeans Mens 38x30",
    'Tommy Bahama Relax Chino Pants Mens 38 Khaki',
    'Mack Weldon Ace Sweatpants Mens M Heather Brown'
  ];

  for (const t of titles) {
    console.log(`\n======================================================`);
    console.log(`SEARCH FOR: "${t}"`);
    const listings = await Listing.find({ title: new RegExp(t.split(' ')[0], 'i') }).lean();
    for (const l of listings) {
      if (l.title.toLowerCase().includes(t.toLowerCase().substring(0, 15))) {
        console.log(`\n[LISTING] _id: ${l._id}`);
        console.log(`  Title: "${l.title}"`);
        console.log(`  SKU: "${l.sku}" | Price: $${l.price}`);
        console.log(`  eBay: id=${l.ebayListingId}, status=${l.ebayStatus}, price=${l.ebayPrice}`);
        console.log(`  Poshmark: id=${l.poshmarkListingId}, status=${l.poshmarkStatus}, price=${l.poshmarkPrice}`);
        console.log(`  Mercari: id=${l.mercariListingId}, status=${l.mercariStatus}, price=${l.mercariPrice}`);
        console.log(`  Thumb: ${l.thumbnail}`);
        console.log(`  platformData:`, JSON.stringify(l.platformData, null, 2));

        // Check the actual Products linked
        if (l.ebayListingId) {
          const ep = await Product.findOne({ $or: [{ ebayListingId: l.ebayListingId }, { itemId: l.ebayListingId }] }).lean();
          console.log(`  -> Actual eBay Product: Title="${ep?.title}", Price=$${ep?.selling_price || ep?.price}, Thumb=${ep?.thumbnail || ep?.images?.[0]}`);
        }
        if (l.poshmarkListingId) {
          const pp = await Product.findOne({ poshmarkListingId: l.poshmarkListingId }).lean();
          console.log(`  -> Actual Poshmark Product: Title="${pp?.title}", Price=$${pp?.selling_price || pp?.price}, Thumb=${pp?.thumbnail || pp?.images?.[0]}`);
        }
        if (l.mercariListingId) {
          const mp = await Product.findOne({ mercariListingId: l.mercariListingId }).lean();
          console.log(`  -> Actual Mercari Product: Title="${mp?.title}", Price=$${mp?.selling_price || mp?.price}, Thumb=${mp?.thumbnail || mp?.images?.[0]}`);
        }
      }
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
