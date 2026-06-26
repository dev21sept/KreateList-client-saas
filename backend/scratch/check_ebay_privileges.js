const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { getValidToken } = require('./controllers/ebayController');
const Listing = require('./models/Listing');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  // Find a failed listing to get a userId
  const listing = await Listing.findOne({ platform: 'ebay', status: 'failed' });
  if (!listing) {
    console.log('No failed eBay listings found in database to extract user ID.');
    process.exit(0);
  }
  
  const userId = listing.user;
  console.log(`Checking privileges for user ID: ${userId}`);
  const token = await getValidToken(userId);
  if (!token) {
    console.error('Failed to get valid token.');
    process.exit(1);
  }

  try {
    const response = await axios.get('https://api.ebay.com/sell/account/v1/privilege', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Language': 'en-US'
      }
    });
    console.log('--- EBAY PRIVILEGES & LIMITS ---');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error fetching privileges:', err.response?.data || err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
