const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Global map to hold active 2FA login sessions in memory
const activeSessions = new Map();

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
  let page = null;
  try {
    // Launch headless Chromium with proxy support if configured
    const isProd = process.env.NODE_ENV === 'production' || process.env.HTTP_PROXY_URL;
    const launchOptions = {
      headless: isProd ? true : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    };

    if (!isProd) {
      console.log('[Poshmark Login] Running in non-headless mode locally to allow manual 2FA entry.');
    }

    const proxyUrl = process.env.HTTP_PROXY_URL;
    if (proxyUrl) {
      console.log(`[Poshmark Login] Setting browser proxy: ${proxyUrl}`);
      launchOptions.args.push(`--proxy-server=${proxyUrl}`);
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();

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
    const usernameSelector = '#login_form_username_email, input[name="login_form[username_email]"]';
    const passwordSelector = '#login_form_password, input[name="login_form[password]"]';
    
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

    // Check if 2FA code is requested on the page
    const is2FA = await page.evaluate(() => {
      return !!document.querySelector('input[placeholder="Enter Verification Code"]') || 
             document.body.innerText.includes('Verify Email') || 
             document.body.innerText.includes('verification code');
    }).catch(() => false);

    if (is2FA) {
      console.log('[Poshmark Login] 2-Factor Authentication (Verify Email) detected!');
      const sessionId = `posh_2fa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Store in memory map
      activeSessions.set(sessionId, {
        browser,
        page,
        username,
        cleanDomain
      });

      // Cleanup timeout after 2 minutes
      setTimeout(() => {
        const sess = activeSessions.get(sessionId);
        if (sess) {
          console.log(`[Poshmark Login] 2FA Session ${sessionId} expired. Closing browser...`);
          sess.browser.close().catch(() => {});
          activeSessions.delete(sessionId);
        }
      }, 120000);

      // Nullify browser and page so catch block doesn't close it
      browser = null;
      page = null;

      return {
        success: true,
        2faRequired: true,
        sessionId,
        message: 'Email Verification Code (2FA) required by Poshmark. Please check your email and enter the code.'
      };
    }

    let maxSeconds = 15; // 15 seconds default

    const maxIterations = maxSeconds * 2;
    for (let i = 0; i < maxIterations; i++) {
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
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (pageText.includes('Invalid username/email or password') || pageText.includes('incorrect password')) {
        throw new Error('Invalid username/email or password.');
      }
      if (pageText.includes('security challenge') || pageText.includes('CAPTCHA') || pageText.includes('bot detection')) {
        throw new Error('Security verification (CAPTCHA) required by Poshmark. Please connect using the eLister Chrome Extension instead.');
      }
      if (is2FA) {
        if (isProd) {
          throw new Error('Email Verification Code (2FA) required by Poshmark. Please connect using the eLister Chrome Extension instead.');
        } else {
          throw new Error('Verification code timed out. Please try again.');
        }
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
    if (browser && page) {
      try {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const screenshotPath = path.join(uploadsDir, 'login_error.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`[Poshmark Login] Saved error screenshot to: ${screenshotPath}`);
        
        const pageTitle = await page.title().catch(() => 'Unknown');
        console.log(`[Poshmark Login] Error Page Title: ${pageTitle}`);
        
        const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '');
        console.log(`[Poshmark Login] Error Page Text Preview:\n${pageText}`);
      } catch (err) {
        console.error('[Poshmark Login] Failed to take error screenshot:', err.message);
      }
    }
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

/**
 * Submits the 2FA verification code to the active Puppeteer page session.
 * Exchanged for session cookies once verification succeeds.
 */
async function verify2FA(sessionId, code) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Verification session expired or invalid. Please try again.');
  }

  const { browser, page, username, cleanDomain } = session;
  console.log(`[Poshmark Login] Submitting 2FA code for user: ${username}`);

  try {
    const codeInputSelector = 'input[placeholder="Enter Verification Code"]';
    await page.waitForSelector(codeInputSelector, { timeout: 15000 });
    
    // Clear the input first
    await page.click(codeInputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    
    // Type code
    await page.type(codeInputSelector, code.trim(), { delay: 50 });

    // Click the Done submit button
    console.log('[Poshmark Login] Clicking Done button inside 2FA modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const doneBtn = buttons.find(b => b.innerText.trim() === 'Done');
      if (doneBtn) {
        doneBtn.click();
      } else {
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    });

    // Wait for session cookies
    console.log('[Poshmark Login] Waiting for session cookies after 2FA submit...');
    let loggedIn = false;
    let finalCookies = [];

    // Check cookies every 500ms for up to 30 seconds
    for (let i = 0; i < 60; i++) {
      const cookies = await page.cookies();
      const hasSession = cookies.some(c => c.name === '_poshmark_session' || c.name === 'jwt');
      
      if (hasSession) {
        loggedIn = true;
        finalCookies = cookies;
        break;
      }
      
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (pageText.includes('invalid verification code') || pageText.includes('incorrect code')) {
        throw new Error('Invalid verification code entered. Please check your email and try again.');
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!loggedIn) {
      throw new Error('Verification timed out or failed. Please request a new code.');
    }

    // Format cookie string and extract CSRF token
    const cookieHeaderStr = finalCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    const finalCookieString = `${cookieHeaderStr}; elister_domain=${cleanDomain}`;

    const csrfToken = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) return meta.getAttribute('content');
      return document.body.getAttribute('data-csrf-token') || '';
    });

    const csrfCookie = finalCookies.find(c => c.name === '_csrf');
    const finalCsrfToken = csrfCookie ? csrfCookie.value : (csrfToken || '');

    console.log('[Poshmark Login] 2FA Verification successful! Cookies captured.');

    // Clean up
    await browser.close().catch(() => {});
    activeSessions.delete(sessionId);

    return {
      success: true,
      username: username,
      sessionCookie: finalCookieString,
      csrfToken: finalCsrfToken
    };

  } catch (error) {
    console.error('[Poshmark Login] 2FA verification error:', error.message);
    
    // Close browser on timeout or generic errors, keep open on "invalid code" so they can retry
    if (error.message.includes('expired') || error.message.includes('timed out') || error.message.includes('timed')) {
      await browser.close().catch(() => {});
      activeSessions.delete(sessionId);
    }
    throw error;
  }
}

module.exports = {
  loginToPoshmark,
  verify2FA
};
