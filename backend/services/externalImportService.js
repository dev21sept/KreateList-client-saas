const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

try {
  puppeteer.use(StealthPlugin());
} catch (e) {
  // ignore if already registered
}

// Recursive helper to find anything resembling a product array inside NextData JSON
function findProductsInNextData(obj) {
  let products = [];
  
  function recurse(current) {
    if (!current || typeof current !== 'object') return;
    
    // Check if current is an array
    if (Array.isArray(current)) {
      // Check if first element in array looks like a product (has key indicators)
      const hasIndicators = current.length > 0 && current[0] && typeof current[0] === 'object' &&
        (('id' in current[0] || 'slug' in current[0]) && 
         ('price' in current[0] || 'priceAmount' in current[0] || 'price_amount' in current[0]) &&
         ('images' in current[0] || 'pictures' in current[0] || 'picture_ids' in current[0]));
      
      if (hasIndicators) {
        products = current;
        return;
      }
      for (const item of current) {
        recurse(item);
      }
    } else {
      // Check for common array keys
      if (current.products && Array.isArray(current.products)) {
        products = current.products;
        return;
      }
      if (current.results && Array.isArray(current.results) && current.results.length > 0 && current.results[0].slug) {
        products = current.results;
        return;
      }
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          recurse(current[key]);
        }
      }
    }
  }
  
  recurse(obj);
  return products;
}

// Generate request options, incorporating scraping proxies if configured in .env
function getRequestConfig(targetUrl) {
  const scrapingApiUrl = process.env.SCRAPING_API_URL;
  const scrapingApiKey = process.env.SCRAPING_API_KEY;

  if (scrapingApiUrl) {
    // Standard setup for ScraperAPI / ScrapingBee / ZenRows URL encapsulation
    let url = scrapingApiUrl;
    if (scrapingApiUrl.includes('?')) {
      url += `&url=${encodeURIComponent(targetUrl)}`;
    } else {
      url += `?url=${encodeURIComponent(targetUrl)}`;
    }
    if (scrapingApiKey) {
      url += `&apikey=${scrapingApiKey}&api_key=${scrapingApiKey}`;
    }
    console.log(`[Import Scraper] Routing through proxy API: ${url.split('?')[0]}...`);
    return {
      url: url,
      headers: { 'Accept': 'text/html' }
    };
  }

  // Fallback to direct request with clean browser headers
  return {
    url: targetUrl,
    headers: {
      'authority': new URL(targetUrl).hostname,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };
}

/**
 * Helper to decode JWT token and extract username
 */
function getDepopUsernameFromToken(token) {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const parts = cleanToken.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payloadObj = JSON.parse(decodedPayload);
      if (payloadObj.username) return payloadObj.username;
      if (payloadObj.username_canonical) return payloadObj.username_canonical;
      if (payloadObj.sub) return payloadObj.sub;
    }
  } catch (e) {
    console.error('[Import Scraper] Error decoding Depop JWT token:', e.message);
  }
  return null;
}

/**
 * Scrapes Depop profile products list
 * @param {string} username Depop username
 * @param {Object} [credentials] Depop connection credentials (accessToken)
 * @returns {Promise<Array>} List of parsed listing objects
 */
async function resolveDepopUsernameViaPuppeteer(accessToken) {
  let browser = null;
  try {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    try {
      puppeteer.use(StealthPlugin());
    } catch (e) {}

    console.log('[Import Scraper] Launching Puppeteer Stealth to resolve username...');
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
    
    // Block unnecessary resources to speed up loading and prevent timeouts
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto('https://www.depop.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const result = await page.evaluate(async (token) => {
      try {
        const response = await fetch('https://webapi.depop.com/api/v1/auth/session/', {
          method: 'GET',
          headers: {
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          return data.username || null;
        }
        return null;
      } catch (err) {
        return null;
      }
    }, accessToken);

    return result;
  } catch (err) {
    console.error('[Import Scraper] Failed to resolve username via Puppeteer:', err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function scrapeDepopShop(username, credentials = {}) {
  let cleanUsername = username.trim().toLowerCase();

  // If cleanUsername is an email, 'depop_user', or empty, try to resolve it using the accessToken
  if ((cleanUsername.includes('@') || cleanUsername === 'depop_user' || !cleanUsername) && credentials && credentials.accessToken) {
    console.log(`[Import Scraper] Stored Depop username is an email, 'depop_user', or empty. Resolving actual username...`);
    let extracted = getDepopUsernameFromToken(credentials.accessToken);

    if (!extracted) {
      // Fallback: call Depop auth/session API via Puppeteer Stealth
      extracted = await resolveDepopUsernameViaPuppeteer(credentials.accessToken);
    }

    if (extracted) {
      cleanUsername = extracted.trim().toLowerCase();
      if (credentials) credentials.username = extracted;
      console.log(`[Import Scraper] Successfully resolved Depop username to: ${cleanUsername}`);
    }
  }

  const targetUrl = `https://www.depop.com/${cleanUsername}/`;
  console.log(`[Import Scraper] Fetching Depop shop for ${cleanUsername} at ${targetUrl}`);
  
  const config = getRequestConfig(targetUrl);
  
  try {
    let html = null;
    try {
      const response = await axios.get(config.url, {
        headers: config.headers,
        timeout: 15000
      });
      html = response.data;
    } catch (err) {
      console.warn(`[Import Scraper] Public Depop fetch via Axios failed: ${err.message}. Trying Puppeteer fallback...`);
      html = await fetchHtmlWithPuppeteer(targetUrl);
    }
    
    const $ = cheerio.load(html);
    const listings = [];

    // 1. Try __NEXT_DATA__ JSON parsing (best for maximum data)
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const rawProducts = findProductsInNextData(nextData);
        
        if (rawProducts && rawProducts.length > 0) {
          console.log(`[Import Scraper] Found ${rawProducts.length} items inside Depop __NEXT_DATA__`);
          
          for (const item of rawProducts) {
            // Depop NextData products can contain fields like slug, price, pictures, etc.
            const slug = item.slug || '';
            const title = item.title || item.slug?.replace(/-/g, ' ') || 'Depop Item';
            const description = item.description || item.body || title;
            const depopId = String(item.id || item.productId || '');
            const depopUrl = slug ? `https://www.depop.com/products/${slug}/` : `https://www.depop.com/products/${depopId}/`;
            
            // Extract images
            let imageUrls = [];
            if (item.images && Array.isArray(item.images)) {
              imageUrls = item.images.map(img => img.url || img.src || (typeof img === 'string' ? img : '')).filter(Boolean);
            } else if (item.pictures && Array.isArray(item.pictures)) {
              imageUrls = item.pictures.map(p => p.url || (Array.isArray(p) ? p[0]?.url : '')).filter(Boolean);
            }
            
            // Extract price
            let priceVal = '0.00';
            if (item.price && typeof item.price === 'object') {
              priceVal = item.price.priceAmount || item.price.amount || String(item.price.value || '0.00');
            } else if (item.priceAmount || item.price_amount) {
              priceVal = String(item.priceAmount || item.price_amount);
            }
            
            // Generate basic unique SKU code
            const timestamp = Date.now().toString().substring(8);
            const generatedSku = `D-${depopId || timestamp}`;

            listings.push({
              title: title.trim(),
              description: description.trim(),
              price: parseFloat(priceVal).toFixed(2),
              sku: generatedSku,
              category: item.categoryName || item.category?.name || 'Tops',
              categoryId: String(item.categoryId || item.category?.id || ''),
              images: imageUrls,
              thumbnail: imageUrls[0] || '',
              platform: 'depop',
              depopListingId: depopId,
              depopUrl: depopUrl,
              brand: item.brandName || item.brand?.name || '',
              size: item.sizeName || item.size?.name || '',
              color: item.colour || item.color || '',
              quantity: item.quantity || 1,
              status: 'draft'
            });
          }
          
          return listings;
        }
      } catch (jsonErr) {
        console.warn(`[Import Scraper] Failed to parse Depop __NEXT_DATA__ JSON:`, jsonErr.message);
      }
    }

    // 2. Fallback: Parse directly from HTML DOM elements
    console.log('[Import Scraper] Depop NextData parsing missed. Running DOM fallback scraper...');
    
    // In Depop, listings are wrapped in links to products
    $('a[href*="/products/"]').each((i, el) => {
      const href = $(el).attr('href');
      const fullUrl = href.startsWith('http') ? href : `https://www.depop.com${href}`;
      const imgEl = $(el).find('img');
      const imgUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const title = imgEl.attr('alt') || '';
      
      // Parse price (look for text containing currency symbol inside the link card)
      let priceText = '0.00';
      const textVal = $(el).text();
      const priceMatch = textVal.match(/[\$\£\€\¥]\s?(\d+(\.\d{2})?)/);
      if (priceMatch) {
        priceText = priceMatch[1];
      }

      // Check if product is already in our temp array to avoid duplicates from DOM selectors
      if (imgUrl && !listings.some(l => l.depopUrl === fullUrl)) {
        const slugMatch = href.match(/\/products\/([^\/]+)/);
        const slug = slugMatch ? slugMatch[1] : '';
        const timestamp = Date.now().toString().substring(8);

        listings.push({
          title: title.replace(/Image for/i, '').trim() || 'Depop Product',
          description: title.replace(/Image for/i, '').trim(),
          price: parseFloat(priceText).toFixed(2),
          sku: `D-${slug.substring(0, 15) || timestamp}`,
          category: 'Tops',
          images: [imgUrl],
          thumbnail: imgUrl,
          platform: 'depop',
          depopUrl: fullUrl,
          quantity: 1,
          status: 'draft'
        });
      }
    });

    console.log(`[Import Scraper] Successfully parsed ${listings.length} items from Depop HTML DOM`);
    return listings;
  } catch (err) {
    console.error(`[Import Scraper] Depop scrape error:`, err.message);
    throw new Error(`Failed to scrape Depop shop. Platform returned: ${err.response?.status || err.message}`);
  }
}

/**
 * Helper to fetch HTML content from a URL using Puppeteer Stealth Browser.
 * Used when direct HTTP requests (axios) are blocked by Cloudflare/WAF.
 */
async function fetchHtmlWithPuppeteer(targetUrl) {
  let browser = null;
  try {
    const isProd = process.env.NODE_ENV === 'production' || process.env.HTTP_PROXY_URL;
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    };

    const proxyUrl = process.env.HTTP_PROXY_URL;
    if (proxyUrl) {
      launchOptions.args.push(`--proxy-server=${proxyUrl}`);
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      const checkPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
      for (const p of checkPaths) {
        if (fs.existsSync(p)) {
          launchOptions.executablePath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    const response = await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Wait 2 seconds for dynamic contents to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    await browser.close();
    return html;
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw error;
  }
}

/**
 * Scrapes Poshmark closet products list
 * @param {string} username Poshmark username
 * @param {Object} [credentials] Poshmark connection credentials (sessionCookie, csrfToken)
 * @returns {Promise<Array>} List of parsed listing objects
 */
async function scrapePoshmarkCloset(username, credentials = {}) {
  let cleanUsername = username.trim().toLowerCase();
  
  // Parse helper for cookie values
  const getCookieValue = (cookieStr, name) => {
    if (!cookieStr) return null;
    const cookies = cookieStr.split(';');
    for (const cookie of cookies) {
      const [cookieName, cookieVal] = cookie.trim().split('=');
      if (cookieName === name) {
        return decodeURIComponent(cookieVal);
      }
    }
    return null;
  };

  // If cleanUsername is an email, try to resolve it using the sessionCookie
  if (cleanUsername.includes('@') && credentials && credentials.sessionCookie) {
    console.log(`[Import Scraper] Stored username is an email. Resolving actual username from session cookies...`);
    let extracted = '';

    // Step 1: Extract username locally from 'ui' cookie (immune to 403 blocks)
    const uiCookie = getCookieValue(credentials.sessionCookie, 'ui');
    if (uiCookie) {
      try {
        const parsedUi = JSON.parse(uiCookie);
        if (parsedUi && parsedUi.dh) {
          extracted = parsedUi.dh;
          console.log(`[Import Scraper] Resolved username from ui cookie: ${extracted}`);
        }
      } catch (e) {
        // Fallback regex match if JSON.parse fails (e.g., if cookie is double-encoded or contains invalid JSON)
        const match = uiCookie.match(/"dh"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          extracted = match[1];
          console.log(`[Import Scraper] Resolved username from ui cookie (regex): ${extracted}`);
        }
      }
    }

    if (!extracted) {
      const cookieUser = getCookieValue(credentials.sessionCookie, 'username') || getCookieValue(credentials.sessionCookie, 'user_name');
      if (cookieUser) {
        extracted = cookieUser;
        console.log(`[Import Scraper] Resolved username from legacy cookie: ${extracted}`);
      }
    }

    // Step 2: Fallback to home page web request only if local parsing yielded nothing
    if (!extracted) {
      try {
        const homeResponse = await axios.get('https://poshmark.com/', {
          headers: {
            'cookie': credentials.sessionCookie,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
        const $ = cheerio.load(homeResponse.data);
        
        const closetLink = $('a[href*="/closet/"]').first();
        if (closetLink.length > 0) {
          const href = closetLink.attr('href') || '';
          const match = href.match(/\/closet\/([^/?#\s]+)/);
          if (match && match[1]) extracted = match[1];
        }
        
        if (!extracted) {
          $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/\/closet\/([^/?#\s]+)/);
            if (match && match[1]) {
              extracted = match[1];
              return false; // break loop
            }
          });
        }
      } catch (resolveErr) {
        console.warn(`[Import Scraper] Failed to resolve username via web request: ${resolveErr.message}`);
      }
    }

    if (extracted) {
      cleanUsername = extracted;
      if (credentials) credentials.username = extracted;
      console.log(`[Import Scraper] Successfully resolved username to: ${cleanUsername}`);
    } else {
      console.warn(`[Import Scraper] Could not resolve actual username from session cookies or web request.`);
    }
  }

  // 1. Try using the API with credentials first if available
  if (credentials && credentials.sessionCookie) {
    const { sessionCookie, csrfToken } = credentials;
    const apiUrl = `https://poshmark.com/vm-rest/users/${cleanUsername}/posts?request_context=closet&count=48`;
    console.log(`[Import Scraper] Fetching Poshmark closet via REST API for ${cleanUsername} at ${apiUrl}`);
    
    try {
      const apiResponse = await axios.get(apiUrl, {
        headers: {
          'cookie': sessionCookie,
          'x-csrf-token': csrfToken || '',
          'accept': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const posts = apiResponse.data?.data || [];
      console.log(`[Import Scraper] API call successful. Found ${posts.length} posts.`);
      
      if (posts.length > 0) {
        const listings = [];
        for (const post of posts) {
          const title = post.title || '';
          const description = post.description || title;
          const priceVal = String(post.price || '0.00');
          
          let imgUrl = '';
          if (post.cover_shot && post.cover_shot.url) {
            imgUrl = post.cover_shot.url;
          } else if (post.pictures && post.pictures.length > 0) {
            imgUrl = post.pictures[0].url || post.pictures[0].src || '';
          }
          
          const imgUrls = post.pictures && Array.isArray(post.pictures)
            ? post.pictures.map(p => p.url).filter(Boolean)
            : (imgUrl ? [imgUrl] : []);

          const fullUrl = post.share_url || `https://poshmark.com/listing/${post.id}`;
          const generatedSku = `P-${post.id}`;
          
          listings.push({
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(priceVal).toFixed(2),
            sku: generatedSku,
            category: 'Tops',
            images: imgUrls,
            thumbnail: imgUrl || '',
            platform: 'poshmark',
            poshmarkListingId: post.id,
            poshmarkUrl: fullUrl,
            brand: post.brand || '',
            size: post.size || '',
            quantity: 1,
            status: 'draft'
          });
        }
        return listings;
      }
    } catch (apiErr) {
      console.warn(`[Import Scraper] Poshmark API closet fetch failed: ${apiErr.message}. Falling back to public page scraping.`);
    }
  }

  // 2. Fallback to public page scraping
  const targetUrl = `https://poshmark.com/closet/${cleanUsername}`;
  console.log(`[Import Scraper] Fetching public Poshmark closet for ${cleanUsername} at ${targetUrl}`);
  
  const config = getRequestConfig(targetUrl);
  
  try {
    let html = null;
    try {
      const response = await axios.get(config.url, {
        headers: config.headers,
        timeout: 15000
      });
      html = response.data;
    } catch (err) {
      console.warn(`[Import Scraper] Public Poshmark fetch via Axios failed: ${err.message}. Trying Puppeteer fallback...`);
      html = await fetchHtmlWithPuppeteer(targetUrl);
    }
    
    const $ = cheerio.load(html);
    const listings = [];

    // 1. Try parsing JSON-LD scripts (LD+JSON) containing Product schemas or ItemList
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const text = $(el).html();
        if (!text) return;
        const schema = JSON.parse(text);
        
        // Handle ItemList schema which wraps all closet items
        if (schema && (schema['@type'] === 'ItemList' || schema.itemListElement)) {
          const items = schema.itemListElement || [];
          console.log(`[Import Scraper] Found schema ItemList with ${items.length} elements`);
          
          for (const listEl of items) {
            const item = listEl.item || listEl;
            if (item && item['@type'] === 'Product') {
              const title = item.name || '';
              const description = item.description || title;
              const link = item.url || item['@id'] || '';
              const fullUrl = link.startsWith('http') ? link : `https://poshmark.com${link}`;
              const imgUrl = item.image || '';
              
              let priceVal = '0.00';
              if (item.offers) {
                priceVal = String(item.offers.price || item.offers[0]?.price || '0.00');
              }
              
              const listingIdMatch = fullUrl.match(/-([a-f0-9]{24})$/);
              const poshmarkId = listingIdMatch ? listingIdMatch[1] : '';
              const generatedSku = `P-${poshmarkId || Date.now().toString().substring(8)}`;

              listings.push({
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(priceVal).toFixed(2),
                sku: generatedSku,
                category: 'Tops',
                images: imgUrl ? [imgUrl] : [],
                thumbnail: imgUrl || '',
                platform: 'poshmark',
                poshmarkListingId: poshmarkId,
                poshmarkUrl: fullUrl,
                brand: item.brand?.name || item.brand || '',
                size: item.size || '',
                quantity: 1,
                status: 'draft'
              });
            }
          }
        }
      } catch (schemaErr) {
        // Suppress individual block parser errors
      }
    });

    if (listings.length > 0) {
      console.log(`[Import Scraper] Found ${listings.length} items inside Poshmark JSON-LD schemas`);
      return listings;
    }

    // 2. Fallback: DOM scraper parsing tile element structures
    console.log('[Import Scraper] Poshmark schema parsing missed. Running DOM fallback scraper...');
    
    $('.tile').each((i, el) => {
      const titleEl = $(el).find('.title, a.tile__title');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || $(el).find('a').attr('href') || '';
      const fullUrl = href.startsWith('http') ? href : `https://poshmark.com${href}`;
      
      const imgEl = $(el).find('img.tile__image, img');
      const imgUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || '';
      
      const priceText = $(el).find('.price, .tile__price').text().trim();
      const cleanPrice = priceText.replace(/[^\d.]/g, '') || '0.00';

      const listingIdMatch = fullUrl.match(/-([a-f0-9]{24})$/);
      const poshmarkId = listingIdMatch ? listingIdMatch[1] : '';
      const generatedSku = `P-${poshmarkId || Date.now().toString().substring(8)}`;

      if (title && !listings.some(l => l.poshmarkUrl === fullUrl)) {
        listings.push({
          title: title,
          description: title,
          price: parseFloat(cleanPrice).toFixed(2),
          sku: generatedSku,
          category: 'Tops',
          images: imgUrl ? [imgUrl] : [],
          thumbnail: imgUrl || '',
          platform: 'poshmark',
          poshmarkListingId: poshmarkId,
          poshmarkUrl: fullUrl,
          quantity: 1,
          status: 'draft'
        });
      }
    });

    console.log(`[Import Scraper] Successfully parsed ${listings.length} items from Poshmark HTML DOM`);
    return listings;
  } catch (err) {
    console.error(`[Import Scraper] Poshmark scrape error:`, err.message);
    throw new Error(`Failed to scrape Poshmark closet. Platform returned: ${err.response?.status || err.message}`);
  }
}

module.exports = {
  scrapeDepopShop,
  scrapePoshmarkCloset
};
