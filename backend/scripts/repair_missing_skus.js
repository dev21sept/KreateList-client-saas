/**
 * Safely reports or repairs records that have no SKU.
 *
 * Dry run (default): node scripts/repair_missing_skus.js
 * Apply:             node scripts/repair_missing_skus.js --apply
 *
 * This script never merges or deletes records. Duplicate groups require human
 * review because two marketplace listings can legitimately share a SKU.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');
const missingSkuQuery = {
  $or: [
    { sku: { $exists: false } },
    { sku: null },
    { sku: '' },
    { sku: /^\s+$/ }
  ]
};

async function buildOperations(collection, prefix) {
  const records = await collection
    .find(missingSkuQuery, { projection: { _id: 1 } })
    .toArray();

  return records.map(record => ({
    updateOne: {
      filter: { _id: record._id, ...missingSkuQuery },
      update: { $set: { sku: `${prefix}-${record._id.toString().slice(-12).toUpperCase()}` } }
    }
  }));
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const listingOps = await buildOperations(db.collection('listings'), 'AUTO-L');
  const productOps = await buildOperations(db.collection('products'), 'AUTO-P');

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    listingsMissingSku: listingOps.length,
    productsMissingSku: productOps.length
  }, null, 2));

  if (apply) {
    const listingResult = listingOps.length
      ? await db.collection('listings').bulkWrite(listingOps, { ordered: false })
      : null;
    const productResult = productOps.length
      ? await db.collection('products').bulkWrite(productOps, { ordered: false })
      : null;
    console.log(JSON.stringify({
      listingsUpdated: listingResult?.modifiedCount || 0,
      productsUpdated: productResult?.modifiedCount || 0
    }, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(async error => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
