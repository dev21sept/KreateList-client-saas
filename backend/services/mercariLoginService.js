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
    userId,
    createdAt: Date.now()
  };
  activeSessions.set(sessionId, sessionState);

  let browser = null;
  let page = null;
  let intervalId = null;

  try {
    const launchOptions = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800'
      ],
      env: {
        ...process.env,
        DISPLAY: process.env.VIRTUAL_DISPLAY || ':99'
      }
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

    // Note: Do not force an empty userDataDir on initial login, as fresh empty dirs cause Mercari to flag unknown device.
    // Cookies and session are saved in MongoDB and synced across sessions.

    browser = await puppeteer.launch(launchOptions);
    sessionState.browser = browser;

    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();
    sessionState.page = page;

    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    await page.setViewport({ width: 1280, height: 800 });

    // Start capturing screenshots periodically
    intervalId = setInterval(async () => {
      const frame = await captureScreenshot(page);
      if (frame) sessionState.latestScreenshot = frame;
    }, 800);

    sessionState.status = 'navigating';
    sessionState.message = 'Loading Mercari login page...';

    // Navigate directly to login page
    const response = await page.goto('https://www.mercari.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Mercari login page. HTTP status: ${response ? response.status() : 'No Response'}`);
    }

    // Dismiss cookie consent if present to prevent it from overlaying elements
    try {
      await page.waitForSelector('#truste-consent-button', { timeout: 3500 });
      await page.click('#truste-consent-button');
      console.log('[Mercari Login] Accepted truste cookie consent.');
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      // Ignore if not present
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

    // Check if 2FA code is requested (either OTP input rendered or text indicates code sent)
    const is2faPresent = await page.evaluate(() => {
      const selector = 'input[name="code"], input[name="otp"], input[data-testid="otp-input"], input[placeholder*="code" i]';
      return !!document.querySelector(selector) || 
             document.body.innerText.includes('Verification code') || 
             document.body.innerText.includes('verification code') || 
             document.body.innerText.includes('Verify your login');
    });

    if (is2faPresent) {
      console.log(`[Mercari Login] 2FA required for session: ${sessionId}`);
      
      if (intervalId) clearInterval(intervalId);
      sessionState.status = '2fa_required';
      sessionState['2faRequired'] = true;
      sessionState.latestScreenshot = await captureScreenshot(page);

      // Check available verification options on the screen (SMS, Voice Call, Email/Resend)
      const optionsInfo = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const buttonsAndLinks = Array.from(document.querySelectorAll('button, a')).map(el => el.textContent.trim().toLowerCase());
        
        let destination = '';
        const matchEmail = text.match(/[\w*.]+@[\w*.]+/);
        if (matchEmail) destination = matchEmail[0];
        const matchPhone = text.match(/\(\*{3}\)\s*\*{3}-\d{4}/);
        if (matchPhone) destination = matchPhone[0];

        const isEmailMode = !!destination.includes('@');
        const hasEmail = buttonsAndLinks.some(t => t.includes('resend') || t.includes('email'));
        const hasSms = buttonsAndLinks.some(t => t.includes('send code') || t.includes('sms') || t.includes('text'));
        const hasCall = buttonsAndLinks.some(t => t.includes('call me') || t.includes('call'));

        return {
          hasSms,
          hasCall,
          hasEmail,
          isEmailMode,
          destination: destination || (isEmailMode ? 'Email' : 'Phone')
        };
      });

      sessionState.verificationOptions = optionsInfo;
      sessionState.message = optionsInfo.destination 
        ? `Verification code sent to ${optionsInfo.destination}. Please enter code below.` 
        : 'Verification code required. Please check your email or phone.';

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
        verificationOptions: optionsInfo,
        message: sessionState.message
      };
    }

    // Check if successful direct login (must have navigated away from login and have auth cookie)
    const cookies = await page.cookies();
    const sidCookie = cookies.find(c => 
      c.name === 'sid' || 
      c.name === 'user_id' || 
      c.name === 'auth_token' || 
      c.name === '_mwus' || 
      c.name === 'mercarius_session'
    );
    const hasNavigatedAway = !currentUrl.includes('/login') && !currentUrl.includes('/signin') && !currentUrl.includes('/signup');
    
    if ((sidCookie || cookies.length > 5) && hasNavigatedAway) {
      const sessionCookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const accessTokenVal = (sidCookie && sidCookie.value) || 
        (cookies.find(c => c.name === '_mwus' || c.name === 'mercarius_session')?.value) || 
        'authenticated';
      console.log('[Mercari Login] Authenticated login successful directly without 2FA!');

      let profileUsername = username;
      try {
        sessionState.status = 'fetching_profile';
        sessionState.message = 'Retrieving profile information...';
        await page.goto('https://www.mercari.com/mypage/profile/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('input[name="displayName"], input[placeholder*="display name" i], input[placeholder*="username" i]', { timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        
        const scrapedName = await page.evaluate(() => {
          const nameInput = document.querySelector('input[name="displayName"], input[name="name"], input[placeholder*="display name" i], input[placeholder*="username" i]');
          if (nameInput && nameInput.value && nameInput.value.trim()) return nameInput.value.trim();
          const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i]');
          return nameEl ? nameEl.textContent.trim() : '';
        });
        if (scrapedName && !scrapedName.includes('@')) profileUsername = scrapedName;
      } catch (e) {
        console.warn('[Mercari Login] Failed to scrape username:', e.message);
      }
      
      // Extract real Mercari User ID from _mwus cookie
      let mercariUserId = '';
      const mwusCookie = cookies.find(c => c.name === '_mwus');
      if (mwusCookie && mwusCookie.value) {
        try {
          const decoded = JSON.parse(Buffer.from(mwusCookie.value, 'base64').toString('utf8'));
          if (decoded.userId) mercariUserId = String(decoded.userId);
        } catch (e) {}
      }

      // Save credentials to User document
      const targetUserId = userId || sessionState.userId;
      if (targetUserId) {
        try {
          const user = await User.findById(targetUserId);
          if (user) {
            user.mercariAccount = {
              connected: true,
              username: profileUsername,
              userId: mercariUserId,
              sessionCookie: sessionCookieStr,
              accessToken: accessTokenVal,
              connectedAt: new Date()
            };
            await user.save();
            console.log(`[Mercari Login] Saved Mercari connection for user: ${targetUserId} (Mercari Username: ${profileUsername}, ID: ${mercariUserId})`);
          }
        } catch (dbErr) {
          console.error('[Mercari Login] Database save error:', dbErr.message);
        }
      }

      if (intervalId) clearInterval(intervalId);
      sessionState.status = 'completed';
      sessionState.message = 'Login successful!';
      
      setTimeout(async () => {
        try {
          await browser.close();
        } catch (e) {}
        activeSessions.delete(sessionId);
      }, 3000);

      return {
        success: true,
        '2faRequired': false,
        username: profileUsername,
        sessionCookie: sessionCookieStr,
        accessToken: accessTokenVal
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

    // Dismiss cookie consent if present to prevent it from overlaying elements
    try {
      const consentBtn = await page.$('#truste-consent-button');
      if (consentBtn) {
        await consentBtn.click();
        console.log('[Mercari 2FA] Accepted truste cookie consent.');
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      // Ignore if not present
    }
    
    // Set OTP value using React nativeInputValueSetter and trigger synthetic events
    console.log(`[Mercari 2FA] Injecting code into React input: ${code.trim()}`);
    await page.evaluate((selector, val) => {
      const input = document.querySelector(selector);
      if (input) {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, inputSelector, code.trim());

    // Also simulate keyboard events as secondary trigger
    try {
      await page.focus(inputSelector);
      await page.keyboard.press('ArrowRight');
    } catch (e) {}

    // Wait for React state to update and button to become enabled
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => {
        const text = b.textContent.toLowerCase();
        return text.includes('verify') || (b.type === 'submit' && !text.includes('log in'));
      });
      return btn && !btn.disabled;
    }, { timeout: 4000 }).catch(() => {
      console.warn('[Mercari 2FA] Timeout waiting for button to enable, proceeding anyway...');
    });

    // Capture screenshot after typing
    session.latestScreenshot = await captureScreenshot(page);

    // Submit the form by clicking the enabled verify button
    let submitted = false;
    try {
      const verifyBtnHandle = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => {
          const isVisible = b.offsetParent !== null;
          const text = b.textContent.toLowerCase();
          return isVisible && (text.includes('verify') || (b.type === 'submit' && !text.includes('log in')));
        });
      });

      if (verifyBtnHandle && verifyBtnHandle.asElement()) {
        await verifyBtnHandle.asElement().click();
        submitted = true;
        console.log('[Mercari 2FA] Clicked Verify button natively.');
      }
    } catch (clickErr) {
      console.warn('[Mercari 2FA] Native click failed:', clickErr.message);
    }

    if (!submitted) {
      // Fallback to JS DOM click in page.evaluate
      submitted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const verifyBtn = buttons.find(b => {
          const isVisible = b.offsetParent !== null;
          const text = b.textContent.toLowerCase();
          return isVisible && (text.includes('verify') || (b.type === 'submit' && !text.includes('log in')));
        });
        if (verifyBtn) {
          verifyBtn.click();
          return true;
        }
        return false;
      });
    }

    // Always press Enter key on input as final submission trigger
    try {
      await page.focus(inputSelector);
      await page.keyboard.press('Enter');
    } catch (e) {}

    // Dynamic verification polling loop up to 30 seconds
    let sidCookie = null;
    let finalCookies = [];
    const maxWaitSeconds = 30;
    
    console.log(`[Mercari 2FA] Submitted OTP. Polling for session cookies (up to ${maxWaitSeconds}s)...`);
    
    for (let i = 1; i <= maxWaitSeconds; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      session.latestScreenshot = await captureScreenshot(page);

      const cookies = await page.cookies();
      const currentUrl = page.url();

      sidCookie = cookies.find(c => 
        c.name === 'sid' || 
        c.name === 'user_id' || 
        c.name === 'auth_token' ||
        c.name === '_mwus' ||
        c.name === 'mercarius_session'
      );

      const hasNavigated = currentUrl.includes('mercari.com') && 
        !currentUrl.includes('/login') && 
        !currentUrl.includes('/signup') && 
        !currentUrl.includes('/signin');

      const isFeedOrMyPage = await page.evaluate(() => {
        return !!document.querySelector('a[href*="/mypage"], [data-testid="MyPageProfileName"], a[href*="/sell"], button[aria-label*="account" i], [class*="avatar" i], [class*="user" i]');
      });

      if ((hasNavigated && cookies.length > 5) || (hasNavigated && sidCookie) || isFeedOrMyPage) {
        console.log(`[Mercari 2FA] Authenticated login confirmed in ${i} seconds! (URL: ${currentUrl}, Cookies: ${cookies.length})`);
        finalCookies = cookies;
        break;
      }

      session.message = `Verifying security code... (${i}s / ${maxWaitSeconds}s)`;
    }

    if (finalCookies.length === 0) {
      const checkCookies = await page.cookies();
      const checkUrl = page.url();
      if (checkCookies.length > 5 && !checkUrl.includes('/login')) {
        finalCookies = checkCookies;
      } else {
        const errorText = await page.evaluate(() => {
          const errEl = document.querySelector('[class*="error" i], [class*="alert" i]');
          return errEl ? errEl.textContent.trim() : null;
        });
        throw new Error(errorText || 'Verification timed out after 30s. The code may be incorrect or expired.');
      }
    }

    const effectiveCookies = finalCookies.length > 0 ? finalCookies : await page.cookies();
    const sessionCookieStr = effectiveCookies.map(c => `${c.name}=${c.value}`).join('; ');
    const accessTokenVal = (sidCookie && sidCookie.value) || 
      (effectiveCookies.find(c => c.name === '_mwus' || c.name === 'mercarius_session')?.value) || 
      'authenticated';
    
    console.log('[Mercari 2FA] Verification successful! Session cookie length:', sessionCookieStr.length);

    let profileUsername = username;
    try {
      session.status = 'fetching_profile';
      session.message = 'Retrieving profile details...';
      await page.goto('https://www.mercari.com/mypage/profile/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('input[name="displayName"], input[placeholder*="display name" i], input[placeholder*="username" i]', { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      
      const scrapedName = await page.evaluate(() => {
        const nameInput = document.querySelector('input[name="displayName"], input[name="name"], input[placeholder*="display name" i], input[placeholder*="username" i]');
        if (nameInput && nameInput.value && nameInput.value.trim()) return nameInput.value.trim();
        const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i]');
        return nameEl ? nameEl.textContent.trim() : '';
      });
      if (scrapedName && !scrapedName.includes('@')) profileUsername = scrapedName;
    } catch (e) {
      console.warn('[Mercari 2FA] Failed to scrape username:', e.message);
    }

    // Extract real Mercari User ID from _mwus cookie
    let mercariUserId = '';
    const mwusCookie = effectiveCookies.find(c => c.name === '_mwus');
    if (mwusCookie && mwusCookie.value) {
      try {
        const decoded = JSON.parse(Buffer.from(mwusCookie.value, 'base64').toString('utf8'));
        if (decoded.userId) mercariUserId = String(decoded.userId);
      } catch (e) {}
    }

    // Save credentials to User document
    const targetUserId = userId || session.userId;
    if (targetUserId) {
      try {
        const user = await User.findById(targetUserId);
        if (user) {
          user.mercariAccount = {
            connected: true,
            username: profileUsername,
            userId: mercariUserId,
            sessionCookie: sessionCookieStr,
            accessToken: accessTokenVal,
            connectedAt: new Date()
          };
          await user.save();
          console.log(`[Mercari 2FA] Saved Mercari connection for user: ${targetUserId} (Mercari Username: ${profileUsername}, ID: ${mercariUserId})`);
        }
      } catch (dbErr) {
        console.error('[Mercari 2FA] Database save error:', dbErr.message);
      }
    }

    if (intervalId) clearInterval(intervalId);
    session.status = 'completed';
    session.message = 'Verification successful!';
    
    // Give frontend polling a chance to receive completed status before tearing down
    setTimeout(async () => {
      try {
        await browser.close();
      } catch (e) {}
      activeSessions.delete(sessionId);
    }, 3000);

    return {
      success: true,
      username: profileUsername,
      sessionCookie: sessionCookieStr,
      accessToken: accessTokenVal
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
    '2faRequired': session['2faRequired'],
    verificationOptions: session.verificationOptions || null
  };
}

// Function to trigger SMS, Voice Call, or Resend code on active session page
async function triggerVerificationMethod(sessionId, method) {
  if (!activeSessions.has(sessionId)) {
    throw new Error('Session expired or not found.');
  }

  const session = activeSessions.get(sessionId);
  const { page } = session;

  console.log(`[Mercari 2FA Option] Triggering method '${method}' for session: ${sessionId}`);

  // Find target element coordinates and perform DOM click
  const clickInfo = await page.evaluate((m) => {
    const isCall = m === 'call' || m === 'call_me';
    const isSms = m === 'sms' || m === 'send_code' || m === 'sms_switch';
    const isResend = m === 'resend' || m === 'email';

    // Only search clickable interactive elements (NOT containers or divs)
    const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]'));
    let targetEl = null;

    for (const el of candidates) {
      const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
      if (isCall && (text === 'call me instead' || text === 'call me' || (text.includes('call me') && !text.includes('send code')))) {
        targetEl = el;
        break;
      }
      if (isSms && (text === 'send code' || text === 'send code via sms' || (text.includes('send code') && !text.includes('call me')))) {
        targetEl = el;
        break;
      }
      if (isResend && (text === 'resend code' || text === 'resend' || (text.includes('resend') && !text.includes('send code')))) {
        targetEl = el;
        break;
      }
    }

    if (!targetEl && isSms) {
      targetEl = document.querySelector('[data-testid="send-code-button"], button[type="submit"]');
    }

    if (targetEl) {
      targetEl.scrollIntoView({ block: 'center' });
      targetEl.click();
      const rect = targetEl.getBoundingClientRect();
      return {
        found: true,
        tag: targetEl.tagName,
        text: (targetEl.innerText || targetEl.textContent || '').trim(),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }

    return { found: false };
  }, method);

  // If element found, trigger Puppeteer native hardware click at coordinates
  if (clickInfo && clickInfo.found && clickInfo.x && clickInfo.y) {
    console.log(`[Mercari 2FA Option] Clicked <${clickInfo.tag}> '${clickInfo.text}' at (${clickInfo.x}, ${clickInfo.y}) for method: ${method}`);
    try {
      await page.mouse.click(clickInfo.x, clickInfo.y);
    } catch (mouseErr) {
      console.warn('[Mercari 2FA Option] Mouse click fallback note:', mouseErr.message);
    }
  } else {
    console.warn(`[Mercari 2FA Option] Could not locate clickable element for method: ${method}`);
    return {
      success: false,
      message: 'Option is currently unavailable or in cooldown on Mercari.'
    };
  }

  // Wait 3 seconds for Mercari modal transition
  await new Promise(r => setTimeout(r, 3000));
  const newFrame = await captureScreenshot(page);
  if (newFrame) {
    session.latestScreenshot = newFrame;
  }

  let message = 'Action requested from Mercari!';
  if (method === 'call') {
    message = 'Voice call requested! Please answer your phone for the code.';
  } else if (method === 'email' || method === 'resend') {
    message = 'Fresh verification code resent to your email!';
  } else {
    message = 'Verification code sent via SMS to your phone!';
  }

  session.message = message;

  return {
    success: true,
    latestScreenshot: session.latestScreenshot,
    message: session.message
  };
}

module.exports = {
  loginToMercari,
  verifyMercari2FA,
  triggerVerificationMethod,
  getSessionState,
  activeSessions
};

