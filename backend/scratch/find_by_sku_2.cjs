const mongoose = require('mongoose');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({ sku: 'VA5A-88862' });
    console.log(`Found ${products.length} products with SKU "VA5A-88862":`);
    products.forEach((p, idx) => {
      console.log(JSON.stringify(p, null, 2));
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
