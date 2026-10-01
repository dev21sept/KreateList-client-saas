const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');
const Listing = require('./models/Listing');

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const userId = '6a9998d8792e9694c0368c85';

  const levis = await Listing.findOne({ user: userId, title: /Levi's 511 Straight Leg Jeans Mens 33x32/i });
  console.log('--- LEVI 33x32 LISTING IN DB ---');
  if (levis) {
    console.log(JSON.stringify({
      id: levis._id,
      title: levis.title,
      images: levis.images,
      platformData: levis.platformData
    }, null, 2));
  } else {
    console.log('Listing not found by exact regex, searching all with 33x32:');
    const items = await Listing.find({ user: userId, title: /33x32/i }).limit(5);
    items.forEach(it => console.log(it.title, it.platformData?.ebay));
  }

  await mongoose.disconnect();
}
check();
