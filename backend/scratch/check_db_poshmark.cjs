const mongoose = require('mongoose');
const Product = require('./models/Product');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({ source: 'poshmark' });
    console.log(`Found ${products.length} products stored in MongoDB.`);
    if (products.length > 0) {
      console.log('Stored Poshmark items:');
      products.forEach((p, idx) => {
        console.log(`${idx + 1}. Title: "${p.title}" | status: "${p.status}"`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
