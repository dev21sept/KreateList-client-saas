const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Product = require('../models/Product');
  const User = require('../models/User');

  const user = await User.findOne({ email: 'ramayali.creative@gmail.com' });

  const mercariItem = await Product.findOne({ user: user._id, source: 'mercari', title: /Old Navy Wide Leg Cropped Sweatpants/i }).lean();
  console.log('Mercari item:', mercariItem ? { title: mercariItem.title, sku: mercariItem.sku, mercariListingId: mercariItem.mercariListingId, price: mercariItem.selling_price } : 'NOT FOUND');

  // Fuzzy search eBay for anything with "Old Navy" and "Sweatpants" and "Cropped"
  const candidates = await Product.find({ user: user._id, source: 'ebay', title: /old navy/i }).select('title sku ebayListingId').lean();
  console.log('\neBay items with "Old Navy" in title:', candidates.length);
  candidates.forEach(c => console.log(' -', c.title, '| sku:', c.sku));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
