const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply the stealth plugin to avoid Cloudflare detection
puppeteer.use(StealthPlugin());

/**
 * Performs server-side login to Poshmark using Puppeteer Stealth Browser automation.
 * This launches a headless browser, types the credentials, and captures cookies/tokens
 * bypassing Cloudflare's JA3 and request header blocks.
 * 
 * @param {string} username Poshmark username or email
 * @param {string} password Poshmark account password
 * @param {string} domain Poshmark domain (e.g., poshmark.com, poshmark.ca, etc.)
 * @returns {Promise<Object>} Connection details or error object
 */
async function loginToPoshmark(username, password, domain = 'poshmark.com') {
  const cleanDomain = domain.trim().toLowerCase().replace(/^www\./i, '') || 'poshmark.com';
  console.log(`[Poshmark Login] Launching Stealth Browser for: ${username} on domain: ${cleanDomain}`);

  let browser = null;
  try {
    // Launch headless Chromium with proxy support if configured
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
      console.log(`[Poshmark Login] Setting browser proxy: ${proxyUrl}`);
      launchOptions.args.push(`--proxy-server=${proxyUrl}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Emulate human-like viewport and user-agent details
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set custom headers to look even more like a real Chrome session
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log(`[Poshmark Login] Navigating to login page: https://www.${cleanDomain}/login`);
    const response = await page.goto(`https://www.${cleanDomain}/login`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Poshmark login page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Step 1: Wait for login inputs
    console.log('[Poshmark Login] Waiting for inputs to render...');
    const usernameSelector = '#login_form_username_email, input[name="login_form[username_email]"], input[type="text"]';
    const passwordSelector = '#login_form_password, input[name="login_form[password]"], input[type="password"]';
    
    await page.waitForSelector(usernameSelector, { timeout: 15000 });
    await page.waitForSelector(passwordSelector, { timeout: 15000 });

    // Step 2: Input credentials with minor keystroke delays to simulate typing
    console.log('[Poshmark Login] Entering credentials...');
    await page.type(usernameSelector, username.trim(), { delay: 50 });
    await page.type(passwordSelector, password, { delay: 50 });

    // Step 3: Click login button
    console.log('[Poshmark Login] Clicking submit...');
    const submitButtonSelector = 'button[type="submit"], input[type="submit"]';
    await Promise.all([
      page.click(submitButtonSelector),
      // Wait for network activity to settle down after submit
      page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {})
    ]);

    // Step 4: Verify authentication by polling for session cookies
    console.log('[Poshmark Login] Verifying login success by checking session cookies...');
    let loggedIn = false;
    let finalCookies = [];

    // Check cookies every 500ms for up to 10 seconds
    for (let i = 0; i < 20; i++) {
      const cookies = await page.cookies();
      const hasSession = cookies.some(c => c.name === '_poshmark_session' || c.name === 'jwt');
      
      if (hasSession) {
        loggedIn = true;
        finalCookies = cookies;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!loggedIn) {
      // Check if page displays an error message on screen
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('Invalid username/email or password') || pageText.includes('incorrect password')) {
        throw new Error('Invalid username/email or password.');
      }
      if (pageText.includes('security challenge') || pageText.includes('CAPTCHA') || pageText.includes('bot detection')) {
        throw new Error('Security verification (CAPTCHA) required by Poshmark. Please connect using the eLister Chrome Extension instead.');
      }
      throw new Error('Authentication failed or session expired. Please verify your credentials.');
    }

    // Step 5: Format cookie string and extract CSRF token
    const cookieHeaderStr = finalCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    // Add the elister_domain tag so backendPublishService routes correctly
    const finalCookieString = `${cookieHeaderStr}; elister_domain=${cleanDomain}`;

    // Extract CSRF token from page meta or cookies
    const csrfToken = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) return meta.getAttribute('content');
      return document.body.getAttribute('data-csrf-token') || '';
    });

    const csrfCookie = finalCookies.find(c => c.name === '_csrf');
    const finalCsrfToken = csrfCookie ? csrfCookie.value : (csrfToken || '');

    console.log('[Poshmark Login] Direct cloud login successful! Cookies captured.');

    await browser.close();
    browser = null;

    return {
      success: true,
      username: username.trim(),
      sessionCookie: finalCookieString,
      csrfToken: finalCsrfToken
    };

  } catch (error) {
    console.error('[Poshmark Login] Stealth login error:', error.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    
    let userMsg = error.message;
    if (userMsg.toLowerCase().includes('timeout')) {
      userMsg = 'Connection timed out. Please check credentials or use the Chrome Extension.';
    }
    return {
      success: false,
      message: userMsg
    };
  }
}

module.exports = {
  loginToPoshmark
};
