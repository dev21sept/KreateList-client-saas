const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  console.log('User found:', user?.email);
  console.log('Poshmark account:', {
    connected: user?.poshmarkAccount?.connected,
    username: user?.poshmarkAccount?.username,
    hasCookie: !!user?.poshmarkAccount?.sessionCookie,
    hasCsrf: !!user?.poshmarkAccount?.csrfToken
  });

  const username = user?.poshmarkAccount?.username || 'ramayali';
  const cookie = user?.poshmarkAccount?.sessionCookie || '';
  const csrf = user?.poshmarkAccount?.csrfToken || '';

  // Test fetching 1 page of Poshmark posts from API
  const apiUrl = `https://poshmark.com/vm-rest/users/${username}/posts?request_context=closet&count=5`;
  console.log('Testing Poshmark API call to:', apiUrl);

  try {
    const res = await axios.get(apiUrl, {
      headers: {
        'cookie': cookie,
        'x-csrf-token': csrf,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    const posts = res.data?.data || [];
    console.log(`Fetched ${posts.length} sample posts.`);
    posts.forEach((p, idx) => {
      console.log(`\n--- Post #${idx + 1}: ${p.title} ---`);
      console.log('Cover Shot:', p.cover_shot);
      console.log('Pictures (first 2):', p.pictures?.slice(0, 2));
    });
  } catch (err) {
    console.error('API call error:', err.response?.status, err.message);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
