const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

try {
  puppeteer.use(StealthPlugin());
} catch (e) {
  // ignore if already registered
}

// Generate request options, incorporating scraping proxies if configured in .env
function getRequestConfig(targetUrl) {
  const scrapingApiUrl = process.env.SCRAPING_API_URL;
  const scrapingApiKey = process.env.SCRAPING_API_KEY;

  if (scrapingApiUrl) {
    let url = scrapingApiUrl;
    if (scrapingApiUrl.includes('?')) {
      url += `&url=${encodeURIComponent(targetUrl)}`;
    } else {
      url += `?url=${encodeURIComponent(targetUrl)}`;
    }
    if (scrapingApiKey) {
      url += `&apikey=${scrapingApiKey}&api_key=${scrapingApiKey}`;
    }
    console.log(`[Etsy Scraper] Routing through proxy API: ${url.split('?')[0]}...`);
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
 * Fetch HTML content from a URL using Puppeteer Stealth Browser.
 */
async function fetchHtmlWithPuppeteer(targetUrl) {
  let browser = null;
  try {
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
 * Parses Etsy listing page html and extracts raw page text and image links.
 */
function parseEtsyHtml(html) {
  const $ = cheerio.load(html);
  
  // Extract all image links from DOM
  let images = [];
  $('img').each((i, el) => {
    const src = $(el).attr('data-src-zoom-image') || $(el).attr('data-large-image-url') || $(el).attr('data-src') || $(el).attr('src');
    if (src && (src.includes('/il_') || src.includes('etsystatic.com')) && !images.includes(src)) {
      images.push(src);
    }
  });

  // Extract meta tags og:image
  const ogImg = $('meta[property="og:image"]').attr('content');
  if (ogImg && !images.includes(ogImg)) {
    images.unshift(ogImg);
  }

  // Get raw text from the body to send to AI
  // Remove script, style, and interactive elements to clean context
  $('script, style, iframe, noscript, header, footer, nav, dialog').remove();
  const rawText = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    text: rawText,
    images: [...new Set(images.map(img => img.trim()).filter(Boolean))]
  };
}

/**
 * Scrapes an Etsy product listing URL and parses details.
 */
async function scrapeEtsyListing(targetUrl) {
  console.log(`[Etsy Scraper] Fetching Etsy listing URL: ${targetUrl}`);
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
      console.warn(`[Etsy Scraper] Public fetch via Axios failed: ${err.message}. Trying Puppeteer fallback...`);
      html = await fetchHtmlWithPuppeteer(targetUrl);
    }
    
    const details = parseEtsyHtml(html);
    console.log(`[Etsy Scraper] Successfully parsed raw Etsy content. Text length: ${details.text.length}, Images count: ${details.images.length}`);
    return details;
  } catch (err) {
    console.error(`[Etsy Scraper] Error scraping Etsy listing:`, err.message);
    throw new Error(`Failed to scrape Etsy listing. ${err.message}`);
  }
}

module.exports = {
  scrapeEtsyListing
};
