const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function run() {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set request interception to capture outgoing API calls
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/vm-rest/') || url.includes('/api/')) {
      console.log('Captured API Request:', url);
    }
    request.continue();
  });

  console.log('Navigating to poshmark.com/feed...');
  try {
    await page.goto('https://poshmark.com/feed', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded successfully.');
  } catch (err) {
    console.error('Navigation error:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
    process.exit(0);
  }
}

run();
