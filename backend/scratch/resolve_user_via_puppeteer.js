const mongoose = require('mongoose');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

try {
  puppeteer.use(StealthPlugin());
} catch (e) {}

const User = require('../models/User');

async function resolveUserViaPuppeteer() {
  let browser = null;
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    console.log('Connected to MongoDB.');

    const userId = '6a1571887a41852eef0fdda5';
    const user = await User.findById(userId);

    if (!user) {
      console.error('User not found.');
      await mongoose.disconnect();
      return;
    }

    console.log('Launching Puppeteer Stealth...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const apiUrl = 'https://webapi.depop.com/api/v1/users/292443943/';
    console.log(`Navigating directly to API URL: ${apiUrl}`);
    
    await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const content = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log('Raw Page Content:', content);

    const result = JSON.parse(content);
    console.log('Parsed API Result:', result);

    if (result && result.username) {
      const realUsername = result.username;
      console.log(`Successfully resolved username: ${realUsername}`);
      
      user.depopAccount.username = realUsername;
      user.depopAccount.connected = true;
      user.markModified('depopAccount');
      await user.save();
      console.log('Database updated successfully with real username!');
    } else {
      console.error('Failed to resolve username. JSON does not contain username.');
    }

    await browser.close();
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

resolveUserViaPuppeteer();
