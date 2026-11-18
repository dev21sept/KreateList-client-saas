const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  const puppeteer = require('puppeteer');
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
  await page.setViewport({ width: 1280, height: 900 });
  if (proxyAuth) await page.authenticate(proxyAuth);

  try {
    await page.goto('https://www.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('nav error:', e.message);
  }
  await new Promise(r => setTimeout(r, 3000));
  const title = await page.title();
  console.log('Page title:', title);
  await page.screenshot({ path: path.join(__dirname, 'mercari_block.png') });
  await browser.close();
  console.log('Screenshot saved.');
}
run().catch(e => { console.error(e); process.exit(1); });
