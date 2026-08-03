const mongoose = require('mongoose');
const User = require('./models/User');
const { scrapePoshmarkCloset } = require('./services/externalImportService');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const user = await User.findOne({ 'poshmarkAccount.connected': true });
    if (!user) {
      console.log('No connected Poshmark account found!');
      return;
    }
    
    console.log('Using Poshmark account username:', user.poshmarkAccount.username);
    const cleanUsername = user.poshmarkAccount.username;
    
    // We want to debug what Poshmark API returns. Let's call scrapePoshmarkCloset,
    // but also we can debug the raw response!
    // Since scrapePoshmarkCloset is imported, let's temporarily hook into axios to inspect the raw response!
    const axios = require('axios');
    const originalGet = axios.get;
    axios.get = async function(url, config) {
      console.log('Intercepted axios.get request to:', url);
      const res = await originalGet.call(axios, url, config);
      if (url.includes('/vm-rest/users/')) {
        const data = res.data;
        if (data && data.data && data.data.length > 0) {
          const firstPost = data.data[0];
          console.log('Raw Poshmark post fields:');
          console.log(JSON.stringify({
            id: firstPost.id,
            title: firstPost.title,
            status: firstPost.status,
            active_item: firstPost.active_item,
            inventory: firstPost.inventory,
            availability: firstPost.availability
          }, null, 2));
        }
      }
      return res;
    };

    const scraped = await scrapePoshmarkCloset(cleanUsername, user.poshmarkAccount);
    console.log('First scraped item processed output:', scraped[0]);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
