const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getDomainFromCookie(sessionCookie) {
  if (!sessionCookie) return 'poshmark.com';
  const match = sessionCookie.match(/elister_domain=([^;]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return 'poshmark.com';
}

function cleanCookieHeader(sessionCookie) {
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

function getPoshmarkHeaders(sessionCookie, csrfToken) {
  const domain = getDomainFromCookie(sessionCookie);
  const cleanCookie = cleanCookieHeader(sessionCookie);
  return {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'cookie': cleanCookie,
    'x-xsrf-token': csrfToken,
    'x-csrf-token': csrfToken,
    'origin': `https://${domain}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `https://${domain}/feed`
  };
}

const dotenv = require('dotenv');
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
    const u = await mongoose.connection.db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('6a1571887a41852eef0fdda5') });
    if (!u) {
      console.log('No user found');
      process.exit(0);
    }

    const { sessionCookie, csrfToken } = u.poshmarkAccount;
    const domain = getDomainFromCookie(sessionCookie);
    
    console.log('Fetching create-listing page...');
    const pageRes = await axios.get(`https://${domain}/create-listing`, {
      headers: getPoshmarkHeaders(sessionCookie, csrfToken)
    });
    
    const htmlPath = path.join(__dirname, 'create-listing.html');
    fs.writeFileSync(htmlPath, pageRes.data);
    console.log('Saved HTML to:', htmlPath);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
