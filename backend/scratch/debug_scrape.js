const mongoose = require('mongoose');
const { scrapePoshmarkCloset } = require('../services/externalImportService');
const User = require('../models/User');

async function debug() {
  try {
    // Load env variables
    require('dotenv').config({ path: '../.env' });
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    console.log('Connected.');

    // Find a user with a poshmark account
    const user = await User.findOne({ 'poshmarkAccount.username': { $exists: true, $ne: '' } });
    if (!user) {
      console.log('No user with a connected Poshmark account found in DB.');
      // Let's use a dummy/standard username to test
      const testUsername = 'shop_vintage';
      console.log(`Testing with dummy username: ${testUsername}`);
      const results = await scrapePoshmarkCloset(testUsername);
      console.log(`Success! Found ${results.length} items.`);
    } else {
      const username = user.poshmarkAccount.username;
      console.log(`Found user: ${user.email} with Poshmark username: ${username}`);
      console.log('Running scrapePoshmarkCloset...');
      const results = await scrapePoshmarkCloset(username);
      console.log(`Success! Found ${results.length} items.`);
    }
  } catch (error) {
    console.error('ERROR during debug scraping:');
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

debug();
