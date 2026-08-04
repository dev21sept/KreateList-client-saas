const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const { getSyncedInventory: getEtsyInventory } = require('./controllers/etsyController');
const { getSyncedInventory: getEbayInventory } = require('./controllers/ebayController');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const user = await User.findOne({ email: 'dev@gmail.com' });
    const req = { user: { id: user._id.toString() } };
    
    // Simulate res
    const makeRes = (label) => ({
      status: function(code) {
        console.log(`[${label}] Status:`, code);
        return this;
      },
      json: function(data) {
        console.log(`[${label}] Data count:`, data.data ? data.data.length : 'none');
        if (data.data && data.data.length > 0) {
          console.log(`[${label}] Items:`);
          data.data.forEach((p, idx) => {
            console.log(`  ${idx + 1}. Title: "${p.title}" | SKU: "${p.sku}" | Source: "${p.source}"`);
          });
        }
      }
    });

    await getEbayInventory(req, makeRes('EBAY'));
    await getEtsyInventory(req, makeRes('ETSY'));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
