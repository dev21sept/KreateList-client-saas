const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const userId = '6a9998d8792e9694c0368c85';
    const userObjId = new mongoose.Types.ObjectId(userId);

    const poshSample = await Product.findOne({ user: userObjId, source: 'poshmark' });
    const ebaySample = await Product.findOne({ user: userObjId, source: 'ebay' });
    const mercSample = await Product.findOne({ user: userObjId, source: 'mercari' });

    console.log('=== POSHMARK SAMPLE ===');
    console.log(JSON.stringify(poshSample, null, 2));

    console.log('=== EBAY SAMPLE ===');
    console.log(JSON.stringify(ebaySample, null, 2));

    console.log('=== MERCARI SAMPLE ===');
    console.log(JSON.stringify(mercSample, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
