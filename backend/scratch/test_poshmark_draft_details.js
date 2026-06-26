const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');

function getDomainFromCookie(sessionCookie) {
  if (sessionCookie) {
    const match = sessionCookie.match(/elister_domain=([^;]+)/);
    if (match && match[1]) return match[1];
  }
  return 'poshmark.com';
}

function cleanCookieHeader(sessionCookie) {
  if (!sessionCookie) return '';
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

function getPoshmarkHeaders(sessionCookie, csrfToken) {
  const domain = getDomainFromCookie(sessionCookie);
  const cleanCookie = cleanCookieHeader(sessionCookie);
  
  return {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    'cookie': cleanCookie,
    'x-csrf-token': csrfToken || '',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': `https://${domain}/create-listing`
  };
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const u = await User.findOne({ email: 'theantiquestuff@gmail.com' });
  if (!u || !u.poshmarkAccount || !u.poshmarkAccount.sessionCookie) {
    console.error('Connected Poshmark user not found in database.');
    process.exit(1);
  }

  const { sessionCookie, csrfToken } = u.poshmarkAccount;
  const domain = getDomainFromCookie(sessionCookie);
  const headers = getPoshmarkHeaders(sessionCookie, csrfToken);
  const data = { post: { autolist_draft: false } };

  console.log('--- TEST REQUEST DETAILS ---');
  console.log('URL:', `https://${domain}/vm-rest/posts?pm_version=2026.23.01`);
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('Data (JSON):', JSON.stringify(data, null, 2));

  try {
    const res = await axios.post(`https://${domain}/vm-rest/posts?pm_version=2026.23.01`, data, {
      headers,
      timeout: 10000
    });
    console.log('\n--- SUCCESS RESPONSE ---');
    console.log('Status:', res.status);
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('\n--- ERROR RESPONSE ---');
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Headers:', JSON.stringify(err.response.headers, null, 2));
      console.log('Response Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.log('Error Message:', err.message);
    }
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
