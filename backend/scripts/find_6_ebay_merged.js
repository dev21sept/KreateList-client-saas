const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const ebayProds = await Product.find({ user: userId, source: 'ebay', status: 'active' }).lean();
  console.log(`Total active eBay products in DB: ${ebayProds.length}`);

  // Let's check: If we group eBay products by normalized title
  const cleanUnicode = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeTitle = (t) => {
    if (!t) return '';
    return cleanUnicode(t).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const titleGroups = new Map();
  ebayProds.forEach(p => {
    const norm = normalizeTitle(p.title);
    if (!titleGroups.has(norm)) {
      titleGroups.set(norm, []);
    }
    titleGroups.get(norm).push(p);
  });

  console.log(`Unique normalized eBay titles: ${titleGroups.size}`);
  console.log(`Difference (duplicates in eBay alone): ${ebayProds.length - titleGroups.size}`);

  const dupTitleGroups = Array.from(titleGroups.entries()).filter(([k, list]) => list.length > 1);
  console.log(`\nDuplicate Title Groups in eBay (${dupTitleGroups.length}):`);
  dupTitleGroups.forEach(([k, list], idx) => {
    console.log(`\nDuplicate Group #${idx + 1} (Normalized: "${k}", Count: ${list.length}):`);
    list.forEach(item => {
      console.log(`  - ID: ${item.ebayListingId || item.itemId}, SKU: "${item.sku}", Price: $${item.selling_price}, Real Title: "${item.title}"`);
    });
  });

  // Let's also check if any eBay products have identical or overlapping SKUs
  const skuGroups = new Map();
  ebayProds.forEach(p => {
    const sku = (p.sku || '').trim();
    if (sku && sku !== '-') {
      if (!skuGroups.has(sku)) skuGroups.set(sku, []);
      skuGroups.get(sku).push(p);
    }
  });

  const dupSkuGroups = Array.from(skuGroups.entries()).filter(([k, list]) => list.length > 1);
  console.log(`\nDuplicate SKU Groups in eBay (${dupSkuGroups.length}):`);
  dupSkuGroups.slice(0, 10).forEach(([k, list], idx) => {
    console.log(`\nSKU Group #${idx + 1} (SKU: "${k}", Count: ${list.length}):`);
    list.forEach(item => {
      console.log(`  - ID: ${item.ebayListingId || item.itemId}, Real Title: "${item.title}"`);
    });
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
