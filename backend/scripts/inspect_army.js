const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');
  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  const prods = await Product.find({ user: userId, title: /US Army APFU/i }).lean();
  prods.forEach(p => {
    console.log(`[${p.source}] Title: "${p.title}", Price: $${p.selling_price || p.price}`);
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
