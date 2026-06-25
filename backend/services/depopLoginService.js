const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Apply the stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Validates whether a token string is a valid Depop token.
 * Can be a 40-char hex token or a 3-part JWT token starting with 'ey'.
 */
function isValidTokenFormat(str) {
  if (!str || typeof str !== 'string') return false;
  const val = str.startsWith('Bearer ') ? str.substring(7) : str;
  // Check 40-char hex
  if (/^[0-9a-f]{40}$/i.test(val)) return true;
  // Check JWT
  if (val.startsWith('ey') && val.includes('.') && val.split('.').length === 3) return true;
  return false;
}

/**
 * Decodes the JWT token to extract the username if present.
 */
function getUsernameFromToken(token) {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const parts = cleanToken.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payloadObj = JSON.parse(decodedPayload);
      console.log('[Depop Login Service] Decoded JWT Token payload:', payloadObj);
      if (payloadObj.username) return payloadObj.username;
      if (payloadObj.username_canonical) return payloadObj.username_canonical;
      if (payloadObj.sub) return payloadObj.sub;
    }
  } catch (e) {
    console.error('[Depop Login Service] Error decoding JWT token:', e.message);
  }
  return null;
}

/**
 * Launches a visible Puppeteer browser, navigates to the Depop login page,
 * and waits for the user to log in manually, capturing their authentication token.
 * 
 * @returns {Promise<Object>} Connection details { success: true, username, accessToken }
 */
async function loginToDepopInteractive() {
  console.log('[Depop Login Service] Starting interactive Depop login...');

  let browser = null;
  let page = null;
  try {
    const launchOptions = {
      headless: false,
      defaultViewport: null, // Human-like window sizing
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    // Use custom executable path if configured
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      console.log(`[Depop Login Service] Using custom executable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      const checkPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
      for (const p of checkPaths) {
        if (fs.existsSync(p)) {
          console.log(`[Depop Login Service] Found fallback chrome path: ${p}`);
          launchOptions.executablePath = p;
          break;
        }
      }
    }

    browser = await puppeteer.launch(launchOptions);
    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Emulate standard human viewport and user-agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let capturedToken = null;
    let isBrowserClosed = false;

    browser.on('disconnected', () => {
      isBrowserClosed = true;
    });

    // Listen to network request headers to intercept the Bearer token as soon as requests are sent
    page.on('request', req => {
      try {
        const headers = req.headers();
        const auth = headers['authorization'] || headers['Authorization'];
        if (auth && isValidTokenFormat(auth)) {
          const tokenOnly = auth.startsWith('Bearer ') ? auth.substring(7) : auth;
          if (!capturedToken) {
            capturedToken = tokenOnly;
            console.log('[Depop Login Service] Intercepted authorization header from request!');
          }
        }
      } catch (err) {
        // Ignore
      }
    });

    console.log('[Depop Login Service] Navigating to https://www.depop.com/login/');
    const response = await page.goto('https://www.depop.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Depop login page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Keep checking storage and waiting for token (maximum 3 minutes wait time)
    const maxWaitMs = 180000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (isBrowserClosed) {
        throw new Error('Login window was closed by the user.');
      }

      if (capturedToken) {
        break;
      }

      // Poll storage within page context
      const storageToken = await page.evaluate(() => {
        try {
          const isValidTokenFormat = (str) => {
            if (!str || typeof str !== 'string') return false;
            const val = str.startsWith('Bearer ') ? str.substring(7) : str;
            if (/^[0-9a-f]{40}$/i.test(val)) return true;
            if (val.startsWith('ey') && val.includes('.') && val.split('.').length === 3) return true;
            return false;
          };

          const scanStorage = (storage) => {
            if (!storage) return null;
            for (let i = 0; i < storage.length; i++) {
              const key = storage.key(i);
              if (!key) continue;
              const val = storage.getItem(key);
              if (!val || typeof val !== 'string') continue;
              
              if (isValidTokenFormat(val)) return val;
              
              const keyLower = key.toLowerCase();
              const isAuthKey = keyLower.includes('token') || 
                                keyLower.includes('auth') || 
                                keyLower.includes('access') || 
                                keyLower.includes('session') || 
                                keyLower.includes('user') || 
                                keyLower.includes('persist') ||
                                keyLower.includes('login');
                                
              if (isAuthKey && (val.startsWith('{') || val.startsWith('['))) {
                try {
                  const parsed = JSON.parse(val);
                  const searchObj = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    for (const k in obj) {
                      const v = obj[k];
                      if (typeof v === 'string') {
                        if (isValidTokenFormat(v)) return v;
                      } else if (typeof v === 'object') {
                        const found = searchObj(v);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  const found = searchObj(parsed);
                  if (found) return found;
                } catch (e) {}
              }
            }
            return null;
          };

          return scanStorage(localStorage) || scanStorage(sessionStorage);
        } catch (e) {
          return null;
        }
      }).catch(() => null);

      if (storageToken && isValidTokenFormat(storageToken)) {
        capturedToken = storageToken.startsWith('Bearer ') ? storageToken.substring(7) : storageToken;
        console.log('[Depop Login Service] Captured token from browser storage!');
        break;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    if (!capturedToken) {
      throw new Error('Interactive login timed out. Please try again.');
    }

    // Try to parse the username from the token
    let username = getUsernameFromToken(capturedToken);

    // If username couldn't be decoded from the JWT token, query the Depop api from the page context
    if (!username) {
      console.log('[Depop Login Service] Fetching username from Depop profile API using page context...');
      try {
        const apiUsername = await page.evaluate(async (token) => {
          try {
            const res = await fetch('https://webapi.depop.com/api/v1/users/me/', {
              headers: {
                'authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              return data.username || data.username_canonical;
            }
          } catch (e) {}
          return null;
        }, capturedToken);

        if (apiUsername) {
          username = apiUsername;
          console.log('[Depop Login Service] Fetched username from Depop API:', username);
        }
      } catch (err) {
        console.warn('[Depop Login Service] Error querying users/me API:', err.message);
      }
    }

    // Fallback: Scan storage keys for standard username text patterns
    if (!username) {
      username = await page.evaluate(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('user') || key.includes('session') || key.includes('persist'))) {
              const val = localStorage.getItem(key);
              if (val && val.includes('username')) {
                const match = val.match(/"username"\s*:\s*"([a-zA-Z0-9_\-]+)"/i);
                if (match && match[1]) return match[1];
              }
            }
          }
        } catch (e) {}
        return null;
      }).catch(() => null);
    }

    await browser.close();
    browser = null;

    if (!username) {
      throw new Error('Successfully captured token, but could not determine your Depop username.');
    }

    return {
      success: true,
      username: username,
      accessToken: capturedToken
    };

  } catch (error) {
    console.error('[Depop Login Service] Interactive connection error:', error.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  loginToDepopInteractive
};
