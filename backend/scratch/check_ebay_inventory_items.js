const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { getValidToken } = require('./controllers/ebayController');
const Listing = require('./models/Listing');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const listing = await Listing.findOne({ platform: 'ebay', status: 'failed' });
  const userId = listing.user;
  const token = await getValidToken(userId);
  if (!token) {
    console.error('Failed to get valid token.');
    process.exit(1);
  }

  try {
    console.log('Fetching active inventory items...');
    const response = await axios.get('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Language': 'en-US'
      }
    });
    console.log(`Total inventory items on eBay: ${response.data.total}`);
    if (response.data.inventoryItems) {
      let totalQty = 0;
      for (const item of response.data.inventoryItems) {
        const qty = item.availability?.shipToLocationAvailability?.quantity || 0;
        totalQty += qty;
        console.log(`SKU: ${item.sku} | Qty: ${qty} | Title: ${item.product?.title?.substring(0, 50)}`);
      }
      console.log(`Total Quantity of all items: ${totalQty}`);
    }
  } catch (err) {
    console.error('Error fetching inventory items:', err.response?.data || err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
