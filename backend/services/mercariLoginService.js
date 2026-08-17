const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');

// Global map to hold active Mercari login sessions in memory
const activeSessions = new Map();

// Apply the stealth plugin to avoid Cloudflare detection
puppeteer.use(StealthPlugin());

// Helper to capture screenshot as base64
async function captureScreenshot(page) {
  try {
    if (page && !page.isClosed()) {
      return await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 30 });
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Performs server-side login to Mercari using Puppeteer Stealth Browser automation.
 */
async function loginToMercari(username, password, sessionId, userId) {
  console.log(`[Mercari Login] Launching Stealth Browser for: ${username} (Session: ${sessionId})`);

  const sessionState = {
    status: 'initializing',
    message: 'Launching stealth browser...',
    latestScreenshot: null,
    '2faRequired': false,
    browser: null,
    page: null,
    username,
    createdAt: Date.now()
  };
  activeSessions.set(sessionId, sessionState);

  let browser = null;
  let page = null;
  let intervalId = null;

  try {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`[Mercari Login] Running browser in headless: ${isHeadless}`);

    const launchOptions = {
      headless: isHeadless,
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
    sessionState.browser = browser;

    page = await browser.newPage();
    sessionState.page = page;

    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1024, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Start capturing screenshots periodically
    intervalId = setInterval(async () => {
      const frame = await captureScreenshot(page);
      if (frame) sessionState.latestScreenshot = frame;
    }, 800);

    sessionState.status = 'navigating';
    sessionState.message = 'Loading Mercari login page...';

    const response = await page.goto('https://www.mercari.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Mercari login page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Capture screenshot after navigation
    sessionState.latestScreenshot = await captureScreenshot(page);

    // Enter credentials
    sessionState.status = 'typing_credentials';
    sessionState.message = 'Typing email and password...';
    
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await page.type('input[type="email"], input[name="email"]', username, { delay: 50 });
    sessionState.latestScreenshot = await captureScreenshot(page);

    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 15000 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 50 });
    sessionState.latestScreenshot = await captureScreenshot(page);

    // Submit form
    sessionState.status = 'submitting';
    sessionState.message = 'Submitting login credentials...';
    
    const submitBtn = await page.$('button[type="submit"], button[data-testid="login-submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait and check if OTP/2FA or Successful login happens
    await new Promise(resolve => setTimeout(resolve, 5000));
    sessionState.latestScreenshot = await captureScreenshot(page);

    const currentUrl = page.url();
    console.log('[Mercari Login] Navigation state URL:', currentUrl);

    // Check if 2FA code is requested
    const is2faPresent = await page.evaluate(() => {
      const selector = 'input[name="code"], input[name="otp"], input[data-testid="otp-input"], input[placeholder*="code" i]';
      return !!document.querySelector(selector);
    });

    if (is2faPresent) {
      console.log(`[Mercari Login] 2FA required for session: ${sessionId}`);
      
      if (intervalId) clearInterval(intervalId);
      sessionState.status = '2fa_required';
      sessionState.message = 'Verification code required. Please check your email or phone.';
      sessionState['2faRequired'] = true;

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
        message: 'Verification code required.'
      };
    }

    // Check if successful login (cookies present)
    const cookies = await page.cookies();
    const sidCookie = cookies.find(c => c.name === 'sid' || c.name === 'session' || c.name === '_mercari_session' || c.name === 'user_id');
    
    if (sidCookie) {
      const sessionCookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      console.log('[Mercari Login] Login successful directly!');

      let profileUsername = username;
      try {
        sessionState.status = 'fetching_profile';
        sessionState.message = 'Retrieving profile information...';
        await page.goto('https://www.mercari.com/mypage/', { waitUntil: 'networkidle2', timeout: 30000 });
        const scrapedName = await page.evaluate(() => {
          const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i]');
          return nameEl ? nameEl.textContent.trim() : '';
        });
        if (scrapedName) profileUsername = scrapedName;
      } catch (e) {
        console.warn('[Mercari Login] Failed to scrape username:', e.message);
      }
      
      // Save credentials to User document
      try {
        const user = await User.findById(userId);
        if (user) {
          user.mercariAccount = {
            connected: true,
            username: profileUsername,
            userId: '',
            sessionCookie: sessionCookieStr,
            accessToken: sidCookie.value,
            connectedAt: new Date()
          };
          await user.save();
          console.log(`[Mercari Login] Saved Mercari connection for user: ${userId}`);
        }
      } catch (dbErr) {
        console.error('[Mercari Login] Database save error:', dbErr.message);
      }

      if (intervalId) clearInterval(intervalId);
      sessionState.status = 'completed';
      sessionState.message = 'Login successful!';
      await browser.close();
      activeSessions.delete(sessionId);

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
    if (intervalId) clearInterval(intervalId);
    sessionState.status = 'failed';
    sessionState.message = err.message;
    if (browser) {
      await browser.close().catch(() => {});
    }
    activeSessions.delete(sessionId);
    return {
      success: false,
      message: err.message
    };
  }
}

/**
 * Submits the 2FA code to complete Mercari login process.
 */
async function verifyMercari2FA(sessionId, code, userId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session has expired or does not exist. Please restart login.');
  }

  const { browser, page, username } = session;
  console.log(`[Mercari 2FA] Verifying code for session: ${sessionId}`);

  let intervalId = null;
  try {
    session.status = 'submitting_2fa';
    session.message = 'Verifying security code...';

    // Start capturing screenshots periodically again
    intervalId = setInterval(async () => {
      const frame = await captureScreenshot(page);
      if (frame) session.latestScreenshot = frame;
    }, 800);

    const inputSelector = 'input[name="code"], input[name="otp"], input[data-testid="otp-input"], input[placeholder*="code" i]';
    await page.waitForSelector(inputSelector, { timeout: 15500 });
    
    // Focus and type using native keyboard events so React triggers updates
    await page.focus(inputSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(code.trim(), { delay: 100 });

    // Wait a brief moment for React state to latch
    await new Promise(resolve => setTimeout(resolve, 800));

    // Capture screenshot after typing
    session.latestScreenshot = await captureScreenshot(page);

    // Submit the form by clicking the verify button inside page.evaluate
    const submitted = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const verifyBtn = buttons.find(b => 
        b.type === 'submit' || 
        b.textContent.toLowerCase().includes('verify')
      );
      if (verifyBtn) {
        verifyBtn.click();
        return true;
      }
      return false;
    });

    if (!submitted) {
      console.log('[Mercari 2FA] Verify button not found by content, pressing Enter key as fallback');
      await page.keyboard.press('Enter');
    }

    await new Promise(resolve => setTimeout(resolve, 7000));
    session.latestScreenshot = await captureScreenshot(page);

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
    console.log('[Mercari 2FA] Verification successful!');

    let profileUsername = username;
    try {
      session.status = 'fetching_profile';
      session.message = 'Retrieving profile details...';
      await page.goto('https://www.mercari.com/mypage/', { waitUntil: 'networkidle2', timeout: 30000 });
      const scrapedName = await page.evaluate(() => {
        const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i]');
        return nameEl ? nameEl.textContent.trim() : '';
      });
      if (scrapedName) profileUsername = scrapedName;
    } catch (e) {
      console.warn('[Mercari 2FA] Failed to scrape username:', e.message);
    }

    // Save credentials to User document
    try {
      const user = await User.findById(userId);
      if (user) {
        user.mercariAccount = {
          connected: true,
          username: profileUsername,
          userId: '',
          sessionCookie: sessionCookieStr,
          accessToken: sidCookie.value,
          connectedAt: new Date()
        };
        await user.save();
        console.log(`[Mercari 2FA] Saved Mercari connection for user: ${userId}`);
      }
    } catch (dbErr) {
      console.error('[Mercari 2FA] Database save error:', dbErr.message);
    }

    if (intervalId) clearInterval(intervalId);
    session.status = 'completed';
    session.message = 'Verification successful!';
    await browser.close();
    activeSessions.delete(sessionId);

    return {
      success: true,
      username: profileUsername,
      sessionCookie: sessionCookieStr,
      accessToken: sidCookie.value
    };

  } catch (err) {
    console.error('[Mercari 2FA] Verification error:', err.message);
    if (intervalId) clearInterval(intervalId);
    session.status = '2fa_required'; // Reset status to 2fa required
    session.message = err.message;
    return {
      success: false,
      message: err.message
    };
  }
}

// Function to retrieve current session state for streaming
function getSessionState(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  return {
    status: session.status,
    message: session.message,
    latestScreenshot: session.latestScreenshot,
    '2faRequired': session['2faRequired']
  };
}

module.exports = {
  loginToMercari,
  verifyMercari2FA,
  getSessionState,
  activeSessions
};
