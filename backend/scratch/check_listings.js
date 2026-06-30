const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const Listing = require('../models/Listing');
    const listings = await Listing.find({}).sort({ createdAt: -1 }).limit(3);
    
    console.log(`Found ${listings.length} listings in DB.`);
    listings.forEach((listing, idx) => {
      console.log(`Listing #${idx + 1}: ${listing.title}`);
      console.log(`Images:`, listing.images);
      console.log('--------------------------------------------------\n');
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
