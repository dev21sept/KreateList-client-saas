const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const poshStatuses = {};
  const poshProds = await Product.find({ user: userId, source: 'poshmark' }).lean();
  poshProds.forEach(p => {
    poshStatuses[p.status] = (poshStatuses[p.status] || 0) + 1;
  });
  console.log('Poshmark product statuses in DB:', poshStatuses);

  const ebayStatuses = {};
  const ebayProds = await Product.find({ user: userId, source: 'ebay' }).lean();
  ebayProds.forEach(p => {
    ebayStatuses[p.status] = (ebayStatuses[p.status] || 0) + 1;
  });
  console.log('eBay product statuses in DB:', ebayStatuses);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
