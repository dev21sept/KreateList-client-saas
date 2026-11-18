const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = require('../models/Listing');
  const User = require('../models/User');

  const listing = await Listing.findOne({ mercariListingId: { $exists: true, $ne: null, $ne: '' } });
  if (!listing) { console.log('no mercari listing found'); process.exit(0); }
  console.log('mercariListingId:', listing.mercariListingId, '| current sku:', JSON.stringify(listing.sku));

  const user = await User.findById(listing.user);
  if (!user?.mercariAccount?.connected) { console.log('mercari not connected for this user'); process.exit(0); }

  const puppeteer = require('puppeteer');
  const { extractMercariAuth } = require('../services/mercariService');
  async function applyMercariCookies(page, sessionCookie) {
    if (!sessionCookie) return;
    for (const pair of sessionCookie.split(';')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      await page.setCookie({ name: trimmed.substring(0, idx), value: trimmed.substring(idx + 1), domain: '.mercari.com', path: '/' });
    }
  }

  const launchOptions = { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-blink-features=AutomationControlled','--disable-web-security'] };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const proxyUrl = process.env.HTTP_PROXY_URL;
  let proxyAuth = null;
  if (proxyUrl) {
    const parsedUrl = new URL(proxyUrl);
    launchOptions.args.push(`--proxy-server=${parsedUrl.protocol}//${parsedUrl.host}`);
    if (parsedUrl.username && parsedUrl.password) proxyAuth = { username: decodeURIComponent(parsedUrl.username), password: decodeURIComponent(parsedUrl.password) };
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  if (proxyAuth) await page.authenticate(proxyAuth);
  if (user.mercariAccount.sessionCookie) await applyMercariCookies(page, user.mercariAccount.sessionCookie);
  const { token } = extractMercariAuth(user.mercariAccount);

  let loaded = false;
  for (let attempt = 1; attempt <= 3 && !loaded; attempt++) {
    try {
      await page.goto('https://www.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();
      console.log(`Attempt ${attempt}: page title = "${title}"`);
      if (!/just a moment/i.test(title)) loaded = true;
      else await new Promise(r => setTimeout(r, 8000));
    } catch (e) {
      console.log(`Attempt ${attempt} nav error:`, e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await new Promise(r => setTimeout(r, 1500));

  const itemId = listing.mercariListingId;
  const result = await page.evaluate(async (token, itemId) => {
    const hash = 'd7b31ddc8e3a5adc4b0ff122fbb5afed17341dfd7f75407b460a4309d15cbf4d';
    const vars = { itemId };
    const ext = { persistedQuery: { version: 1, sha256Hash: hash } };
    const url = `/v1/api?operationName=sellFetchItemsDetails&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
    const h = { 'accept': '*/*', 'apollo-require-preflight': 'true' };
    if (token) h['authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers: h, credentials: 'include' });
    const text = await res.text();
    try { const json = JSON.parse(text); return json.data?.item || json.data?.sellFetchItemsDetails || json; }
    catch (e) { return { __notJson: true, snippet: text.slice(0, 200) }; }
  }, token, itemId);

  await browser.close();
  console.log('RAW KEYS:', Object.keys(result || {}));
  console.log('RAW RESULT:', JSON.stringify(result, null, 2).slice(0, 3000));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
