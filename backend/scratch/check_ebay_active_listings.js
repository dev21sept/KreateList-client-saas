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
    const inventoryRes = await axios.get('https://api.ebay.com/sell/inventory/v1/inventory_item?limit=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Language': 'en-US'
      }
    });
    console.log(`Total inventory items on eBay: ${inventoryRes.data.total}`);

    console.log('Fetching offers...');
    const offersRes = await axios.get('https://api.ebay.com/sell/inventory/v1/offer?limit=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Language': 'en-US'
      }
    });
    console.log(`Total offers on eBay: ${offersRes.data.total}`);
    
    if (offersRes.data.offers) {
      const activeOffers = offersRes.data.offers.filter(o => o.status === 'PUBLISHED');
      console.log(`Published (live) offers count: ${activeOffers.length}`);
      for (const o of activeOffers) {
        console.log(`  SKU: ${o.sku} | OfferID: ${o.offerId} | ListingID: ${o.listingId}`);
      }
    }
  } catch (err) {
    console.error('Error fetching inventory/offers:', err.response?.data || err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
