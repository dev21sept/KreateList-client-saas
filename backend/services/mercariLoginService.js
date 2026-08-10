const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Global map to hold active Mercari login sessions in memory for 2FA verification
const activeSessions = new Map();

// Apply the stealth plugin to avoid Cloudflare detection
puppeteer.use(StealthPlugin());

/**
 * Performs server-side login to Mercari using Puppeteer Stealth Browser automation.
 * 
 * @param {string} username Mercari email or username
 * @param {string} password Mercari account password
 * @returns {Promise<Object>} Connection details or OTP request state
 */
async function loginToMercari(username, password) {
  console.log(`[Mercari Login] Launching Stealth Browser for: ${username}`);

  let browser = null;
  let page = null;
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
    let proxyAuth = null;
    if (proxyUrl) {
      console.log(`[Mercari Login] Setting browser proxy: ${proxyUrl}`);
      try {
        const parsedUrl = new URL(proxyUrl);
        const cleanProxyUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        launchOptions.args.push(`--proxy-server=${cleanProxyUrl}`);
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
    page = await browser.newPage();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log('[Mercari Login] Navigating to Mercari login...');
    const response = await page.goto('https://www.mercari.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Mercari login page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Enter credentials
    console.log('[Mercari Login] Typing email and password...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await page.type('input[type="email"], input[name="email"]', username, { delay: 50 });

    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 15000 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 50 });

    // Submit form
    console.log('[Mercari Login] Clicking signin button...');
    const submitBtn = await page.$('button[type="submit"], button[data-testid="login-submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait and check if OTP/2FA or Successful login happens
    await new Promise(resolve => setTimeout(resolve, 5000));

    const currentUrl = page.url();
    console.log('[Mercari Login] Navigation state URL:', currentUrl);

    // Check if 2FA code is requested
    const is2faPresent = await page.evaluate(() => {
      // Find input fields for code, otp, or verify
      const selector = 'input[name="code"], input[name="otp"], input[data-testid="otp-input"], input[placeholder*="code" i]';
      return !!document.querySelector(selector);
    });

    if (is2faPresent) {
      const sessionId = 'mercari_' + Math.random().toString(36).substring(2, 15);
      console.log(`[Mercari Login] 2FA required. Saving session ID: ${sessionId}`);
      
      // Save Puppeteer session state to verify later
      activeSessions.set(sessionId, {
        browser,
        page,
        username,
        createdAt: Date.now()
      });

      // Cleanup session after 10 minutes timeout
      setTimeout(() => {
        if (activeSessions.has(sessionId)) {
          console.log(`[Mercari Login] Cleaning up expired session: ${sessionId}`);
          const sess = activeSessions.get(sessionId);
          sess.browser.close().catch(() => {});
          activeSessions.delete(sessionId);
        }
      }, 10 * 60 * 1000);

      return {
        success: true,
        '2faRequired': true,
        sessionId,
        message: 'Verification code sent by Mercari. Please check your email or phone.'
      };
    }

    // Check if successful login (cookies present)
    const cookies = await page.cookies();
    const sidCookie = cookies.find(c => c.name === 'sid' || c.name === 'session' || c.name === '_mercari_session' || c.name === 'user_id');
    
    if (sidCookie) {
      const sessionCookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      console.log('[Mercari Login] Login successful directly!');

      // Navigate to My Page and scrape the real profile username in active session
      let profileUsername = username;
      try {
        console.log('[Mercari Login] Navigating to My Page to scrape profile details in active session...');
        await page.goto('https://www.mercari.com/mypage/', { waitUntil: 'networkidle2', timeout: 30000 });
        const scrapedName = await page.evaluate(() => {
          const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i], h1[class*="Name"], [class*="name" i] h1');
          return nameEl ? nameEl.textContent.trim() : '';
        });
        if (scrapedName) {
          profileUsername = scrapedName;
          console.log('[Mercari Login] Scraped profile username:', profileUsername);
        }
      } catch (e) {
        console.warn('[Mercari Login] Failed to scrape username in active session:', e.message);
      }
      
      await browser.close();
      return {
        success: true,
        '2faRequired': false,
        username: profileUsername,
        sessionCookie: sessionCookieStr,
        accessToken: sidCookie.value
      };
    }

    // Check error message
    const errorText = await page.evaluate(() => {
      const errEl = document.querySelector('[class*="error" i], [class*="alert" i]');
      return errEl ? errEl.textContent.trim() : null;
    });

    throw new Error(errorText || 'Authentication failed. Please check your credentials or try again.');

  } catch (err) {
    console.error('[Mercari Login] Automation error:', err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      message: err.message
    };
  }
}

/**
 * Submits the 2FA code to complete Mercari login process.
 * 
 * @param {string} sessionId Unique session reference key
 * @param {string} code OTP validation code
 * @returns {Promise<Object>} Connection details or error object
 */
async function verifyMercari2FA(sessionId, code) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session has expired or does not exist. Please restart login.');
  }

  const { browser, page, username } = session;
  console.log(`[Mercari 2FA] Verifying code for session: ${sessionId}`);

  try {
    const inputSelector = 'input[name="code"], input[name="otp"], input[data-testid="otp-input"], input[placeholder*="code" i]';
    await page.waitForSelector(inputSelector, { timeout: 10000 });
    
    // Clear and type code
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, inputSelector);
    await page.type(inputSelector, code.trim(), { delay: 50 });

    // Click submit
    console.log('[Mercari 2FA] Clicking verification submit button...');
    const submitBtn = await page.$('button[type="submit"], button[class*="verify" i]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await new Promise(resolve => setTimeout(resolve, 7000));

    const cookies = await page.cookies();
    const sidCookie = cookies.find(c => c.name === 'sid' || c.name === 'session' || c.name === '_mercari_session' || c.name === 'user_id');
    
    if (!sidCookie) {
      const errorText = await page.evaluate(() => {
        const errEl = document.querySelector('[class*="error" i], [class*="alert" i]');
        return errEl ? errEl.textContent.trim() : null;
      });
      throw new Error(errorText || 'Verification failed. The code may be incorrect or expired.');
    }

    const sessionCookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log('[Mercari 2FA] Verification successful! Credentials saved.');

    // Navigate to My Page and scrape the real profile username in active session
    let profileUsername = username;
    try {
      console.log('[Mercari 2FA] Navigating to My Page to scrape profile details in active session...');
      await page.goto('https://www.mercari.com/mypage/', { waitUntil: 'networkidle2', timeout: 30000 });
      const scrapedName = await page.evaluate(() => {
        const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i], h1[class*="Name"], [class*="name" i] h1');
        return nameEl ? nameEl.textContent.trim() : '';
      });
      if (scrapedName) {
        profileUsername = scrapedName;
        console.log('[Mercari 2FA] Scraped profile username:', profileUsername);
      }
    } catch (e) {
      console.warn('[Mercari 2FA] Failed to scrape username in active session:', e.message);
    }

    // Cleanup session map
    activeSessions.delete(sessionId);
    await browser.close();

    return {
      success: true,
      username: profileUsername,
      sessionCookie: sessionCookieStr,
      accessToken: sidCookie.value
    };

  } catch (err) {
    console.error('[Mercari 2FA] Verification error:', err.message);
    // Keep browser session alive in case they input wrong code and want to retry
    return {
      success: false,
      message: err.message
    };
  }
}

module.exports = {
  loginToMercari,
  verifyMercari2FA
};
