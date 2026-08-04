const mongoose = require('mongoose');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({ 
      $or: [
        { poshmarkListingId: { $ne: null } },
        { depopListingId: { $ne: null } },
        { etsyListingId: { $ne: null } }
      ]
    });
    
    console.log(`Found ${products.length} products with external platform listing IDs:`);
    products.forEach((p, idx) => {
      console.log(`${idx + 1}. Title: "${p.title}" | SKU: "${p.sku}" | Source: "${p.source}" | ebayId: "${p.ebayListingId}" | poshId: "${p.poshmarkListingId}" | etsyId: "${p.etsyListingId}"`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
