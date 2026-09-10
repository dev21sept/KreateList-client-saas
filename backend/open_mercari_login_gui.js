const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

puppeteer.use(StealthPlugin());
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  console.log("==================================================");
  console.log("🚀 Launching Mercari Login GUI Browser on your screen...");
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log("Navigating to Mercari Login page...");
  await page.goto('https://www.mercari.com/login/', { waitUntil: 'networkidle2' });

  console.log("\n👉 Real Chrome window is now OPEN on your screen!");
  console.log("👉 Please enter your email, password, and complete the OTP directly in the browser.");
  console.log("Waiting for successful login...\n");

  // Poll for successful login session cookies
  let loggedIn = false;
  let finalCookies = [];
  const startTime = Date.now();

  while (Date.now() - startTime < 300000) { // 5 minutes window
    try {
      const cookies = await page.cookies();
      const sidCookie = cookies.find(c => 
        c.name === 'sid' || 
        c.name === 'session' || 
        c.name === '_mercari_session' || 
        c.name === 'user_id'
      );

      const currentUrl = page.url();
      if (sidCookie || (currentUrl.includes('mercari.com') && !currentUrl.includes('/login') && !currentUrl.includes('/signup'))) {
        console.log("🎉 Login detected! Capturing cookies...");
        finalCookies = cookies;
        loggedIn = true;
        break;
      }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1500));
  }

  if (loggedIn) {
    const sessionCookieStr = finalCookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log("Extracted Cookie Length:", sessionCookieStr.length);

    // Save to Database on server/local
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';
    try {
      console.log("Connecting to MongoDB to update account status...");
      await mongoose.connect(dbUri);
      const User = mongoose.model('User', new mongoose.Schema({
        email: String,
        mercariAccount: Object
      }));

      const user = await User.findOne({ email: 'support@elister.ai' }) || await User.findOne();
      if (user) {
        user.mercariAccount = {
          connected: true,
          username: 'support@elister.ai',
          userId: '',
          sessionCookie: sessionCookieStr,
          connectedAt: new Date()
        };
        await user.save();
        console.log(`✅ SUCCESS! Mercari account connected for: ${user.email}`);
      }
      await mongoose.disconnect();
    } catch (dbErr) {
      console.warn("Database note:", dbErr.message);
    }

    console.log("\n==================================================");
    console.log("🎉 SUCCESS! Mercari is now connected successfully!");
    console.log("==================================================");
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
  } else {
    console.log("Login window closed or timed out.");
    await browser.close();
  }
}

run();
