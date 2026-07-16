const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function dumpCreds() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    console.log('Connected to MongoDB.');

    const userId = '6a1571887a41852eef0fdda5';
    const user = await User.findById(userId);

    if (!user) {
      console.error('User not found.');
      await mongoose.disconnect();
      return;
    }

    const token = user.depopAccount?.accessToken;
    const cookie = user.depopAccount?.sessionCookie;

    if (!token) {
      console.error('No Depop token found in DB.');
      await mongoose.disconnect();
      return;
    }

    let depopUserId = 'Not resolved yet';
    try {
      const response = await axios.get('https://webapi.depop.com/api/v1/auth/session/', {
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 5000
      });
      if (response.data && (response.data.id || response.data.user_id)) {
        depopUserId = response.data.id || response.data.user_id;
      }
    } catch (e) {
      console.warn('Could not resolve Depop User ID via direct axios:', e.message);
    }

    const result = {
      username: user.depopAccount?.username,
      depopUserId: depopUserId,
      accessToken: token,
      sessionCookie: cookie
    };

    const outPath = path.join(__dirname, 'my_depop_creds.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log('\n=======================================');
    console.log('SUCCESS! Credentials dumped successfully.');
    console.log(`File saved to: ${outPath}`);
    console.log('=======================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    await mongoose.disconnect().catch(() => {});
  }
}

dumpCreds();
