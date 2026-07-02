const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const Listing = require('../models/Listing');
    
    // Find listing by ID 6a420e6b015890f7f8335322
    const listing = await Listing.findById('6a420e6b015890f7f8335322');
    
    if (listing) {
      console.log(JSON.stringify(listing.toObject(), null, 2));
    } else {
      console.log('Listing 6a420e6b015890f7f8335322 not found in DB.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
