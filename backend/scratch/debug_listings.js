const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Listing = mongoose.model('Listing', new mongoose.Schema({}, { strict: false }));

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  console.log("Connected to MongoDB!");
  
  const listings = await Listing.find({}).sort({ createdAt: -1 }).limit(5);
  console.log(`Found ${listings.length} listings:`);
  listings.forEach((l, i) => {
    console.log(`\n[${i}] Listing:`, {
      _id: l._id,
      title: l.title,
      platform: l.platform,
      brand: l.brand,
      size: l.size,
      color: l.color,
      categoryId: l.categoryId,
      category: l.category,
      fulfillmentPolicyId: l.fulfillmentPolicyId,
      paymentPolicyId: l.paymentPolicyId,
      returnPolicyId: l.returnPolicyId,
      locationKey: l.locationKey,
      packageWeight: l.packageWeight,
      packageDimensions: l.packageDimensions,
      itemSpecifics: l.itemSpecifics
    });
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
