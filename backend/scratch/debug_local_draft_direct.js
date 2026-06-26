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

    console.log('Testing /vm-rest/posts?pm_version=2026.23.01 with EXACT working profile headers...');
    
    const headers = {
      'cookie': cleanCookie,
      'x-xsrf-token': csrfToken,
      'x-csrf-token': csrfToken,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'origin': 'https://poshmark.com',
      'referer': 'https://poshmark.com/create-listing'
    };

    const res = await axios.post('https://poshmark.com/vm-rest/posts?pm_version=2026.23.01', {
      post: { autolist_draft: false }
    }, {
      headers
    });

    console.log('Post Status:', res.status);
    console.log('Post Response Data:', JSON.stringify(res.data, null, 2));

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
