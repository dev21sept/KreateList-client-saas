const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product');
const Listing = require('../models/Listing');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const userId = '6a9998d8792e9694c0368c85';
    const userObjId = new mongoose.Types.ObjectId(userId);

    const productCounts = await Product.aggregate([
      { $match: { user: userObjId } },
      { $group: { _id: { source: '$source', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.source': 1, '_id.status': 1 } }
    ]);

    const listingCounts = await Listing.aggregate([
      { $match: { user: userObjId } },
      { $group: { _id: { platform: '$platform', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.platform': 1, '_id.status': 1 } }
    ]);

    console.log('=== PRODUCT COUNTS (By Source & Status) ===');
    console.log(JSON.stringify(productCounts, null, 2));

    console.log('=== LISTING COUNTS (By Platform & Status) ===');
    console.log(JSON.stringify(listingCounts, null, 2));

    const totalProducts = await Product.countDocuments({ user: userObjId });
    const totalListings = await Listing.countDocuments({ user: userObjId });
    console.log('Total Products:', totalProducts);
    console.log('Total Listings:', totalListings);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
