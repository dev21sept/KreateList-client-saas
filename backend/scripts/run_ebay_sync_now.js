const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const ebayController = require('../controllers/ebayController');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  console.log(`Running eBay syncInventory for ${user.email}...`);

  const req = { user: { id: userId.toString(), _id: userId } };
  let jsonResult = null;
  const res = {
    status: () => ({
      json: (data) => { jsonResult = data; }
    }),
    json: (data) => { jsonResult = data; }
  };

  await ebayController.syncInventory(req, res);

  console.log('Sync result:', jsonResult);

  const activeEbayCount = await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' });
  const inactiveEbayCount = await Product.countDocuments({ user: userId, source: 'ebay', status: 'inactive' });

  console.log(`\n=== Post-Sync Product Counts ===`);
  console.log(`Active eBay Products: ${activeEbayCount}`);
  console.log(`Inactive eBay Products: ${inactiveEbayCount}`);

  process.exit(0);
}

run().catch(e => {
  console.error('Sync error:', e);
  process.exit(1);
});
