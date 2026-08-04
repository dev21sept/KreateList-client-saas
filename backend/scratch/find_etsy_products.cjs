const mongoose = require('mongoose');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({ source: 'etsy' });
    console.log(`Found ${products.length} products with source "etsy":`);
    products.forEach((p, idx) => {
      console.log(`${idx + 1}. Title: "${p.title}" | SKU: "${p.sku}" | Status: "${p.status}"`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
