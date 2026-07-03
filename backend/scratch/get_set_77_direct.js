const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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
    console.log('Found user with token:', accessToken.substring(0, 20) + '...');
    
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
      console.log('Cookies set.');
    }
    
    // We can intercept requests to add Authorization header
    await page.setRequestInterception(true);
    page.on('request', req => {
      const headers = req.headers();
      headers['Authorization'] = accessToken;
      headers['Accept'] = 'application/json';
      req.continue({ headers });
    });

    console.log('Navigating directly to attributes endpoint...');
    await page.goto('https://api.depop.com/api/v3/attributes/', { waitUntil: 'networkidle0', timeout: 60000 });
    
    const content = await page.evaluate(() => document.body.innerText);
    
    try {
      const json = JSON.parse(content);
      console.log('Successfully fetched and parsed attributes JSON!');
      console.log('Size sets in response:', Object.keys(json.size_sets || {}).length);
      fs.writeFileSync(__dirname + '/depop_attributes_direct.json', JSON.stringify(json, null, 2));
      console.log('Saved to depop_attributes_direct.json');
      
      // Print size set 77 if present
      if (json.size_sets && json.size_sets['77']) {
        console.log('\n--- SIZE SET 77 ---');
        console.log(JSON.stringify(json.size_sets['77'], null, 2));
      } else {
        console.log('Size set 77 is not in the response.');
      }
    } catch (e) {
      console.error('Failed to parse page content as JSON. Content preview:', content.substring(0, 1000));
    }
    
    await browser.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
