const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const User = require('../models/User');
    const user = await User.findOne({ email: 'dev@gmail.com' });
    if (!user || !user.depopAccount || !user.depopAccount.connected) {
      console.log('No connected Depop account');
      return;
    }

    const { accessToken, sessionCookie } = user.depopAccount;
    const { gotScraping } = await import('got-scraping');
    const res = await gotScraping({
      url: 'https://webapi.depop.com/api/v1/auth/session',
      method: 'GET',
      headers: {
        'Authorization': accessToken,
        'Cookie': sessionCookie || '',
        'Accept': 'application/json'
      },
      responseType: 'json',
      throwHttpErrors: false
    });

    console.log('STATUS CODE:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('SUCCESS! Real Username:', res.body.username || res.body.username_canonical);
    } else {
      console.log('ERROR BODY:', typeof res.body === 'object' ? JSON.stringify(res.body).substring(0, 200) : String(res.body).substring(0, 200));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
