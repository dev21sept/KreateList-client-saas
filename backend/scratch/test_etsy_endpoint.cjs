const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const user = await User.findOne({ 'etsyAccount.connected': true });
    if (!user) {
      console.log('No Etsy connected user found!');
      return;
    }
    
    console.log('Connected user:', user.email);
    
    // Simulate exports.getSyncedInventory
    const products = await Product.find({ user: user._id, source: 'etsy' }).sort({ updated_at: -1 });
    console.log(`Synced inventory returned ${products.length} products:`);
    products.forEach((p, idx) => {
      console.log(`${idx + 1}. Title: "${p.title}" | SKU: "${p.sku}" | Source: "${p.source}"`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
