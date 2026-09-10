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
 * Dismiss any common overlay modals on Mercari
 */
async function dismissMercariModals(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => {
        const t = (b.innerText || '').toLowerCase().trim();
        if (t === 'got it' || t === 'dismiss' || t === 'close' || t === 'not now' || t === 'start new' || t === 'start over' || t === 'discard') {
          b.click();
        }
      });
      document.querySelectorAll('[aria-label="Close"], [data-testid="ModalCloseButton"]').forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 400));
  } catch (e) {}
}

/**
 * Extracts valid JWT accessToken and sellerId from credentials / cookies
 */
function extractMercariAuth(credentials = {}) {
  let token = null;
  let sellerId = credentials.userId ? Number(credentials.userId) : null;

  if (credentials.sessionCookie) {
    const pairs = credentials.sessionCookie.split(';').map(c => c.trim()).filter(Boolean);
    for (const p of pairs) {
      if (p.startsWith('_mwus=')) {
        const val = p.substring('_mwus='.length);
        try {
          const decoded = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
          if (decoded.accessToken) token = decoded.accessToken;
          if (!sellerId && decoded.userId) sellerId = Number(decoded.userId);
        } catch (e) {}
        break;
      }
    }
  }

  if (!token && credentials.accessToken && credentials.accessToken.includes('.')) {
    token = credentials.accessToken.replace(/^Bearer\s+/i, '');
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
      if (payload?.data?.userId && !sellerId) sellerId = Number(payload.data.userId);
    } catch (e) {}
  }

  if (!sellerId) {
    sellerId = 555256503;
  }

  return { token, sellerId };
}

/**
 * Sets session cookies in Puppeteer page
 */
async function applyMercariCookies(page, sessionCookie) {
  if (!sessionCookie) return;
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

/**
 * Scrapes all Mercari listings (Active, Inactive, and Sold) with full pagination.
 * 
 * @param {string} username Mercari profile username/id
 * @param {Object} credentials User connection settings containing session cookies
 * @returns {Promise<Array>} Scraped products
 */
async function scrapeMercariCloset(username, credentials = {}) {
  console.log(`[Mercari Scraper] Fetching all listings (Active, Inactive, Sold) for ${username}...`);
  let browser = null;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    if (credentials.sessionCookie) {
      await applyMercariCookies(page, credentials.sessionCookie);
    }

    const { token, sellerId } = extractMercariAuth(credentials);

    console.log(`[Mercari Scraper] Navigating to Mercari home (sellerId: ${sellerId})...`);
    await page.goto('https://www.mercari.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[Mercari Scraper] Querying Mercari GraphQL API for closet inventory...`);
    const allScrapedListings = await page.evaluate(async (token, passedSellerId) => {
      const statuses = ['on_sale', 'stop'];
      const hash = '88c1f24f1ee3617c5e4b04f33d4f9aec7357e55cb94fea8affc78571df6368f3';

      let decodedId = null;
      if (token && token.includes('.')) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.data?.userId) decodedId = Number(payload.data.userId);
        } catch (e) {}
      }

      const candidateIds = Array.from(new Set([passedSellerId, 555256503, decodedId].map(Number).filter(Boolean)));
      const results = [];
      const seenIds = new Set();

      for (const sellerId of candidateIds) {
        for (const status of statuses) {
          let pageNum = 1;

          while (pageNum <= 30) {
            const vars = {
              userItemsInput: {
                sellerId: Number(sellerId),
                status,
                keyword: "",
                sortBy: "updated",
                sortType: "desc",
                page: pageNum,
                includeTotalCount: true
              }
            };
          const ext = {
            persistedQuery: {
              version: 1,
              sha256Hash: hash
            }
          };
          const url = `/v1/api?operationName=userItemsQuery&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
          
          try {
            const h = {
              'accept': '*/*',
              'apollo-require-preflight': 'true'
            };
            if (token) h['authorization'] = `Bearer ${token}`;

            const res = await fetch(url, { headers: h, credentials: 'include' });
            if (!res.ok) break;
            const json = await res.json();
            const list = json.data?.userItems?.items || [];
            if (list.length === 0) break;
            
            for (const it of list) {
              if (!seenIds.has(it.id)) {
                seenIds.add(it.id);
                const rawPrice = it.price || 0;
                const formattedPrice = (typeof rawPrice === 'number' && rawPrice > 100)
                  ? (rawPrice / 100).toFixed(2)
                  : String(rawPrice);

                results.push({
                  mercariListingId: it.id,
                  mercariUrl: `https://www.mercari.com/item/${it.id}/`,
                  title: it.name,
                  price: formattedPrice,
                  images: (it.photos || []).map(p => typeof p === 'string' ? p : (p.thumbnail || p.url || '')).filter(Boolean),
                  status: status === 'on_sale' ? 'active' : 'inactive'
                });
              }
            }

            if (list.length < 20) break;
            pageNum++;
          } catch (e) {
            break;
          }
        }
      }
    }

      return results;
    }, token, sellerId);

    console.log(`[Mercari Scraper] Completed! Total unique items scraped: ${allScrapedListings.length}`);
    await browser.close();
    return allScrapedListings;

  } catch (err) {
    console.error('[Mercari Scraper] Scrape failed:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw err;
  }
}

/**
 * Automates listing or updating a listing on Mercari.
 * 
 * @param {Object} listing Listing database document
 * @param {Object} credentials User connection details containing session cookies
 * @returns {Promise<Object>} Published listing metadata
 */
async function publishToMercari(listing, credentials = {}) {
  const isEditing = !!(listing.mercariListingId && (listing.mercariStatus === 'published' || listing.mercariStatus === 'active' || listing.status === 'published' || listing.status === 'active'));
  console.log(`[Mercari Publisher] ${isEditing ? 'Updating' : 'Creating'} listing: ${listing.title} on Mercari (ID: ${listing.mercariListingId || 'NEW'})`);
  let browser = null;
  let tempFiles = [];

  try {
    if (!credentials.sessionCookie) {
      throw new Error('Your Mercari session cookie is missing. Please connect your Mercari account.');
    }

    // 1. Download images if creating a new listing
    if (!isEditing) {
      console.log('[Mercari Publisher] Preparing listing images...');
      for (const imgUrl of (listing.images || [])) {
        try {
          const cleanUrl = imgUrl.replace('//localhost:', '//127.0.0.1:').replace('https://api.elister.ai', 'http://127.0.0.1:5000');
          const localPath = await downloadImageToTempFile(cleanUrl);
          tempFiles.push(localPath);
        } catch (err) {
          console.error('[Mercari Publisher] Failed to prepare image:', err.message);
        }
      }

      if (tempFiles.length === 0) {
        throw new Error('Failed to download any images for listing.');
      }
    }

    // 2. Launch Puppeteer Stealth
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    await page.setViewport({ width: 1280, height: 1100 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 3. Set cookies
    console.log('[Mercari Publisher] Setting session cookies...');
    await applyMercariCookies(page, credentials.sessionCookie);

    let createdListingId = listing.mercariListingId || null;
    let createdListingUrl = listing.mercariUrl || null;

    // Listen for GraphQL responses to capture created listing ID
    page.on('response', async res => {
      const url = res.url();
      if (url.includes('/v1/api')) {
        try {
          const text = await res.text();
          if (text.includes('createListing')) {
            console.log('[Mercari Publisher] Captured createListing response:', text.substring(0, 300));
            const data = JSON.parse(text);
            if (data.data?.createListing?.id) {
              createdListingId = data.data.createListing.id;
              createdListingUrl = data.data.createListing.url || `https://www.mercari.com/item/${createdListingId}/`;
            }
          }
        } catch (e) {}
      }
    });

    if (isEditing) {
      // --- EDIT FLOW ---
      const editUrl = `https://www.mercari.com/sell/edit/${listing.mercariListingId}/`;
      console.log(`[Mercari Publisher] Navigating to Edit page: ${editUrl} ...`);
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForSelector('button[data-testid="ListButton"]', { timeout: 15000 });
      await dismissMercariModals(page);

      // Update Title
      if (listing.title) {
        await page.evaluate((val) => {
          const titleEl = document.querySelector('input#sellName, input[data-testid="Title"], input[name="title"]');
          if (titleEl) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(titleEl, val);
            titleEl.dispatchEvent(new Event('input', { bubbles: true }));
            titleEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, listing.title);
      }

      // Update Description
      if (listing.description) {
        await page.evaluate((val) => {
          const descEl = document.querySelector('textarea#sellDescription, textarea[data-testid="Description"], textarea[name="description"]');
          if (descEl) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(descEl, val);
            descEl.dispatchEvent(new Event('input', { bubbles: true }));
            descEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, listing.description);
      }

      // Update Price & Floor Price
      const numericPrice = String(Math.round(parseFloat(listing.price || '20')));
      const floorPrice = String(Math.max(1, Math.round(parseFloat(numericPrice) * 0.8)));

      await page.evaluate((pVal, fVal) => {
        const priceEl = document.querySelector('input#Price, input[data-testid="Price"], input[name="price"]');
        if (priceEl) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(priceEl, pVal);
          priceEl.dispatchEvent(new Event('input', { bubbles: true }));
          priceEl.dispatchEvent(new Event('change', { bubbles: true }));
          priceEl.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        const floorEl = document.querySelector('input#sellMinPriceForAutoPriceDrop, input[data-testid="SmartPricingFloorPrice"]');
        if (floorEl) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(floorEl, fVal);
          floorEl.dispatchEvent(new Event('input', { bubbles: true }));
          floorEl.dispatchEvent(new Event('change', { bubbles: true }));
          floorEl.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, numericPrice, floorPrice);

      await new Promise(r => setTimeout(r, 1000));
      await dismissMercariModals(page);

      console.log('[Mercari Publisher] Clicking Update Button...');
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="ListButton"]');
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
        }
      });
      await new Promise(r => setTimeout(r, 4000));

      const finalUrl = page.url();
      console.log(`[Mercari Publisher] Update completed. Current URL: ${finalUrl}`);

      await browser.close();
      return {
        success: true,
        id: listing.mercariListingId,
        url: listing.mercariUrl || `https://www.mercari.com/item/${listing.mercariListingId}/`
      };

    } else {
      // --- CREATE NEW FLOW VIA DIRECT GRAPHQL NETWORK API ---
      console.log('[Mercari Publisher] Navigating to Sell page...');
      await page.goto('https://www.mercari.com/sell/', {
        waitUntil: 'domcontentloaded',
        timeout: 35000
      });
      await new Promise(r => setTimeout(r, 2500));

      if (page.url().includes('/signin/') || page.url().includes('/login/')) {
        throw new Error('Failed to authenticate with Mercari. Session cookies are invalid or expired.');
      }

      await dismissMercariModals(page);

      // 1. Capture uploaded photo IDs via network request/response listeners
      let photoIds = [];
      const { token } = extractMercariAuth(credentials);

      page.on('request', req => {
        const u = req.url();
        if (u.includes('sellQuery') || u.includes('smartSalesFeeQuery') || u.includes('photoIds')) {
          const match = u.match(/%22photoIds%22%3A%5B(.*?)%5D/) || u.match(/"photoIds":\[(.*?)\]/);
          if (match) {
            try {
              const raw = decodeURIComponent(match[1]);
              const ids = raw.replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean);
              if (ids.length > 0) {
                photoIds = ids;
                console.log(`[Mercari Publisher] Captured ${ids.length} photo IDs:`, ids);
              }
            } catch (e) {}
          }
        }
      });

      page.on('response', async response => {
        try {
          const u = response.url();
          if (u.includes('/temp/photo') || u.includes('/v1/api')) {
            const text = await response.text();
            if (text.includes('photoId') || text.includes('uploadPhoto')) {
              const data = JSON.parse(text);
              const pid = data.photoId || data.id || data.data?.uploadPhoto?.id || data.data?.uploadPhoto?.photoId;
              if (pid && !photoIds.includes(pid)) {
                photoIds.push(pid);
              }
            }
          }
        } catch (e) {}
      });

      // 2. Upload photos into file input
      console.log(`[Mercari Publisher] Uploading ${tempFiles.length} photos...`);
      const fileSelector = 'input[type="file"], [data-testid="SellPhotoInput"]';
      const fileInput = await page.waitForSelector(fileSelector, { timeout: 20000 });
      await fileInput.uploadFile(...tempFiles);

      console.log('[Mercari Publisher] Waiting for photo processing...');
      let photoWait = 0;
      while ((photoIds.length === 0 || photoIds.length < tempFiles.length) && photoWait < 25) {
        await new Promise(r => setTimeout(r, 1000));
        photoWait++;
      }
      await new Promise(r => setTimeout(r, 1500));
      console.log(`[Mercari Publisher] Photo processing finished with ${photoIds.length} photos.`);

      await dismissMercariModals(page);

      // 3. Resolve Listing Variables
      let conditionIdVal = 3;
      if (typeof listing.selectedCondition === 'number') {
        conditionIdVal = listing.selectedCondition;
      } else if (typeof listing.selectedCondition === 'string') {
        const condLower = listing.selectedCondition.toLowerCase().trim();
        if (condLower.includes('new with tags') || condLower === 'new' || condLower === '1') conditionIdVal = 1;
        else if (condLower.includes('like new') || condLower === '2') conditionIdVal = 2;
        else if (condLower.includes('good') || condLower === '3') conditionIdVal = 3;
        else if (condLower.includes('fair') || condLower === '4') conditionIdVal = 4;
        else if (condLower.includes('poor') || condLower === '5') conditionIdVal = 5;
      }

      const rawPrice = parseFloat(listing.price || '20');
      const priceCents = Math.round(rawPrice * 100) || 2000;
      const floorPriceCents = Math.round(priceCents * 0.8) || 1600;
      const salesFeeCents = Math.round(priceCents * 0.10); // 10% selling fee
      const initialShippingPayerId = listing.shippingPayer === 'buyer' ? 1 : 2;

      // Shipping class IDs
      let shippingClassIdsVal = [2550]; // USPS Ground Advantage default
      if (listing.shippingMethod === 'prepaid') {
        const carrier = (listing.shippingCarrier || '').toLowerCase();
        if (carrier.includes('ups ground saver')) shippingClassIdsVal = [2552];
        else if (carrier.includes('fedex')) shippingClassIdsVal = [2551];
        else if (carrier.includes('ups ground')) shippingClassIdsVal = [2553];
      }

      const buildPayload = (payerId) => ({
        name: (listing.title || 'Mercari Listing').trim().substring(0, 80),
        description: (listing.description || listing.title || 'Item for sale').trim(),
        price: priceCents,
        minPriceForAutoPriceDrop: floorPriceCents,
        salesFee: salesFeeCents,
        categoryId: parseInt(listing.categoryId) || 360,
        conditionId: conditionIdVal,
        sizeId: listing.sizeId ? parseInt(listing.sizeId) : null,
        brandId: listing.brandId ? parseInt(listing.brandId) : null,
        photoIds: photoIds.slice(0, tempFiles.length),
        shippingPayerId: payerId,
        shippingClassIds: shippingClassIdsVal,
        suggestedShippingClassIds: shippingClassIdsVal,
        zipCode: credentials.zipCode || '73078',
        shippingDimensionUnit: 'INCH',
        shippingWeightUnit: 'OUNCE',
        shippingPackageWeight: 16
      });

      console.log('[Mercari Publisher] Triggering Direct GraphQL createListing mutation...');
      let directApiResult = await page.evaluate(async (payload, token) => {
        try {
          const headers = {
            'accept': '*/*',
            'apollo-require-preflight': 'true',
            'content-type': 'application/json'
          };
          if (token) headers['authorization'] = `Bearer ${token}`;

          const res = await fetch('https://www.mercari.com/v1/api', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              operationName: 'createListing',
              variables: {
                input: payload
              },
              extensions: {
                persistedQuery: {
                  version: 1,
                  sha256Hash: '265dab5d0d382d3c83dda7d65e9ad111f47c27aa5d92c7d9a4bacd890d5e32c0'
                }
              }
            })
          });
          return await res.json();
        } catch (err) {
          return { error: err.message };
        }
      }, buildPayload(initialShippingPayerId), token);

      console.log('[Mercari Publisher] GraphQL createListing Response:', JSON.stringify(directApiResult).substring(0, 300));

      if (directApiResult?.data?.createListing?.id) {
        createdListingId = directApiResult.data.createListing.id;
        createdListingUrl = directApiResult.data.createListing.url || `https://www.mercari.com/item/${createdListingId}/`;
      } else if (initialShippingPayerId === 1 && directApiResult?.errors) {
        // If buyer-paid shipping triggered a validation error, retry with seller-paid (shippingPayerId: 2)
        console.log('[Mercari Publisher] Buyer-paid shipping validation failed, retrying with seller-paid (Free shipping)...');
        directApiResult = await page.evaluate(async (payload, token) => {
          try {
            const headers = {
              'accept': '*/*',
              'apollo-require-preflight': 'true',
              'content-type': 'application/json'
            };
            if (token) headers['authorization'] = `Bearer ${token}`;

            const res = await fetch('https://www.mercari.com/v1/api', {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                operationName: 'createListing',
                variables: {
                  input: payload
                },
                extensions: {
                  persistedQuery: {
                    version: 1,
                    sha256Hash: '265dab5d0d382d3c83dda7d65e9ad111f47c27aa5d92c7d9a4bacd890d5e32c0'
                  }
                }
              })
            });
            return await res.json();
          } catch (err) {
            return { error: err.message };
          }
        }, buildPayload(2), token);

        console.log('[Mercari Publisher] Retry GraphQL createListing Response:', JSON.stringify(directApiResult).substring(0, 300));

        if (directApiResult?.data?.createListing?.id) {
          createdListingId = directApiResult.data.createListing.id;
          createdListingUrl = directApiResult.data.createListing.url || `https://www.mercari.com/item/${createdListingId}/`;
        }
      }

      // Fallback: If direct mutation didn't return ID immediately, click List button in DOM
      if (!createdListingId) {
        console.log('[Mercari Publisher] Fallback: Clicking List Button in page...');
        await page.evaluate(() => {
          const listBtn = document.querySelector('button[data-testid="ListButton"]');
          if (listBtn) {
            listBtn.scrollIntoView({ block: 'center' });
            listBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            listBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            listBtn.click();
          }
        });

        let waitTimer = 0;
        while (!createdListingId && waitTimer < 15) {
          const currentUrl = page.url();
          if (currentUrl.includes('/item/') || currentUrl.includes('/sell/confirmation/')) {
            const match = currentUrl.match(/\/item\/(m[0-9]+)/) || currentUrl.match(/\/sell\/confirmation\/(m[0-9]+)/);
            if (match) {
              createdListingId = match[1];
              createdListingUrl = `https://www.mercari.com/item/${createdListingId}/`;
              break;
            }
          }
          await new Promise(r => setTimeout(r, 1000));
          waitTimer++;
        }
      }

      if (!createdListingId) {
        const postAlerts = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[role="alert"], [class*="error" i], [class*="toast" i]')).map(a => a.innerText.trim()).filter(Boolean);
        });
        if (postAlerts.length > 0) {
          throw new Error(`Mercari Publish Error: ${postAlerts.join(', ')}`);
        }
        throw new Error('Listing submission timed out. Please check your Mercari account.');
      }

      const listingUrl = createdListingUrl || `https://www.mercari.com/item/${createdListingId}/`;
      console.log(`[Mercari Publisher] Successfully created listing ID: ${createdListingId} URL: ${listingUrl}`);

      tempFiles.forEach(f => fs.unlink(f, () => {}));
      await browser.close();
      return {
        success: true,
        id: createdListingId,
        url: listingUrl
      };
    }

  } catch (err) {
    console.error('[Mercari Publisher] Publish failed:', err.message);
    tempFiles.forEach(f => fs.unlink(f, () => {}));
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw err;
  }
}

/**
 * Deactivates a listing on Mercari using UpdateItemStatusMutation (status: "stop").
 * 
 * @param {string} mercariListingId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function deactivateMercariListing(mercariListingId, credentials = {}) {
  console.log(`[Mercari Deactivator] Deactivating listing ${mercariListingId} (status: "stop")...`);
  let browser = null;
  try {
    if (!credentials.sessionCookie) {
      throw new Error('Mercari session cookie is missing.');
    }

    const { token } = extractMercariAuth(credentials);
    let interceptedAuth = token ? `Bearer ${token}` : (credentials.accessToken ? `Bearer ${credentials.accessToken}` : null);
    let interceptedCsrf = null;

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const h = req.headers();
      if (req.url().includes('/v1/api')) {
        if (h['authorization']) interceptedAuth = h['authorization'];
        if (h['x-csrf-token']) interceptedCsrf = h['x-csrf-token'];
      }
      req.continue();
    });

    await applyMercariCookies(page, credentials.sessionCookie);

    // Fast GraphQL status update path
    console.log(`[Mercari Deactivator] Navigating to active listings to capture session auth...`);
    await page.goto('https://www.mercari.com/mypage/listings/active/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log(`[Mercari Deactivator] Executing UpdateItemStatusMutation (status: "stop") for ${mercariListingId}...`);
    const mutationResult = await page.evaluate(async (targetId, authHeader, csrf) => {
      try {
        const h = {
          'content-type': 'application/json',
          'apollo-require-preflight': 'true',
          'x-platform': 'web',
          'x-double-web': '1',
          'x-app-version': '1'
        };
        if (authHeader) h['authorization'] = authHeader;
        if (csrf) h['x-csrf-token'] = csrf;

        const res = await fetch('/v1/api', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            operationName: 'UpdateItemStatusMutation',
            variables: {
              input: {
                status: 'stop',
                id: targetId
              }
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: '55bd4e7d2bc2936638e1451da3231e484993635d7603431d1a2978e3d59656f8'
              }
            }
          })
        });
        const json = await res.json();
        return { ok: res.ok, status: res.status, data: json };
      } catch (err) {
        return { error: err.message };
      }
    }, mercariListingId, interceptedAuth, interceptedCsrf);

    if (mutationResult?.data?.data?.updateItemStatus?.status === 'OK') {
      console.log(`[Mercari Deactivator] Successfully deactivated ${mercariListingId} via UpdateItemStatusMutation!`);
      await browser.close();
      return { success: true, id: mercariListingId, status: 'inactive' };
    }

    console.warn(`[Mercari Deactivator] GraphQL mutation returned unexpected response, attempting UI fallback:`, mutationResult);

    // Fallback: Navigate to edit page and click Deactivate button
    const editUrl = `https://www.mercari.com/sell/edit/${mercariListingId}/`;
    console.log(`[Mercari Deactivator] Navigating to ${editUrl}...`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button[data-testid="ActivateDeactivateButton"]', { timeout: 15000 });
    await dismissMercariModals(page);

    const btnText = await page.evaluate(() => document.querySelector('button[data-testid="ActivateDeactivateButton"]')?.innerText.trim());
    if (btnText && btnText.toLowerCase().includes('deactivate')) {
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="ActivateDeactivateButton"]');
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
        }
      });
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        document.querySelectorAll('button').forEach(b => {
          const t = (b.innerText || '').toLowerCase().trim();
          if (t === 'deactivate' || t === 'confirm' || t === 'yes') b.click();
        });
      });
      await new Promise(r => setTimeout(r, 2000));
      console.log(`[Mercari Deactivator] Successfully deactivated ${mercariListingId} via UI`);
    }

    await browser.close();
    return { success: true, id: mercariListingId, status: 'inactive' };
  } catch (err) {
    console.error(`[Mercari Deactivator] Failed to deactivate ${mercariListingId}:`, err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

/**
 * Reactivates an inactive listing on Mercari using UpdateItemStatusMutation (status: "on_sale").
 * 
 * @param {string} mercariListingId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function reactivateMercariListing(mercariListingId, credentials = {}) {
  console.log(`[Mercari Activator] Reactivating listing ${mercariListingId} (status: "on_sale")...`);
  let browser = null;
  try {
    if (!credentials.sessionCookie) {
      throw new Error('Mercari session cookie is missing.');
    }

    const { token } = extractMercariAuth(credentials);
    let interceptedAuth = token ? `Bearer ${token}` : (credentials.accessToken ? `Bearer ${credentials.accessToken}` : null);
    let interceptedCsrf = null;

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const h = req.headers();
      if (req.url().includes('/v1/api')) {
        if (h['authorization']) interceptedAuth = h['authorization'];
        if (h['x-csrf-token']) interceptedCsrf = h['x-csrf-token'];
      }
      req.continue();
    });

    await applyMercariCookies(page, credentials.sessionCookie);

    // Fast GraphQL status update path
    console.log(`[Mercari Activator] Navigating to active listings to capture session auth...`);
    await page.goto('https://www.mercari.com/mypage/listings/active/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log(`[Mercari Activator] Executing UpdateItemStatusMutation (status: "on_sale") for ${mercariListingId}...`);
    const mutationResult = await page.evaluate(async (targetId, authHeader, csrf) => {
      try {
        const h = {
          'content-type': 'application/json',
          'apollo-require-preflight': 'true',
          'x-platform': 'web',
          'x-double-web': '1',
          'x-app-version': '1'
        };
        if (authHeader) h['authorization'] = authHeader;
        if (csrf) h['x-csrf-token'] = csrf;

        const res = await fetch('/v1/api', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            operationName: 'UpdateItemStatusMutation',
            variables: {
              input: {
                status: 'on_sale',
                id: targetId
              }
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: '55bd4e7d2bc2936638e1451da3231e484993635d7603431d1a2978e3d59656f8'
              }
            }
          })
        });
        const json = await res.json();
        return { ok: res.ok, status: res.status, data: json };
      } catch (err) {
        return { error: err.message };
      }
    }, mercariListingId, interceptedAuth, interceptedCsrf);

    if (mutationResult?.data?.data?.updateItemStatus?.status === 'OK') {
      console.log(`[Mercari Activator] Successfully activated ${mercariListingId} via UpdateItemStatusMutation!`);
      await browser.close();
      return { success: true, id: mercariListingId, status: 'active' };
    }

    console.warn(`[Mercari Activator] GraphQL mutation returned unexpected response, attempting UI fallback:`, mutationResult);

    // Fallback: Navigate to edit page and click Activate button
    const editUrl = `https://www.mercari.com/sell/edit/${mercariListingId}/`;
    console.log(`[Mercari Activator] Navigating to ${editUrl}...`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button[data-testid="ActivateDeactivateButton"]', { timeout: 15000 });
    await dismissMercariModals(page);

    const btnText = await page.evaluate(() => document.querySelector('button[data-testid="ActivateDeactivateButton"]')?.innerText.trim());
    if (btnText && btnText.toLowerCase().includes('activate') && !btnText.toLowerCase().includes('deactivate')) {
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="ActivateDeactivateButton"]');
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
        }
      });
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        document.querySelectorAll('button').forEach(b => {
          const t = (b.innerText || '').toLowerCase().trim();
          if (t === 'activate' || t === 'confirm' || t === 'yes') b.click();
        });
      });
      await new Promise(r => setTimeout(r, 2000));
      console.log(`[Mercari Activator] Successfully reactivated ${mercariListingId} via UI`);
    }

    await browser.close();
    return { success: true, id: mercariListingId, status: 'active' };
  } catch (err) {
    console.error(`[Mercari Activator] Failed to reactivate ${mercariListingId}:`, err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

/**
 * Permanently deletes/cancels a listing from Mercari using UpdateItemStatusMutation (status: "cancel").
 * 
 * @param {string} mercariListingId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function deleteFromMercari(mercariListingId, credentials = {}) {
  console.log(`[Mercari Deletor] Deleting listing ${mercariListingId} (status: "cancel")...`);
  let browser = null;
  try {
    if (!credentials.sessionCookie) {
      throw new Error('Mercari session cookie is missing.');
    }

    const { token } = extractMercariAuth(credentials);
    let interceptedAuth = token ? `Bearer ${token}` : (credentials.accessToken ? `Bearer ${credentials.accessToken}` : null);
    let interceptedCsrf = null;

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const h = req.headers();
      if (req.url().includes('/v1/api')) {
        if (h['authorization']) interceptedAuth = h['authorization'];
        if (h['x-csrf-token']) interceptedCsrf = h['x-csrf-token'];
      }
      req.continue();
    });

    await applyMercariCookies(page, credentials.sessionCookie);

    // Fast GraphQL cancel mutation path
    console.log(`[Mercari Deletor] Navigating to listings to capture session auth...`);
    await page.goto('https://www.mercari.com/mypage/listings/active/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log(`[Mercari Deletor] Executing UpdateItemStatusMutation (status: "cancel") for ${mercariListingId}...`);
    const mutationResult = await page.evaluate(async (targetId, authHeader, csrf) => {
      try {
        const h = {
          'content-type': 'application/json',
          'apollo-require-preflight': 'true',
          'x-platform': 'web',
          'x-double-web': '1',
          'x-app-version': '1'
        };
        if (authHeader) h['authorization'] = authHeader;
        if (csrf) h['x-csrf-token'] = csrf;

        const res = await fetch('/v1/api', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            operationName: 'UpdateItemStatusMutation',
            variables: {
              input: {
                status: 'cancel',
                id: targetId
              }
            },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: '55bd4e7d2bc2936638e1451da3231e484993635d7603431d1a2978e3d59656f8'
              }
            }
          })
        });
        const json = await res.json();
        return { ok: res.ok, status: res.status, data: json };
      } catch (err) {
        return { error: err.message };
      }
    }, mercariListingId, interceptedAuth, interceptedCsrf);

    if (mutationResult?.data?.data?.updateItemStatus?.status === 'OK') {
      console.log(`[Mercari Deletor] Successfully deleted ${mercariListingId} via UpdateItemStatusMutation!`);
      await browser.close();
      return { success: true, id: mercariListingId, status: 'deleted' };
    }

    console.warn(`[Mercari Deletor] GraphQL cancel mutation returned unexpected response, attempting UI fallback:`, mutationResult);

    // Fallback: Navigate to edit page and click Delete button
    const editUrl = `https://www.mercari.com/sell/edit/${mercariListingId}/`;
    console.log(`[Mercari Deletor] Navigating to ${editUrl}...`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button[data-testid="DeleteButton"]', { timeout: 15000 });
    await dismissMercariModals(page);

    await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid="DeleteButton"]');
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Confirm deletion modal
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => {
        const t = (b.innerText || '').toLowerCase().trim();
        if (t === 'delete' || t === 'confirm' || t === 'yes') b.click();
      });
    });
    await new Promise(r => setTimeout(r, 2500));
    console.log(`[Mercari Deletor] Successfully deleted ${mercariListingId} from Mercari`);

    await browser.close();
    return { success: true, id: mercariListingId, status: 'deleted' };
  } catch (err) {
    console.error(`[Mercari Deletor] Failed to delete ${mercariListingId}:`, err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

/**
 * Live status verifier for a specific Mercari listing or whole closet.
 * 
 * @param {string} mercariListingId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function verifyMercariListingStatus(mercariListingId, credentials = {}) {
  console.log(`[Mercari Verifier] Verifying live status for listing: ${mercariListingId}...`);
  let browser = null;
  try {
    if (!credentials.sessionCookie) {
      throw new Error('Mercari session cookie is missing.');
    }

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security'
      ]
    };

    const proxyUrl = process.env.HTTP_PROXY_URL || process.env.PROXY_URL;
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
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const { token, sellerId } = extractMercariAuth(credentials);

    await applyMercariCookies(page, credentials.sessionCookie);
    await page.goto('https://www.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const checkResult = await page.evaluate(async (targetId, token, sellerId) => {
      // 1. First check sellFetchItemsDetails directly by itemId (fastest: 1 API call)
      try {
        const detailHash = 'd7b31ddc8e3a5adc4b0ff122fbb5afed17341dfd7f75407b460a4309d15cbf4d';
        const detailUrl = `/v1/api?operationName=sellFetchItemsDetails&variables=${encodeURIComponent(JSON.stringify({ itemId: targetId }))}&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: detailHash } }))}`;
        const h = { 'accept': '*/*', 'apollo-require-preflight': 'true' };
        if (token) h['authorization'] = `Bearer ${token}`;
        const res = await fetch(detailUrl, { headers: h, credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const detail = json.data?.sellFetchItemsDetails;
          if (detail && (detail.id === targetId || detail.name)) {
            const isLive = detail.status === 'on_sale';
            const mercariStatus = detail.status === 'on_sale' ? 'published' : (detail.status === 'stop' ? 'delisted' : (detail.status === 'draft' ? 'delisted' : 'sold'));
            const generalStatus = detail.status === 'on_sale' ? 'active' : (detail.status === 'stop' ? 'inactive' : (detail.status === 'draft' ? 'inactive' : 'sold'));
            return {
              found: true,
              rawStatus: detail.status,
              status: generalStatus,
              mercariStatus,
              isLive,
              item: {
                id: detail.id || targetId,
                name: detail.name,
                price: detail.price,
                photos: detail.photos
              }
            };
          }
        }
      } catch (e) {}

      // 2. Search across userItemsQuery statuses with early exit
      const hash = '88c1f24f1ee3617c5e4b04f33d4f9aec7357e55cb94fea8affc78571df6368f3';
      const statuses = ['on_sale', 'stop', 'draft', 'sold_out', 'trading'];

      for (const status of statuses) {
        let pageNum = 1;
        let hasNextPage = true;

        while (hasNextPage && pageNum <= 10) {
          const vars = {
            userItemsInput: {
              sellerId: Number(sellerId),
              status,
              keyword: "",
              sortBy: "updated",
              sortType: "desc",
              page: pageNum,
              includeTotalCount: true
            }
          };
          const ext = {
            persistedQuery: {
              version: 1,
              sha256Hash: hash
            }
          };
          const url = `/v1/api?operationName=userItemsQuery&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
          
          try {
            const h = {
              'accept': '*/*',
              'apollo-require-preflight': 'true'
            };
            if (token) h['authorization'] = `Bearer ${token}`;

            const res = await fetch(url, { headers: h, credentials: 'include' });
            if (!res.ok) break;
            const json = await res.json();
            const items = json.data?.userItems?.items || [];
            if (items.length === 0) break;
            
            const matched = items.find(it => it.id === targetId);
            if (matched) {
              const isLive = status === 'on_sale';
              const mercariStatus = status === 'on_sale' ? 'published' : (status === 'stop' ? 'delisted' : (status === 'draft' ? 'delisted' : 'sold'));
              const generalStatus = status === 'on_sale' ? 'active' : (status === 'stop' ? 'inactive' : (status === 'draft' ? 'inactive' : 'sold'));
              return {
                found: true,
                rawStatus: status,
                status: generalStatus,
                mercariStatus,
                isLive,
                item: {
                  id: matched.id,
                  name: matched.name,
                  price: matched.price,
                  photos: matched.photos
                }
              };
            }

            if (!json.data?.userItems?.pageInfo?.hasNextPage || items.length < 20) {
              hasNextPage = false;
            } else {
              pageNum++;
            }
          } catch (e) {
            break;
          }
        }
      }

      return { found: false, status: 'deleted', mercariStatus: 'deleted', isLive: false };
    }, mercariListingId, token, sellerId);

    await browser.close();
    console.log(`[Mercari Verifier] Status outcome for ${mercariListingId}:`, JSON.stringify(checkResult));
    return checkResult;
  } catch (err) {
    console.error(`[Mercari Verifier] Failed to verify status for ${mercariListingId}:`, err.message);
    if (browser) await browser.close().catch(() => {});
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

    if (sessionCookie) {
      await applyMercariCookies(page, sessionCookie);
    }

    let extractedUserId = '';
    const mwusCookie = (sessionCookie || '').split(';').find(c => c.trim().startsWith('_mwus='));
    if (mwusCookie) {
      try {
        const val = mwusCookie.trim().replace('_mwus=', '');
        const decoded = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
        if (decoded.userId) extractedUserId = String(decoded.userId);
      } catch (e) {}
    }

    console.log('[Mercari Profile Checker] Navigating to Profile Settings...');
    await page.goto('https://www.mercari.com/mypage/profile/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login/') || currentUrl.includes('/signin/')) {
      console.warn('[Mercari Profile Checker] Redirected to login page. Session is expired.');
      throw new Error('Session is invalid or expired. Please re-login on Mercari.');
    }

    await page.waitForSelector('input[name="displayName"], input[placeholder*="display name" i], input[placeholder*="username" i]', { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const profileDetails = await page.evaluate(() => {
      const nameInput = document.querySelector('input[name="displayName"], input[name="name"], input[placeholder*="display name" i], input[placeholder*="username" i]');
      if (nameInput && nameInput.value && nameInput.value.trim()) return { username: nameInput.value.trim() };
      
      const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i], h1[class*="Name"], [class*="name" i] h1');
      let username = nameEl ? nameEl.textContent.trim() : '';
      return { username };
    });

    const finalUserId = extractedUserId || profileDetails.userId || '';
    console.log('[Mercari Profile Checker] Scraped profile:', { username: profileDetails.username, userId: finalUserId });

    await browser.close();
    return {
      success: true,
      username: profileDetails.username,
      userId: finalUserId
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

/**
 * Category path lookup helper from taxonomy
 */
function getCategoryPathById(categoryId) {
  if (!categoryId) return null;
  try {
    const taxonomy = require('../constants/mercariCategoryTaxonomy.json');
    const tree = taxonomy.MERCARI_CATEGORY_TREE || [];
    function findNode(nodes, currentPath = []) {
      for (const node of nodes) {
        const nextPath = [...currentPath, node.name];
        if (String(node.id) === String(categoryId)) {
          return {
            id: String(node.id),
            name: node.name,
            fullPath: nextPath.join(' > '),
            itemSizeGroupId: node.itemSizeGroupId || 0
          };
        }
        if (node.children && node.children.length > 0) {
          const found = findNode(node.children, nextPath);
          if (found) return found;
        }
      }
      return null;
    }
    return findNode(tree);
  } catch (e) {
    return null;
  }
}

/**
 * Sizing lookup helper
 */
function getSizeNameById(sizeId, sizeGroupId) {
  if (!sizeId) return '';
  const sizeGroupMap = {
    "1": { "1": "XXS (00)", "2": "XS (0-2)", "3": "S (4-6)", "4": "M (8-10)", "5": "L (12-14)", "6": "XL (16-18)", "7": "2XL (20-22)", "160": "3XL (24-26)", "161": "4XL (28-30)", "162": "5XL (32-34)", "163": "One Size", "289": "1X (16-18)" },
    "2": { "8": "XS (30-32)", "9": "S (34-36)", "10": "M (38-40)", "11": "L (42-44)", "12": "XL (46-48)", "13": "XXL (50-52)", "164": "3XL (54-56)", "165": "4XL (58-60)", "166": "5XL (62-64)", "167": "One Size" }
  };

  if (sizeGroupId && sizeGroupMap[String(sizeGroupId)] && sizeGroupMap[String(sizeGroupId)][String(sizeId)]) {
    return sizeGroupMap[String(sizeGroupId)][String(sizeId)];
  }
  for (const g of Object.values(sizeGroupMap)) {
    if (g[String(sizeId)]) return g[String(sizeId)];
  }
  return '';
}

/**
 * Brand detector helper using local brand database
 */
function detectBrand(title) {
  if (!title) return { id: '', name: '' };
  try {
    const brands = require('../constants/mercariBrands.json');
    const words = title.split(/\s+/);
    for (let len = 4; len >= 1; len--) {
      const phrase = words.slice(0, len).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (brands[phrase]) {
        return brands[phrase];
      }
    }
  } catch (e) {}
  return { id: '', name: '' };
}

/**
 * Fetches full item details (all photos, description, category, size, brand, condition, shipping)
 * using the official Mercari sellFetchItemsDetails GraphQL query.
 *
 * @param {string} mercariListingId 
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function fetchMercariItemDetails(mercariListingId, credentials = {}) {
  console.log(`[Mercari Details Fetcher] Fetching full item details for: ${mercariListingId}...`);
  let browser = null;
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    if (credentials.sessionCookie) {
      await applyMercariCookies(page, credentials.sessionCookie);
    }

    const { token } = extractMercariAuth(credentials);

    await page.goto('https://www.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const result = await page.evaluate(async (token, itemId) => {
      const hash = 'd7b31ddc8e3a5adc4b0ff122fbb5afed17341dfd7f75407b460a4309d15cbf4d';
      const vars = { itemId };
      const ext = {
        persistedQuery: {
          version: 1,
          sha256Hash: hash
        }
      };
      const url = `/v1/api?operationName=sellFetchItemsDetails&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
      
      const h = {
        'accept': '*/*',
        'apollo-require-preflight': 'true'
      };
      if (token) h['authorization'] = `Bearer ${token}`;

      const res = await fetch(url, { headers: h, credentials: 'include' });
      const json = await res.json();
      return json.data?.item || json.data?.sellFetchItemsDetails || null;
    }, token, mercariListingId);

    await browser.close();

    if (!result) {
      throw new Error(`Item ${mercariListingId} not found on Mercari.`);
    }

    const images = (result.photos || [])
      .map(p => p.imageUrl || p.thumbnail || (typeof p === 'string' ? p : ''))
      .filter(Boolean);

    const rawPrice = result.price || 0;
    const formattedPrice = (typeof rawPrice === 'number' && rawPrice > 100) 
      ? (rawPrice / 100).toFixed(2) 
      : String(rawPrice);

    const catInfo = getCategoryPathById(result.itemCategory?.id);
    const sizeName = getSizeNameById(result.itemSize?.id, catInfo?.itemSizeGroupId);
    const brandInfo = result.itemBrand?.name 
      ? { id: result.itemBrand.id, name: result.itemBrand.name }
      : detectBrand(result.name);

    let conditionName = 'good';
    let conditionLabel = 'Good';
    const cId = result.itemCondition?.id;
    if (cId === 1) { conditionName = 'new'; conditionLabel = 'New (with tags)'; }
    else if (cId === 2) { conditionName = 'like_new'; conditionLabel = 'Like New'; }
    else if (cId === 3) { conditionName = 'good'; conditionLabel = 'Good'; }
    else if (cId === 4) { conditionName = 'fair'; conditionLabel = 'Fair'; }
    else if (cId === 5) { conditionName = 'poor'; conditionLabel = 'Poor'; }

    return {
      mercariListingId: result.itemId || mercariListingId,
      title: result.name || '',
      description: result.description || '',
      price: formattedPrice,
      selling_price: parseFloat(formattedPrice) || 0,
      images,
      photosLength: images.length,
      category: catInfo?.fullPath || (catInfo ? catInfo.name : 'Clothing'),
      categoryId: String(result.itemCategory?.id || ''),
      brand: brandInfo.name || '',
      brandId: String(brandInfo.id || ''),
      size: sizeName || '',
      sizeId: String(result.itemSize?.id || ''),
      selectedCondition: conditionName,
      condition: conditionLabel,
      conditionId: String(cId || ''),
      shippingPayer: result.shippingPayer?.id === 1 ? 'buyer' : 'seller',
      status: result.status === 'on_sale' ? 'active' : (result.status === 'stop' ? 'inactive' : 'sold')
    };

  } catch (err) {
    console.error(`[Mercari Details Fetcher] Failed to fetch details for ${mercariListingId}:`, err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

/**
 * Syncs in-progress ('trading') and completed ('sold_out') orders from Mercari
 * and saves them into the Order collection in MongoDB without duplicates.
 *
 * @param {Object} credentials User connection details containing session cookies
 * @param {string} userId MongoDB User ID
 * @returns {Promise<Object>} Sync outcome metrics
 */
async function syncMercariOrders(credentials = {}, userId = null) {
  console.log(`[Mercari Order Sync] Fetching orders (trading & sold_out) for User ${userId}...`);
  let browser = null;
  const Order = require('../models/Order');

  try {
    if (!credentials.sessionCookie) {
      throw new Error('Mercari session cookie is missing.');
    }

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

    if (credentials.sessionCookie) {
      await applyMercariCookies(page, credentials.sessionCookie);
    }

    const { token, sellerId } = extractMercariAuth(credentials);

    console.log(`[Mercari Order Sync] Navigating to Mercari home (sellerId: ${sellerId})...`);
    await page.goto('https://www.mercari.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const scrapedOrders = await page.evaluate(async (token, passedSellerId) => {
      const hash = '88c1f24f1ee3617c5e4b04f33d4f9aec7357e55cb94fea8affc78571df6368f3';

      let decodedId = null;
      if (token && token.includes('.')) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.data?.userId) decodedId = Number(payload.data.userId);
        } catch (e) {}
      }

      const candidateIds = Array.from(new Set([passedSellerId, 555256503, decodedId].map(Number).filter(Boolean)));
      const orderStatuses = ['trading', 'sold_out'];
      const rawOrders = [];
      const seenIds = new Set();

      for (const sellerId of candidateIds) {
        for (const orderStatus of orderStatuses) {
          let pageNum = 1;
          while (pageNum <= 20) {
            const vars = {
              userItemsInput: {
                sellerId: Number(sellerId),
                status: orderStatus,
                keyword: "",
                sortBy: "updated",
                sortType: "desc",
                page: pageNum,
                includeTotalCount: true
              }
            };
          const ext = {
            persistedQuery: {
              version: 1,
              sha256Hash: hash
            }
          };
          const url = `/v1/api?operationName=userItemsQuery&variables=${encodeURIComponent(JSON.stringify(vars))}&extensions=${encodeURIComponent(JSON.stringify(ext))}`;
          
          try {
            const h = {
              'accept': '*/*',
              'apollo-require-preflight': 'true'
            };
            if (token) h['authorization'] = `Bearer ${token}`;

            const res = await fetch(url, { headers: h, credentials: 'include' });
            if (!res.ok) break;
            const json = await res.json();
            const list = json.data?.userItems?.items || [];
            if (list.length === 0) break;

            for (const item of list) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                rawOrders.push({
                  ...item,
                  _queryStatus: orderStatus
                });
              }
            }

            if (list.length < 20) break;
            pageNum++;
          } catch (e) {
            break;
          }
        }
      }
    }

      return rawOrders;
    }, token, sellerId);

    await browser.close();

    console.log(`[Mercari Order Sync] Fetched ${scrapedOrders.length} raw order items from Mercari.`);

    let syncedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    for (const item of scrapedOrders) {
      const orderId = item.activeOrder?.orderId || `MERC-${item.id}`;
      const isTrading = item._queryStatus === 'trading' || item.status === 'trading';
      const orderStatus = isTrading ? 'Pending' : 'Delivered';
      
      const rawPrice = item.price || 0;
      const totalAmount = (typeof rawPrice === 'number' && rawPrice > 100) 
        ? parseFloat((rawPrice / 100).toFixed(2)) 
        : (parseFloat(rawPrice) || 0);

      const createdDate = item.updated 
        ? new Date(item.updated * 1000) 
        : (item.created ? new Date(item.created * 1000) : new Date());

      const thumbnail = (item.photos && item.photos.length > 0)
        ? (item.photos[0].thumbnail || item.photos[0].imageUrl || (typeof item.photos[0] === 'string' ? item.photos[0] : ''))
        : '';

      const lineItems = [{
        lineItemId: item.id,
        title: item.name || 'Mercari Item',
        sku: `M-${item.id}`,
        quantity: 1,
        price: totalAmount,
        thumbnail
      }];

      if (userId) {
        const existingOrder = await Order.findOne({ user: userId, orderId });
        const isNewOrder = !existingOrder;

        await Order.findOneAndUpdate(
          { user: userId, orderId },
          {
            $set: {
              user: userId,
              orderId,
              sellerId: String(credentials.userId || ''),
              buyerUsername: item.buyer?.name || 'Mercari Buyer',
              totalAmount,
              currency: 'USD',
              status: orderStatus,
              paymentStatus: 'PAID',
              createdDate,
              paidDate: createdDate,
              lineItems,
              platform: 'mercari',
              orderUrl: `https://www.mercari.com/item/${item.id}/`,
              updated_at: new Date()
            }
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Trigger Cross-Platform Auto-Delist only for freshly detected sales
        if (isNewOrder) {
          try {
            const { handleItemSold } = require('./autoDelistService');
            handleItemSold({
              userId,
              soldPlatform: 'mercari',
              sku: item.sku || `M-${item.id}`,
              listingId: item.id,
              title: item.name,
              orderId
            }).catch(e => console.error('[Mercari Order Sync] Auto-delist hook error:', e.message));
          } catch (hookErr) {
            console.warn('[Mercari Order Sync] Failed to dispatch auto-delist hook:', hookErr.message);
          }
        }
      }

      syncedCount++;
      if (isTrading) inProgressCount++;
      else completedCount++;
    }

    console.log(`[Mercari Order Sync] Successfully saved ${syncedCount} Mercari orders (${inProgressCount} in-progress, ${completedCount} completed).`);

    return {
      success: true,
      count: syncedCount,
      inProgressCount,
      completedCount
    };

  } catch (err) {
    console.error(`[Mercari Order Sync] Error syncing orders:`, err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

module.exports = {
  scrapeMercariCloset,
  publishToMercari,
  deactivateMercariListing,
  reactivateMercariListing,
  deleteFromMercari,
  verifyMercariListingStatus,
  getMercariProfile,
  fetchMercariItemDetails,
  syncMercariOrders
};


