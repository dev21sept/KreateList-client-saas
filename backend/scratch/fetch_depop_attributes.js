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
    
    console.log('Navigating to Depop...');
    await page.goto('https://www.depop.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('Injecting session storage...');
    await page.evaluate((token) => {
      window.sessionStorage.setItem('elister_captured_depop_token', token);
      window.localStorage.setItem('access_token', token.replace(/^Bearer\s+/i, ''));
    }, accessToken);
    
    console.log('Fetching attributes from page context...');
    const attributes = await page.evaluate(async (tokenString) => {
      const res = await window.fetch('https://api.depop.com/api/v3/attributes/', {
        headers: {
          'Accept': 'application/json',
          'Authorization': tokenString
        }
      });
      if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status}`);
      }
      return await res.json();
    }, accessToken);
    
    console.log('Success! Writing to depop_attributes.json...');
    fs.writeFileSync(__dirname + '/depop_attributes.json', JSON.stringify(attributes, null, 2));
    console.log('Done!');
    
    await browser.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
