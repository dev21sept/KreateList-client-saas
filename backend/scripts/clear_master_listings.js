const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Listing = require('../models/Listing');
  const Product = require('../models/Product');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  if (!user) {
    console.error('User ramayali not found');
    process.exit(1);
  }

  const userId = user._id;

  const countBefore = await Listing.countDocuments({ user: userId });
  console.log(`Current Master Listings for ${user.email}: ${countBefore}`);

  const deleteRes = await Listing.deleteMany({ user: userId });
  console.log(`Deleted ${deleteRes.deletedCount} Master Listings.`);

  const countAfter = await Listing.countDocuments({ user: userId });
  console.log(`Master Listings count after clear: ${countAfter}`);

  // Verify Product channels inventory is completely safe and intact
  const ebayProd = await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' });
  const poshProd = await Product.countDocuments({ user: userId, source: 'poshmark', status: 'active' });
  const mercProd = await Product.countDocuments({ user: userId, source: 'mercari', status: 'active' });

  console.log('\n=== Channel Products (Preserved & Safe) ===');
  console.log('eBay Active Products:', ebayProd);
  console.log('Poshmark Active Products:', poshProd);
  console.log('Mercari Active Products:', mercProd);

  process.exit(0);
}

run().catch(e => {
  console.error('Error clearing master listings:', e);
  process.exit(1);
});
