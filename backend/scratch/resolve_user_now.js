const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function resolveUserNow() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    console.log('Connected to MongoDB.');

    // Find the user
    const userId = '6a1571887a41852eef0fdda5';
    const user = await User.findById(userId);

    if (!user) {
      console.error('User not found.');
      await mongoose.disconnect();
      return;
    }

    const token = user.depopAccount.accessToken;
    if (!token) {
      console.error('No Depop token found for this user.');
      await mongoose.disconnect();
      return;
    }

    console.log('Fetching real username from Depop API using token...');
    const axiosConfig = {
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    };
    
    const proxyUrl = process.env.HTTP_PROXY_URL;
    if (proxyUrl) {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    const response = await axios.get('https://webapi.depop.com/api/v1/auth/session/', axiosConfig);
    
    if (response.data && response.data.username) {
      const realUsername = response.data.username;
      console.log(`Successfully fetched real username: ${realUsername}`);
      
      // Update in DB
      user.depopAccount.username = realUsername;
      user.depopAccount.connected = true;
      user.markModified('depopAccount');
      await user.save();
      
      console.log('Database updated successfully!');
    } else {
      console.error('Could not find username in Depop response:', response.data);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (err) {
    console.error('Error resolving username:', err.message);
    if (err.response) {
      console.error('API Response Status:', err.response.status);
      console.error('API Response Data:', err.response.data);
    }
    process.exit(1);
  }
}

resolveUserNow();
