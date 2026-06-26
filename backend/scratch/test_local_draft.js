const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');

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
  const u = await User.findById("6a1571887a41852eef0fdda5");
  if (!u || !u.poshmarkAccount || !u.poshmarkAccount.sessionCookie) {
    console.error('Local user not found or not connected to Poshmark.');
    process.exit(1);
  }

  const { sessionCookie, csrfToken } = u.poshmarkAccount;
  const domain = getDomainFromCookie(sessionCookie);
  const headers = getPoshmarkHeaders(sessionCookie, csrfToken);
  const data = { post: { autolist_draft: false } };

  const testEndpoints = [
    { name: 'vm-rest/posts with pm_version', url: `https://${domain}/vm-rest/posts?pm_version=2026.23.01` },
    { name: 'vm-rest/posts without pm_version', url: `https://${domain}/vm-rest/posts` },
    { name: 'api/v1/posts', url: `https://${domain}/api/v1/posts` },
    { name: 'api/posts', url: `https://${domain}/api/posts` }
  ];

  for (const ep of testEndpoints) {
    console.log(`\n--- TESTING ENDPOINT: ${ep.name} ---`);
    console.log('URL:', ep.url);
    try {
      const res = await axios.post(ep.url, data, {
        headers,
        timeout: 10000
      });
      console.log('SUCCESS RESPONSE:');
      console.log('Status:', res.status);
      console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.log('ERROR RESPONSE:');
      if (err.response) {
        console.log('Status:', err.response.status);
        console.log('Response:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.log('Error:', err.message);
      }
    }
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
