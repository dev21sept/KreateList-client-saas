const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { getValidToken } = require('../controllers/ebayController');
const { getInventoryItems } = require('../services/ebayService');

async function checkEbay() {
  try {
    require('dotenv').config({ path: '../.env' });
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    console.log('Connected.');

    const users = await User.find({});
    console.log(`Total users in DB: ${users.length}`);

    for (const user of users) {
      const isConnected = user.ebayAccount?.connected;
      console.log(`User: ${user.email} | eBay Connected: ${isConnected} | Username: ${user.ebayAccount?.username || 'N/A'}`);
      
      if (isConnected) {
        console.log('Attempting to validate token...');
        const token = await getValidToken(user._id);
        if (!token) {
          console.log('Token validation failed (token is null or failed to refresh).');
        } else {
          console.log('Token validated. Attempting to fetch live inventory from eBay API...');
          try {
            const data = await getInventoryItems(token, 10, 0);
            console.log('eBay Inventory fetch success! Total inventory items on eBay:', data.total);
            console.log('Inventory sample items:', (data.inventoryItems || []).map(i => i.sku));
          } catch (apiErr) {
            console.error('eBay API Inventory fetch failed:', apiErr.response?.data ? JSON.stringify(apiErr.response.data, null, 2) : apiErr.message);
          }
        }
      }
      
      const localProducts = await Product.find({ user: user._id });
      console.log(`Local cached eBay products in DB: ${localProducts.length}`);
      if (localProducts.length > 0) {
        console.log('Local products sample titles:', localProducts.slice(0, 5).map(p => p.title));
      }
    }
  } catch (err) {
    console.error('Debug script crash:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

checkEbay();
