const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

try {
  puppeteer.use(StealthPlugin());
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    
    const User = require('../models/User');
    const user = await User.findOne({ 'depopAccount.connected': true });
    if (!user) {
      console.error('No connected Depop user found.');
      process.exit(1);
    }
    
    const { accessToken, sessionCookie } = user.depopAccount;
    
    console.log('Launching Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set cookies
    const parsedCookies = [];
    if (sessionCookie) {
      const cookies = sessionCookie.split(';');
      for (const cookie of cookies) {
        const parts = cookie.trim().split('=');
        if (parts.length < 2) continue;
        const name = parts[0];
        const value = parts.slice(1).join('=');
        parsedCookies.push({
          name,
          value,
          domain: '.depop.com',
          path: '/'
        });
      }
      await page.setCookie(...parsedCookies);
    }
    
    await page.setRequestInterception(true);
    page.on('request', req => {
      const headers = req.headers();
      headers['Authorization'] = accessToken;
      headers['Accept'] = 'application/json';
      req.continue({ headers });
    });

    const testUrls = [
      'https://api.depop.com/api/v3/size-sets/77/',
      'https://api.depop.com/api/v3/sizes/77/',
      'https://api.depop.com/api/v3/size_sets/77/',
      'https://webapi.depop.com/api/v1/size-sets/77/',
      'https://webapi.depop.com/api/v1/sizes/77/',
      'https://webapi.depop.com/api/v1/size_sets/77/',
      'https://api.depop.com/api/v3/attributes/77/',
      'https://api.depop.com/api/v3/size-set/77/',
      'https://api.depop.com/api/v3/size_set_id/77/'
    ];

    for (const url of testUrls) {
      try {
        console.log(`\nTrying URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
        const content = await page.evaluate(() => document.body.innerText);
        if (content && content.includes('{') && !content.includes('404') && !content.includes('Not Found') && !content.includes('Forbidden')) {
          console.log(`SUCCESS! Response from ${url}:`);
          console.log(content.substring(0, 1000));
          break;
        } else {
          console.log(`Failed (Status/Content mismatch)`);
        }
      } catch (e) {
        console.log(`Failed: ${e.message}`);
      }
    }
    
    await browser.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
