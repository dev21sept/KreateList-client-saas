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

    // Set custom Chrome executable path if configured or present on system
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      console.log(`[Poshmark Login] Using configured executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      // Check standard Linux paths for installed system Chrome/Chromium
      const checkPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
      for (const p of checkPaths) {
        if (fs.existsSync(p)) {
          console.log(`[Poshmark Login] System Chrome fallback matched: ${p}`);
          launchOptions.executablePath = p;
          break;
        }
      }
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
      return document.body.innerText.includes('Verify Email') || 
             document.body.innerText.includes('verification code') ||
             document.body.innerText.includes('Verification Code');
    }).catch(() => false);

    if (is2FA) {
      console.log('[Poshmark Login] 2-Factor Authentication (Verify Email) detected!');
      const sessionId = `posh_2fa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Cleanup timeout after 2 minutes
      const timeoutId = setTimeout(() => {
        const sess = activeSessions.get(sessionId);
        if (sess) {
          console.log(`[Poshmark Login] 2FA Session ${sessionId} expired. Closing browser...`);
          sess.browser.close().catch(() => {});
          activeSessions.delete(sessionId);
        }
      }, 120000);

      // Store in memory map
      activeSessions.set(sessionId, {
        browser,
        page,
        username,
        cleanDomain,
        timeoutId
      });

      // Nullify browser and page so catch block doesn't close it
      browser = null;
      page = null;

      return {
        success: true,
        '2faRequired': true,
        sessionId,
        message: 'Email Verification Code (2FA) required by Poshmark. Please check your email and enter the code.'
      };
    }

    let maxSeconds = 15; // 15 seconds default

    const maxIterations = maxSeconds * 2;
    let hasNavigatedToHome = false;
    let sessionCookieWaitCount = 0;
    for (let i = 0; i < maxIterations; i++) {
      let cookies = await page.cookies();
      
      // Dynamic LocalStorage/SessionStorage extract fallback
      const extSessionVal = await page.evaluate(() => {
        try {
          const findSessionValue = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string' && obj.startsWith('v2_')) return obj;
            if (typeof obj === 'object') {
              for (const key in obj) {
                try {
                  const val = obj[key];
                  if (typeof val === 'string' && val.startsWith('v2_')) return val;
                  if (typeof val === 'object') {
                    const res = findSessionValue(val);
                    if (res) return res;
                  }
                } catch (e) {}
              }
            }
            return null;
          };
          for (let k = 0; k < localStorage.length; k++) {
            const key = localStorage.key(k);
            const valStr = localStorage.getItem(key);
            if (valStr && valStr.includes('v2_')) {
              try {
                const parsed = JSON.parse(valStr);
                const res = findSessionValue(parsed);
                if (res) return res;
              } catch (e) {
                const match = valStr.match(/(v2_[a-zA-Z0-9_\-]+)/);
                if (match) return match[1];
              }
            }
          }
          for (let k = 0; k < sessionStorage.length; k++) {
            const key = sessionStorage.key(k);
            const valStr = sessionStorage.getItem(key);
            if (valStr && valStr.includes('v2_')) {
              try {
                const parsed = JSON.parse(valStr);
                const res = findSessionValue(parsed);
                if (res) return res;
              } catch (e) {
                const match = valStr.match(/(v2_[a-zA-Z0-9_\-]+)/);
                if (match) return match[1];
              }
            }
          }
        } catch (e) {}
        return null;
      }).catch(() => null);

      if (extSessionVal && !cookies.some(c => c.name === '_poshmark_session')) {
        console.log('[Poshmark Login] Extracted _poshmark_session dynamically from LocalStorage.');
        cookies.push({
          name: '_poshmark_session',
          value: extSessionVal,
          domain: `.${cleanDomain}`,
          path: '/'
        });
      }

      const hasSessionCookie = cookies.some(c => c.name === '_poshmark_session');
      const hasJwt = cookies.some(c => c.name === 'jwt');
      
      if (hasSessionCookie) {
        if (hasJwt) {
          loggedIn = true;
          finalCookies = cookies;
          break;
        } else {
          sessionCookieWaitCount++;
          console.log(`[Poshmark Login] _poshmark_session found, waiting for jwt... (Attempt ${sessionCookieWaitCount}/8)`);
          if (sessionCookieWaitCount >= 8) {
            console.log('[Poshmark Login] jwt wait timed out. Proceeding with _poshmark_session only.');
            loggedIn = true;
            finalCookies = cookies;
            break;
          }
        }
      } else if (hasJwt) {
        console.log('[Poshmark Login] jwt found but _poshmark_session is missing. Establishing session...');
        // Try same-origin fetch to establish session cookie
        await page.evaluate(() => fetch('/').catch(() => {}));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        cookies = await page.cookies();
        if (cookies.some(c => c.name === '_poshmark_session')) {
          loggedIn = true;
          finalCookies = cookies;
          break;
        }

        if (!hasNavigatedToHome) {
          hasNavigatedToHome = true;
          console.log('[Poshmark Login] _poshmark_session still missing. Navigating to home to establish session...');
          await page.goto(`https://www.${cleanDomain}/`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          
          cookies = await page.cookies();
          if (cookies.some(c => c.name === '_poshmark_session')) {
            loggedIn = true;
            finalCookies = cookies;
            break;
          }
        }
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

    // Try to extract the actual closet username from the page or cookies
    let capturedUsername = username.trim();
    try {
      const extractedUsername = await page.evaluate(() => {
        const closetLink = document.querySelector('a[href*="/closet/"]');
        if (closetLink) {
          const href = closetLink.getAttribute('href');
          const match = href.match(/\/closet\/([^/?#\s]+)/);
          if (match && match[1]) return match[1];
        }
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/closet\/([^/?#\s]+)/);
          if (match && match[1]) return match[1];
        }
        return null;
      });

      if (extractedUsername) {
        capturedUsername = extractedUsername;
        console.log(`[Poshmark Login] Extracted actual Poshmark username: ${capturedUsername}`);
      } else {
        const usernameCookie = finalCookies.find(c => c.name === 'username' || c.name === 'user_name');
        if (usernameCookie && usernameCookie.value) {
          capturedUsername = usernameCookie.value;
          console.log(`[Poshmark Login] Extracted username from cookie: ${capturedUsername}`);
        }
      }
    } catch (extractErr) {
      console.warn('[Poshmark Login] Failed to extract actual username:', extractErr.message);
    }

    await browser.close();
    browser = null;

    return {
      success: true,
      username: capturedUsername,
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

  const { browser, page, username, cleanDomain, timeoutId } = session;
  if (timeoutId) {
    console.log(`[Poshmark Login] Clearing 2FA expiration timer for session: ${sessionId}`);
    clearTimeout(timeoutId);
  }
  console.log(`[Poshmark Login] Submitting 2FA code for user: ${username}`);

  try {
    // Wait for the modal or verification text to be visible
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Verify Email') || 
             document.body.innerText.includes('verification code') ||
             document.body.innerText.includes('Verification Code');
    }, { timeout: 10000 }).catch(() => {});

    // Try to find the visible verification input element inside the container dynamically
    let codeInputSelector = await page.evaluate(() => {
      // Find all containers containing verification keywords
      const containers = Array.from(document.querySelectorAll('div, section, form, modal'));
      const verifyContainers = containers.filter(el => {
        const text = el.innerText || '';
        return text.includes('Verify Email') || text.includes('Verification Code') || text.includes('verification code');
      });

      // Sort by size (smallest inner-most first)
      verifyContainers.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);

      for (const container of verifyContainers) {
        const inputs = Array.from(container.querySelectorAll('input'));
        const visibleInput = inputs.find(input => {
          const style = window.getComputedStyle(input);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 input.type !== 'hidden' && 
                 input.type !== 'submit' && 
                 input.type !== 'button' && 
                 input.type !== 'checkbox' && 
                 input.type !== 'radio';
        });
        if (visibleInput) {
          visibleInput.setAttribute('data-elister-otp-input', 'true');
          return 'input[data-elister-otp-input="true"]';
        }
      }

      // Fallback: Find any visible text/number/tel input on the page
      const allInputs = Array.from(document.querySelectorAll('input'));
      const visibleInput = allInputs.find(input => {
        const style = window.getComputedStyle(input);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               input.type !== 'hidden' && 
               input.type !== 'submit' && 
               input.type !== 'button' && 
               input.type !== 'checkbox' && 
               input.type !== 'radio';
      });
      if (visibleInput) {
        visibleInput.setAttribute('data-elister-otp-input', 'true');
        return 'input[data-elister-otp-input="true"]';
      }

      return null;
    });

    if (!codeInputSelector) {
      console.log('[Poshmark Login] Dynamic OTP input selection failed. Trying fallback selector...');
      codeInputSelector = 'input[placeholder="Enter Verification Code"]';
    }

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

    // Wait for page redirection/network to settle
    console.log('[Poshmark Login] Waiting for redirection and network to settle after 2FA submit...');
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});

    // Wait for session cookies
    console.log('[Poshmark Login] Waiting for session cookies after 2FA submit...');
    let loggedIn = false;
    let finalCookies = [];

    // Check cookies every 500ms for up to 30 seconds
    let hasNavigatedToHome = false;
    let sessionCookieWaitCount = 0;
    for (let i = 0; i < 60; i++) {
      let cookies = await page.cookies();
      
      // Dynamic LocalStorage/SessionStorage extract fallback
      const extSessionVal = await page.evaluate(() => {
        try {
          const findSessionValue = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string' && obj.startsWith('v2_')) return obj;
            if (typeof obj === 'object') {
              for (const key in obj) {
                try {
                  const val = obj[key];
                  if (typeof val === 'string' && val.startsWith('v2_')) return val;
                  if (typeof val === 'object') {
                    const res = findSessionValue(val);
                    if (res) return res;
                  }
                } catch (e) {}
              }
            }
            return null;
          };
          for (let k = 0; k < localStorage.length; k++) {
            const key = localStorage.key(k);
            const valStr = localStorage.getItem(key);
            if (valStr && valStr.includes('v2_')) {
              try {
                const parsed = JSON.parse(valStr);
                const res = findSessionValue(parsed);
                if (res) return res;
              } catch (e) {
                const match = valStr.match(/(v2_[a-zA-Z0-9_\-]+)/);
                if (match) return match[1];
              }
            }
          }
          for (let k = 0; k < sessionStorage.length; k++) {
            const key = sessionStorage.key(k);
            const valStr = sessionStorage.getItem(key);
            if (valStr && valStr.includes('v2_')) {
              try {
                const parsed = JSON.parse(valStr);
                const res = findSessionValue(parsed);
                if (res) return res;
              } catch (e) {
                const match = valStr.match(/(v2_[a-zA-Z0-9_\-]+)/);
                if (match) return match[1];
              }
            }
          }
        } catch (e) {}
        return null;
      }).catch(() => null);

      if (extSessionVal && !cookies.some(c => c.name === '_poshmark_session')) {
        console.log('[Poshmark Login] Extracted _poshmark_session dynamically after 2FA.');
        cookies.push({
          name: '_poshmark_session',
          value: extSessionVal,
          domain: `.${cleanDomain}`,
          path: '/'
        });
      }

      const hasSessionCookie = cookies.some(c => c.name === '_poshmark_session');
      const hasJwt = cookies.some(c => c.name === 'jwt');
      
      if (hasSessionCookie) {
        if (hasJwt) {
          loggedIn = true;
          finalCookies = cookies;
          break;
        } else {
          sessionCookieWaitCount++;
          console.log(`[Poshmark Login] _poshmark_session found after 2FA, waiting for jwt... (Attempt ${sessionCookieWaitCount}/8)`);
          if (sessionCookieWaitCount >= 8) {
            console.log('[Poshmark Login] jwt wait timed out after 2FA. Proceeding with _poshmark_session only.');
            try {
              const uploadsDir = path.join(__dirname, '..', 'uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              await page.screenshot({ path: path.join(uploadsDir, 'jwt_timeout_debug.png') });
              console.log('[Poshmark Login] Saved jwt_timeout_debug.png for investigation.');
            } catch (e) {
              console.error('[Poshmark Login] Failed to save screenshot:', e.message);
            }
            loggedIn = true;
            finalCookies = cookies;
            break;
          }
        }
      } else if (hasJwt) {
        console.log('[Poshmark Login] jwt found after 2FA but _poshmark_session is missing. Establishing session...');
        // Try same-origin fetch to establish session cookie
        await page.evaluate(() => fetch('/').catch(() => {}));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        cookies = await page.cookies();
        if (cookies.some(c => c.name === '_poshmark_session')) {
          loggedIn = true;
          finalCookies = cookies;
          break;
        }

        if (!hasNavigatedToHome) {
          hasNavigatedToHome = true;
          console.log('[Poshmark Login] _poshmark_session still missing after 2FA. Navigating to home to establish session...');
          await page.goto(`https://www.${cleanDomain}/`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          
          cookies = await page.cookies();
          if (cookies.some(c => c.name === '_poshmark_session')) {
            loggedIn = true;
            finalCookies = cookies;
            break;
          }
        }
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

    // Try to extract the actual closet username from the page or cookies
    let capturedUsername = username.trim();
    try {
      const extractedUsername = await page.evaluate(() => {
        const closetLink = document.querySelector('a[href*="/closet/"]');
        if (closetLink) {
          const href = closetLink.getAttribute('href');
          const match = href.match(/\/closet\/([^/?#\s]+)/);
          if (match && match[1]) return match[1];
        }
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/closet\/([^/?#\s]+)/);
          if (match && match[1]) return match[1];
        }
        return null;
      });

      if (extractedUsername) {
        capturedUsername = extractedUsername;
        console.log(`[Poshmark Login] Extracted actual Poshmark username after 2FA: ${capturedUsername}`);
      } else {
        const usernameCookie = finalCookies.find(c => c.name === 'username' || c.name === 'user_name');
        if (usernameCookie && usernameCookie.value) {
          capturedUsername = usernameCookie.value;
          console.log(`[Poshmark Login] Extracted username from cookie after 2FA: ${capturedUsername}`);
        }
      }
    } catch (extractErr) {
      console.warn('[Poshmark Login] Failed to extract actual username after 2FA:', extractErr.message);
    }

    // Clean up
    await browser.close().catch(() => {});
    activeSessions.delete(sessionId);

    return {
      success: true,
      username: capturedUsername,
      sessionCookie: finalCookieString,
      csrfToken: finalCsrfToken
    };

  } catch (error) {
    console.error('[Poshmark Login] 2FA verification error:', error.message);
    
    if (browser && page) {
      try {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const screenshotPath = path.join(uploadsDir, '2fa_error.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`[Poshmark Login] Saved 2FA error screenshot to: ${screenshotPath}`);
        
        const pageTitle = await page.title().catch(() => 'Unknown');
        console.log(`[Poshmark Login] 2FA Error Page Title: ${pageTitle}`);
        
        const pageHtml = await page.content().catch(() => '');
        fs.writeFileSync(path.join(uploadsDir, '2fa_error.html'), pageHtml);
        console.log(`[Poshmark Login] Saved 2FA error HTML to: ${path.join(uploadsDir, '2fa_error.html')}`);
      } catch (err) {
        console.error('[Poshmark Login] Failed to take 2FA error screenshot:', err.message);
      }
    }

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
