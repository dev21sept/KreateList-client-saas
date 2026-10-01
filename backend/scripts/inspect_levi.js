const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Product = require('../models/Product');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  const ep = await Product.findOne({ user: userId, source: 'ebay', title: /Levi's 511 Straight Slim Fit Jeans Mens 30x32/i }).lean();
  const pp = await Product.findOne({ user: userId, source: 'poshmark', title: /Levi's 511 Straight Slim Fit Jeans Mens 30x32/i }).lean();

  console.log('eBay Item:', { title: ep?.title, price: ep?.selling_price || ep?.price, brand: ep?.brand, size: ep?.size, color: ep?.color });
  console.log('Poshmark Item:', { title: pp?.title, price: pp?.selling_price || pp?.price, brand: pp?.brand, size: pp?.size, color: pp?.color });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
