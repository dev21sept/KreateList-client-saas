const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = mongoose.models.Listing || mongoose.model('Listing', new mongoose.Schema({}, { strict: false }));
  const items = await Listing.find({ title: /Oak Hill Dress Pants/i }).lean();
  items.forEach(i => console.log(i._id.toString(), '| sku:', JSON.stringify(i.sku), '| ebayListingId:', i.ebayListingId));

  const stillBad = await Listing.find({ sku: { $regex: /^(AUTO-[LP]-|SKU-)/i } }).countDocuments();
  console.log('Remaining AUTO-/SKU- listings:', stillBad);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
