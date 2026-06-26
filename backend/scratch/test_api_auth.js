const mongoose = require('mongoose');
const axios = require('axios');

function cleanCookieHeader(sessionCookie) {
  if (!sessionCookie) return '';
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.findOne({ 'poshmarkAccount.username': { $exists: true, $ne: '' } });
    if (!u) {
      console.log('No user found');
      process.exit(0);
    }

    const { sessionCookie, csrfToken } = u.poshmarkAccount;
    const cleanCookie = cleanCookieHeader(sessionCookie);

    console.log('Testing /vm-rest/users/self with saved cookies...');
    const selfRes = await axios.get('https://poshmark.com/vm-rest/users/self', {
      headers: {
        'cookie': cleanCookie,
        'x-csrf-token': csrfToken,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log('Self Status:', selfRes.status);
    console.log('Self Response Data:', JSON.stringify(selfRes.data, null, 2));

  } catch (err) {
    console.error('API Error:', err.message);
    if (err.response) {
      console.error('API Response Status:', err.response.status);
      console.error('API Response Data:', JSON.stringify(err.response.data));
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
