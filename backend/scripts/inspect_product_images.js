const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');

  const p = await Product.findOne({ title: /Mack Weldon Ace Sweatpants/i, source: 'ebay' }).lean();
  console.log('eBay Product for Mack Weldon:', {
    title: p?.title,
    source: p?.source,
    images: p?.images,
    selling_price: p?.selling_price,
    sku: p?.sku
  });

  const merc = await Product.findOne({ title: /Tommy Bahama Cargo Shorts/i, source: 'mercari' }).lean();
  console.log('Mercari Product for Tommy Bahama:', {
    title: merc?.title,
    source: merc?.source,
    images: merc?.images,
    selling_price: merc?.selling_price,
    sku: merc?.sku
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
