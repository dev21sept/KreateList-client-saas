const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');

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

    const { sessionCookie } = u.poshmarkAccount;
    const cleanCookie = cleanCookieHeader(sessionCookie);

    console.log('Step 1: Fetching create-listing to extract fresh CSRF token...');
    const pageRes = await axios.get('https://poshmark.com/create-listing', {
      headers: {
        'cookie': cleanCookie,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(pageRes.data);
    const dynamicCsrf = $('#csrftoken').attr('content') || $('meta[name="csrf-token"]').attr('content');
    console.log('Extracted dynamic CSRF token:', dynamicCsrf);

    if (!dynamicCsrf) {
      console.error('Failed to extract CSRF token.');
      process.exit(1);
    }

    // Extract user ID from jwt or ui cookie
    // Let's decode jwt payload
    let userId = '642860b53eddeb3e2cf2c6ca'; // default fallback
    const jwtCookie = sessionCookie.match(/jwt=([^;]+)/)?.[1];
    if (jwtCookie) {
      try {
        const payloadBase64 = jwtCookie.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        if (payload.user_id) {
          userId = payload.user_id;
        }
      } catch (e) {
        console.error('Error decoding jwt payload:', e);
      }
    }
    console.log('Using Poshmark User ID:', userId);

    console.log('Step 2: Creating draft with correct endpoint URL...');
    const headers = {
      'cookie': cleanCookie,
      'x-xsrf-token': dynamicCsrf,
      'x-csrf-token': dynamicCsrf,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'origin': 'https://poshmark.com',
      'referer': 'https://poshmark.com/create-listing'
    };

    const res = await axios.post(`https://poshmark.com/vm-rest/users/${userId}/posts?pm_version=2026.26.01`, {}, {
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
