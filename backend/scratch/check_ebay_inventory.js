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

  // Querying with a specific SKU
  const testSku = 'KL30A-47030';
  console.log(`Querying offers for SKU: ${testSku}`);
  try {
    const response = await axios.get(`https://api.ebay.com/sell/inventory/v1/offer?sku=${testSku}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Language': 'en-US'
      }
    });
    console.log('--- EBAY OFFERS ---');
    console.log(`Total offers: ${response.data.total}`);
    if (response.data.offers) {
      for (const offer of response.data.offers) {
        console.log(`Offer ID: ${offer.offerId} | SKU: ${offer.sku} | Status: ${offer.status} | Listing ID: ${offer.listingId}`);
      }
    }
  } catch (err) {
    console.error('Error fetching offers:', err.response?.data || err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
