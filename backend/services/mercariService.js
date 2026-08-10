const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

puppeteer.use(StealthPlugin());

/**
 * Helper to download an image from a URL and save it to a temporary file.
 */
async function downloadImageToTempFile(url) {
  const tempDir = os.tmpdir();
  const filename = `mercari_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const filepath = path.join(tempDir, filename);
  
  const writer = fs.createWriteStream(filepath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filepath));
    writer.on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

/**
 * Scrapes Mercari listings for a user using Puppeteer Stealth.
 * 
 * @param {string} username Mercari profile username/id
 * @param {Object} credentials User connection settings containing session cookies
 * @returns {Promise<Array>} Scraped products
 */
async function scrapeMercariCloset(username, credentials = {}) {
  console.log(`[Mercari Scraper] Fetching listings for ${username}...`);
  let browser = null;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security'
      ]
    };

    const proxyUrl = process.env.HTTP_PROXY_URL;
    let proxyAuth = null;
    if (proxyUrl) {
      try {
        const parsedUrl = new URL(proxyUrl);
        launchOptions.args.push(`--proxy-server=${parsedUrl.protocol}//${parsedUrl.host}`);
        if (parsedUrl.username && parsedUrl.password) {
          proxyAuth = {
            username: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password)
          };
        }
      } catch (e) {
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
      }
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Load cookies if available
    if (credentials.sessionCookie) {
      console.log('[Mercari Scraper] Setting session cookies in browser...');
      const cookiePairs = credentials.sessionCookie.split(';');
      for (const pair of cookiePairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const name = trimmed.substring(0, idx);
        const value = trimmed.substring(idx + 1);
        await page.setCookie({
          name,
          value,
          domain: '.mercari.com',
          path: '/'
        });
      }
    }

    // Go to My Page listings or User profile page
    console.log('[Mercari Scraper] Loading listings page...');
    await page.goto('https://www.mercari.com/mypage/listings/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    // Check if redirect to login occurred (session expired)
    if (page.url().includes('/signin/') || page.url().includes('/login/')) {
      console.warn('[Mercari Scraper] Session expired. Attempting fallback to public user profile page if possible...');
      if (username && !username.includes('@')) {
        await page.goto(`https://www.mercari.com/u/${username}/`, {
          waitUntil: 'networkidle2',
          timeout: 45000
        });
      } else {
        throw new Error('Mercari session cookie expired. Please reconnect your account.');
      }
    }

    // Extract item cards
    console.log('[Mercari Scraper] Extracting product elements...');
    const items = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="ItemCard"], [class*="ItemCard"], a[href*="/us/item/"]');
      const results = [];
      cards.forEach((card, idx) => {
        try {
          const href = card.getAttribute('href') || card.querySelector('a')?.getAttribute('href') || '';
          if (!href || !href.includes('/item/')) return;
          
          const itemId = href.split('/item/')[1].split('/')[0] || '';
          const title = card.querySelector('[class*="title" i], [class*="itemName" i]')?.textContent?.trim() || `Mercari Item ${idx + 1}`;
          const priceStr = card.querySelector('[class*="price" i]')?.textContent?.trim() || '0';
          const imgUrl = card.querySelector('img')?.getAttribute('src') || '';
          
          results.push({
            mercariListingId: itemId,
            mercariUrl: href.startsWith('http') ? href : `https://www.mercari.com${href}`,
            title,
            price: priceStr.replace(/[^0-9.]/g, ''),
            images: imgUrl ? [imgUrl] : [],
            status: 'active'
          });
        } catch (e) {}
      });
      return results;
    });

    console.log(`[Mercari Scraper] Found ${items.length} items on page.`);
    await browser.close();
    return items;

  } catch (err) {
    console.error('[Mercari Scraper] Scrape failed:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw err;
  }
}

/**
 * Automates listing/publishing a draft to Mercari.
 * 
 * @param {Object} listing Listing database document
 * @param {Object} credentials User connection details containing session cookies
 * @returns {Promise<Object>} Published listing metadata
 */
async function publishToMercari(listing, credentials = {}) {
  console.log(`[Mercari Publisher] Publishing listing: ${listing.title} to Mercari`);
  let browser = null;
  let tempFiles = [];
  try {
    if (!credentials.sessionCookie) {
      throw new Error('Your Mercari session cookie is missing. Please connect your Mercari account.');
    }

    // 1. Download images to local temp files
    console.log('[Mercari Publisher] Preparing listing images...');
    for (const imgUrl of (listing.images || [])) {
      try {
        const cleanUrl = imgUrl.replace('//localhost:', '//127.0.0.1:');
        const localPath = await downloadImageToTempFile(cleanUrl);
        tempFiles.push(localPath);
      } catch (err) {
        console.error('[Mercari Publisher] Failed to prepare image:', err.message);
      }
    }

    if (tempFiles.length === 0) {
      throw new Error('Failed to download any images for listing.');
    }

    // 2. Launch Puppeteer Stealth
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security'
      ]
    };

    const proxyUrl = process.env.HTTP_PROXY_URL;
    let proxyAuth = null;
    if (proxyUrl) {
      try {
        const parsedUrl = new URL(proxyUrl);
        launchOptions.args.push(`--proxy-server=${parsedUrl.protocol}//${parsedUrl.host}`);
        if (parsedUrl.username && parsedUrl.password) {
          proxyAuth = {
            username: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password)
          };
        }
      } catch (e) {
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
      }
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 3. Set cookies
    console.log('[Mercari Publisher] Setting session cookies...');
    const cookiePairs = credentials.sessionCookie.split(';');
    for (const pair of cookiePairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const name = trimmed.substring(0, idx);
      const value = trimmed.substring(idx + 1);
      await page.setCookie({
        name,
        value,
        domain: '.mercari.com',
        path: '/'
      });
    }

    // 4. Navigate to sell page
    console.log('[Mercari Publisher] Navigating to Sell page...');
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    if (page.url().includes('/signin/') || page.url().includes('/login/')) {
      throw new Error('Failed to authenticate with Mercari. Session cookies are invalid or expired.');
    }

    // 5. Fill listing details
    console.log('[Mercari Publisher] Filling listing forms...');

    // Title input
    const titleSelector = 'input[name="title"], input[placeholder*="title" i], [data-testid="listing-title"]';
    await page.waitForSelector(titleSelector, { timeout: 15000 });
    await page.type(titleSelector, listing.title, { delay: 50 });

    // Description input
    const descSelector = 'textarea[name="description"], textarea[placeholder*="description" i], [data-testid="listing-description"]';
    await page.waitForSelector(descSelector, { timeout: 15000 });
    await page.type(descSelector, listing.description, { delay: 50 });

    // Brand input if present
    if (listing.brand) {
      const brandSelector = 'input[placeholder*="brand" i]';
      const brandExists = await page.$(brandSelector);
      if (brandExists) {
        await page.type(brandSelector, listing.brand, { delay: 50 });
      }
    }

    // Price input
    const priceSelector = 'input[name="price"], input[placeholder*="price" i], [data-testid="listing-price"]';
    await page.waitForSelector(priceSelector, { timeout: 15000 });
    // Clear first
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, priceSelector);
    await page.type(priceSelector, String(listing.price || 0), { delay: 50 });

    // Photo input
    console.log('[Mercari Publisher] Uploading photos...');
    const fileInputs = await page.$$('input[type="file"]');
    if (fileInputs.length > 0) {
      await fileInputs[0].uploadFile(...tempFiles);
    } else {
      console.warn('[Mercari Publisher] File upload input selector not found.');
    }

    await page.waitForTimeout(5000);

    // Click publish button
    console.log('[Mercari Publisher] Submitting listing form...');
    const listBtnSelector = 'button[type="submit"], button[data-testid="listing-submit"], button[class*="publish" i], button[class*="submit" i]';
    const listBtn = await page.$(listBtnSelector);
    if (listBtn) {
      await listBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(10000);

    const resultingUrl = page.url();
    console.log('[Mercari Publisher] Post submission URL:', resultingUrl);

    // Extract listing ID from url or mock if it went back to dashboard
    let listingId = 'M-' + Date.now();
    let listingUrl = 'https://www.mercari.com/mypage/listings/';

    if (resultingUrl.includes('/item/')) {
      listingUrl = resultingUrl;
      listingId = resultingUrl.split('/item/')[1].split('/')[0] || listingId;
    }

    // Cleanup local temp files
    tempFiles.forEach(f => fs.unlink(f, () => {}));

    await browser.close();
    return {
      success: true,
      id: listingId,
      url: listingUrl
    };

  } catch (err) {
    console.error('[Mercari Publisher] Publish failed:', err.message);
    // Cleanup local temp files
    tempFiles.forEach(f => fs.unlink(f, () => {}));
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw err;
  }
}

/**
 * Verifies a Mercari session cookie using Puppeteer Stealth and extracts the user profile name.
 * @param {string} sessionCookie 
 * @returns {Promise<{success: boolean, username: string, userId: string}>}
 */
async function getMercariProfile(sessionCookie) {
  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    // Proxy support if configured
    const proxyUrl = process.env.PROXY_URL;
    let proxyAuth = null;
    if (proxyUrl) {
      try {
        const parsedUrl = new URL(proxyUrl);
        launchOptions.args.push(`--proxy-server=${parsedUrl.protocol}//${parsedUrl.host}`);
        if (parsedUrl.username && parsedUrl.password) {
          proxyAuth = {
            username: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password)
          };
        }
      } catch (e) {
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
      }
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Load cookies if available
    if (sessionCookie) {
      const cookiePairs = sessionCookie.split(';');
      for (const pair of cookiePairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const name = trimmed.substring(0, idx);
        const value = trimmed.substring(idx + 1);
        await page.setCookie({
          name,
          value,
          domain: '.mercari.com',
          path: '/'
        });
      }
    }

    // Go to My Page or listings page
    console.log('[Mercari Profile Checker] Navigating to My Page...');
    await page.goto('https://www.mercari.com/mypage/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const currentCookies = await page.cookies();
    const isLoggedIn = currentCookies.some(c => c.name === 'sid' || c.name === 'session' || c.name === '_mercari_session');
    
    if (!isLoggedIn) {
      console.warn('[Mercari Profile Checker] Session cookie appears invalid or expired.');
      throw new Error('Session is invalid or expired. Please re-login on Mercari.');
    }

    // Wait a little bit for dynamic UI
    await page.waitForTimeout(3000);

    // Scrape user profile name
    const profileDetails = await page.evaluate(() => {
      // Look for profile name selectors
      const nameEl = document.querySelector('[class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i]');
      let username = nameEl ? nameEl.textContent.trim() : 'Mercari User';
      
      // Look for user_id from href link (e.g. /u/123456789/) or cookie
      let userId = '';
      const userLink = document.querySelector('a[href*="/u/"]');
      if (userLink) {
        const href = userLink.getAttribute('href');
        const match = href.match(/\/u\/(\d+)/);
        if (match) {
          userId = match[1];
        }
      }
      return { username, userId };
    });

    // Extract user ID from cookies if not found in page
    if (!profileDetails.userId) {
      const userIdCookie = currentCookies.find(c => c.name === 'user_id');
      if (userIdCookie) {
        profileDetails.userId = userIdCookie.value;
      }
    }

    console.log('[Mercari Profile Checker] Scraped profile:', profileDetails);

    await browser.close();
    return {
      success: true,
      username: profileDetails.username,
      userId: profileDetails.userId
    };

  } catch (err) {
    console.error('[Mercari Profile Checker] Profile retrieval failed:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      username: 'Mercari User',
      userId: ''
    };
  }
}

module.exports = {
  scrapeMercariCloset,
  publishToMercari,
  getMercariProfile
};
