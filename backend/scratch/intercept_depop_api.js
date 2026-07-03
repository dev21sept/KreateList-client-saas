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

    // Intercept responses
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('attributes') || url.includes('sizes') || url.includes('taxonomy')) {
        try {
          const status = response.status();
          if (status === 200) {
            const data = await response.json();
            console.log(`Captured API Call: ${url}`);
            fs.writeFileSync(__dirname + `/captured_${Date.now()}_api.json`, JSON.stringify(data, null, 2));
            console.log('Saved response data.');
          }
        } catch (e) {
          // ignore parsing error if it is not json
        }
      }
    });
    
    console.log('Navigating to Depop create product page...');
    await page.goto('https://www.depop.com/products/create/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('Waiting 10 seconds to make sure all requests finish...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await browser.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connect(MONGO_URI); // reconnect just in case
    await mongoose.disconnect();
  }
})();
