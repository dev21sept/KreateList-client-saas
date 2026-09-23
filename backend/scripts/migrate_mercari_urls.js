const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

async function migrate() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/elister';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  console.log('=== MIGRATING MERCARI URLS TO /us/item/ ===');

  // 1. Products collection
  const prods = await db.collection('products').find({
    mercariUrl: { $regex: /mercari\.com\/item\// }
  }).toArray();
  console.log(`Found ${prods.length} products with old Mercari URLs`);
  for (const p of prods) {
    const newUrl = p.mercariUrl.replace('mercari.com/item/', 'mercari.com/us/item/');
    await db.collection('products').updateOne(
      { _id: p._id },
      { $set: { mercariUrl: newUrl, updated_at: new Date() } }
    );
  }
  console.log(`Updated ${prods.length} products!`);

  // 2. Listings collection
  const listings = await db.collection('listings').find({
    $or: [
      { mercariUrl: { $regex: /mercari\.com\/item\// } },
      { 'platformData.mercari.url': { $regex: /mercari\.com\/item\// } }
    ]
  }).toArray();
  console.log(`Found ${listings.length} listings with old Mercari URLs`);
  for (const l of listings) {
    const updates = {};
    if (l.mercariUrl && l.mercariUrl.includes('mercari.com/item/')) {
      updates.mercariUrl = l.mercariUrl.replace('mercari.com/item/', 'mercari.com/us/item/');
    }
    if (l.platformData?.mercari?.url && l.platformData.mercari.url.includes('mercari.com/item/')) {
      updates['platformData.mercari.url'] = l.platformData.mercari.url.replace('mercari.com/item/', 'mercari.com/us/item/');
    }
    if (Object.keys(updates).length > 0) {
      await db.collection('listings').updateOne(
        { _id: l._id },
        { $set: updates }
      );
    }
  }
  console.log(`Updated ${listings.length} listings!`);

  // 3. Orders collection
  const orders = await db.collection('orders').find({
    orderUrl: { $regex: /mercari\.com\/item\// }
  }).toArray();
  console.log(`Found ${orders.length} orders with old Mercari URLs`);
  for (const o of orders) {
    const newOrderUrl = o.orderUrl.replace('mercari.com/item/', 'mercari.com/us/item/');
    await db.collection('orders').updateOne(
      { _id: o._id },
      { $set: { orderUrl: newOrderUrl } }
    );
  }
  console.log(`Updated ${orders.length} orders!`);

  console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

migrate().catch(console.error);
