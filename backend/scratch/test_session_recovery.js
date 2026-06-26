const mongoose = require('mongoose');
const axios = require('axios');

function mergeSetCookies(currentCookieStr, setCookieHeader) {
  if (!setCookieHeader || !Array.isArray(setCookieHeader)) return currentCookieStr;
  
  const cookieMap = new Map();
  if (currentCookieStr) {
    currentCookieStr.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) {
        cookieMap.set(parts[0], parts.slice(1).join('='));
      }
    });
  }

  setCookieHeader.forEach(cookieStr => {
    const mainPart = cookieStr.split(';')[0];
    const parts = mainPart.trim().split('=');
    if (parts[0]) {
      cookieMap.set(parts[0], parts.slice(1).join('='));
    }
  });

  return Array.from(cookieMap.entries())
    .map(([name, val]) => `${name}=${val}`)
    .join('; ');
}

function cleanCookieHeader(sessionCookie) {
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

    const sessionCookie = u.poshmarkAccount.sessionCookie;
    console.log('Original sessionCookie contains _poshmark_session:', sessionCookie.includes('_poshmark_session='));
    console.log('Original sessionCookie contains jwt:', sessionCookie.includes('jwt='));

    const cleanCookie = cleanCookieHeader(sessionCookie);
    console.log('Fetching homepage from Poshmark...');

    const res = await axios.get('https://www.poshmark.com/', {
      headers: {
        'cookie': cleanCookie,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log('Response Status:', res.status);
    const setCookies = res.headers['set-cookie'];
    console.log('Set-Cookie Headers:', setCookies);

    if (setCookies) {
      const merged = mergeSetCookies(sessionCookie, setCookies);
      console.log('Merged cookie contains _poshmark_session:', merged.includes('_poshmark_session='));
      if (merged.includes('_poshmark_session=')) {
        // Save to DB to fix user immediately!
        u.poshmarkAccount.sessionCookie = merged;
        u.markModified('poshmarkAccount');
        await u.save();
        console.log('Successfully saved repaired session cookie to Database!');
      }
    }
  } catch (err) {
    console.error('Error during test:', err.message);
    if (err.response) {
      console.error('Response Data:', err.response.data);
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
