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
  let title = await page.title();
  console.log('Title right after load:', title);

  if (/just a moment/i.test(title)) {
    await new Promise(r => setTimeout(r, 20000));

    // Move the mouse in a human-ish curved path toward the checkbox before clicking, instead of teleporting.
    const targetX = 213, targetY = 337;
    const steps = 25;
    for (let i = 1; i <= steps; i++) {
      const x = 50 + (targetX - 50) * (i / steps) + Math.sin(i / 3) * 5;
      const y = 50 + (targetY - 50) * (i / steps) + Math.cos(i / 4) * 5;
      await page.mouse.move(x, y);
      await new Promise(r => setTimeout(r, 15));
    }
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 80));
    await page.mouse.up();
    console.log('Click performed with curved mouse path.');

    await page.screenshot({ path: path.join(__dirname, 'mercari_click_0s.png') });

    await new Promise(r => setTimeout(r, 5000));
    let t5 = await page.title();
    console.log('Title after 5s:', t5);
    await page.screenshot({ path: path.join(__dirname, 'mercari_click_5s.png') });

    await new Promise(r => setTimeout(r, 15000));
    let t20 = await page.title();
    console.log('Title after 20s total:', t20);
    await page.screenshot({ path: path.join(__dirname, 'mercari_click_20s.png') });
  } else {
    console.log('No challenge encountered this time.');
    await page.screenshot({ path: path.join(__dirname, 'mercari_click_0s.png') });
  }

  await browser.close();
  console.log('Done.');
}
run().catch(e => { console.error(e); process.exit(1); });
