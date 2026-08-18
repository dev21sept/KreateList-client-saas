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

    // 5. Fill listing details via GraphQL Direct API
    console.log('[Mercari Publisher] Preparing photo uploads & intercepting credentials...');

    let authToken = null;
    let photoIds = [];

    // Enable request interception to capture JWT auth token
    await page.setRequestInterception(true);
    page.on('request', request => {
      const headers = request.headers();
      const auth = headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        authToken = auth;
      }
      request.continue();
    });

    // Intercept photo upload responses to capture uploaded photo UUIDs
    page.on('response', async response => {
      try {
        const url = response.url();
        if (url.includes('/v1/api')) {
          const text = await response.text();
          if (text.includes('uploadPhoto') || text.includes('photoId')) {
            const data = JSON.parse(text);
            if (data.data && data.data.uploadPhoto) {
              const pid = data.data.uploadPhoto.id || data.data.uploadPhoto.photoId;
              if (pid && !photoIds.includes(pid)) {
                photoIds.push(pid);
                console.log(`[Mercari Publisher] Captured photo ID: ${pid}`);
              }
            }
          }
        }
      } catch (err) {
        // ignore parsing error for non-json responses
      }
    });

    // Photo input selection and upload
    console.log('[Mercari Publisher] Uploading photos...');
    const fileSelector = 'input[type="file"]';
    await page.waitForSelector(fileSelector, { timeout: 15000 });
    const fileInputs = await page.$$(fileSelector);
    if (fileInputs.length > 0) {
      console.log(`[Mercari Publisher] Uploading ${tempFiles.length} files...`);
      await fileInputs[0].uploadFile(...tempFiles);
    } else {
      throw new Error("Photo upload input field not found on Mercari page.");
    }

    // Wait for photos to upload and be processed
    let waitCount = 0;
    while (photoIds.length < tempFiles.length && waitCount < 15) {
      console.log(`[Mercari Publisher] Waiting for photo uploads: ${photoIds.length}/${tempFiles.length}...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      waitCount++;
    }

    if (photoIds.length === 0) {
      throw new Error("Failed to upload photos to Mercari server. Image response UUIDs were not captured.");
    }

    // Wait for auth token to be populated by page calls
    let retries = 10;
    while (!authToken && retries > 0) {
      console.log('[Mercari Publisher] Waiting for page auth token to load...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      retries--;
    }

    if (!authToken) {
      console.warn('[Mercari Publisher] Bearer auth token not captured, attempting to fetch from localStorage...');
      authToken = await page.evaluate(() => {
        try {
          return 'Bearer ' + JSON.parse(localStorage.getItem('redux_store') || '{}').auth.accessToken;
        } catch (e) {
          return null;
        }
      });
    }

    if (!authToken) {
      throw new Error("Unable to capture Mercari authorization credentials. Please verify your connection.");
    }

    // Resolve brandId, sizeId and conditionId to integers
    const brandIdVal = listing.brandId ? parseInt(listing.brandId) || null : null;
    const sizeIdVal = listing.sizeId ? parseInt(listing.sizeId) || null : null;
    const conditionIdVal = listing.selectedCondition ? parseInt(listing.selectedCondition) || 2 : 2;

    // Resolve shipping parameters
    const shippingPayerIdVal = listing.shippingPayer === 'seller' ? 2 : 1;
    let shippingClassIdsVal = [];
    if (listing.shippingMethod === 'prepaid') {
      const carrier = (listing.shippingCarrier || '').toLowerCase();
      if (carrier.includes('usps ground advantage')) {
        shippingClassIdsVal = [2550];
      } else if (carrier.includes('ups ground saver')) {
        shippingClassIdsVal = [2552];
      } else if (carrier.includes('fedex ground economy')) {
        shippingClassIdsVal = [2551];
      } else if (carrier.includes('ups ground')) {
        shippingClassIdsVal = [2553];
      } else {
        shippingClassIdsVal = [2550]; // default fallback
      }
    }

    const priceCents = Math.round(parseFloat(listing.price || 0) * 100) || 1000;
    const salesFeeVal = Math.round(priceCents * 0.10) || 0; // Mercari 10% fee

    const inputData = {
      photoIds: photoIds,
      name: listing.title,
      price: priceCents,
      description: listing.description,
      categoryId: parseInt(listing.categoryId) || 297,
      conditionId: conditionIdVal,
      brandId: brandIdVal,
      zipCode: credentials.zipCode || '32809',
      shippingPayerId: shippingPayerIdVal,
      shippingClassIds: shippingClassIdsVal,
      shippingPackageLength: parseInt(listing.shippingLength) || (listing.shippingFitsShoebox ? 14 : 15),
      shippingPackageWidth: parseInt(listing.shippingWidth) || (listing.shippingFitsShoebox ? 10 : 15),
      shippingPackageHeight: parseInt(listing.shippingHeight) || (listing.shippingFitsShoebox ? 5 : 15),
      shippingDimensionUnit: 'INCH',
      shippingPackageWeight: (parseInt(listing.shippingWeightLbs) * 16 + parseInt(listing.shippingWeightOz)) || 8,
      shippingWeightUnit: 'OUNCE',
      sizeId: sizeIdVal,
      minPriceForAutoPriceDrop: Math.round(priceCents * 0.8) || null,
      suggestedShippingClassIds: shippingClassIdsVal,
      salesFee: salesFeeVal
    };

    console.log('[Mercari Publisher] Executing createListing GraphQL Mutation inside page...');

    const responseResult = await page.evaluate(async (token, variables) => {
      try {
        const response = await fetch("https://www.mercari.com/v1/api", {
          method: "POST",
          headers: {
            "accept": "*/*",
            "apollo-require-preflight": "true",
            "authorization": token,
            "content-type": "application/json",
            "x-app-version": "1",
            "x-platform": "web"
          },
          body: JSON.stringify({
            operationName: "createListing",
            variables: {
              input: variables
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: "265dab5d0d382d3c83dda7d65e9ad111f47c27aa5d92c7d9a4bacd890d5e32c0"
              }
            }
          })
        });
        return await response.json();
      } catch (err) {
        return { error: err.message };
      }
    }, authToken, inputData);

    console.log('[Mercari Publisher] GraphQL CreateListing Response:', JSON.stringify(responseResult));

    if (responseResult.error) {
      throw new Error(`Direct API listing failed: ${responseResult.error}`);
    }

    if (responseResult.errors && responseResult.errors.length > 0) {
      throw new Error(`Mercari API Error: ${responseResult.errors[0].message}`);
    }

    const createdListing = responseResult.data?.createListing;
    if (!createdListing || !createdListing.id) {
      throw new Error("Failed to create listing. Mercari API did not return listing details.");
    }

    const listingId = createdListing.id;
    const listingUrl = createdListing.url || `https://www.mercari.com/item/${listingId}/`;

    console.log(`[Mercari Publisher] Successfully created listing ID: ${listingId} URL: ${listingUrl}`);

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

    const currentUrl = page.url();
    if (currentUrl.includes('/login/') || currentUrl.includes('/signin/')) {
      console.warn('[Mercari Profile Checker] Redirected to login page. Session is expired.');
      throw new Error('Session is invalid or expired. Please re-login on Mercari.');
    }

    // Wait a little bit for dynamic UI
    await new Promise(resolve => setTimeout(resolve, 3000));

    const currentCookies = await page.cookies();

    // Scrape user profile name
    const profileDetails = await page.evaluate(() => {
      // Look for profile name selectors
      const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i], h1[class*="Name"], [class*="name" i] h1');
      let username = nameEl ? nameEl.textContent.trim() : '';
      
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
      username: '',
      userId: ''
    };
  }
}

module.exports = {
  scrapeMercariCloset,
  publishToMercari,
  getMercariProfile
};
