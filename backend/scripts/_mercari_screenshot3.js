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
    console.log('Waiting 20s for checkbox to render...');
    await new Promise(r => setTimeout(r, 20000));

    // The Turnstile checkbox lives inside a same-origin-looking but sandboxed cross-origin iframe.
    // Puppeteer can only click into it via real mouse coordinates, not DOM selectors.
    try {
      const frames = page.frames();
      console.log('Frame count:', frames.length);
      let clicked = false;
      for (const frame of frames) {
        try {
          const cb = await frame.$('input[type="checkbox"], .cb-c, label');
          if (cb) {
            const box = await cb.boundingBox();
            if (box) {
              await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              console.log('Clicked checkbox in frame:', frame.url());
              clicked = true;
              break;
            }
          }
        } catch (fe) {}
      }
      if (!clicked) {
        // Fallback: click at the known on-screen position of the checkbox from the screenshot (~213, 337)
        await page.mouse.click(213, 337);
        console.log('Fallback coordinate click attempted.');
      }
    } catch (clickErr) {
      console.log('Click attempt error:', clickErr.message);
    }

    console.log('Waiting 20s after click...');
    await new Promise(r => setTimeout(r, 20000));
    title = await page.title();
    console.log('Title after click + 20s wait:', title);
  }

  await page.screenshot({ path: path.join(__dirname, 'mercari_block3.png') });
  await browser.close();
  console.log('Screenshot saved.');
}
run().catch(e => { console.error(e); process.exit(1); });
