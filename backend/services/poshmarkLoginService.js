const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Helper to construct axios config with HTTP Proxy support if configured
function getAxiosConfig(options) {
  const config = {
    method: options.method || 'GET',
    url: options.url,
    headers: options.headers || {},
    data: options.data || null,
    timeout: 20000,
    validateStatus: () => true // Allow handling non-200 responses manually
  };
  
  const proxyUrl = process.env.HTTP_PROXY_URL;
  if (proxyUrl) {
    console.log(`[Poshmark Login] Routing request via proxy agent...`);
    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
  }
  
  return config;
}

// Helper to parse cookies from Set-Cookie header array
function parseSetCookies(setCookieHeader) {
  if (!setCookieHeader || !Array.isArray(setCookieHeader)) return {};
  const cookies = {};
  setCookieHeader.forEach(cookieStr => {
    const parts = cookieStr.split(';')[0].split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = value;
    }
  });
  return cookies;
}

// Helper to serialize cookies object to header string
function serializeCookies(cookiesObj) {
  return Object.entries(cookiesObj)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Performs server-side login to Poshmark using username/password credentials.
 * Captures and returns session cookies and CSRF token.
 * 
 * @param {string} username Poshmark username or email
 * @param {string} password Poshmark account password
 * @param {string} domain Poshmark domain (e.g., poshmark.com, poshmark.ca, etc.)
 * @returns {Promise<Object>} Connection details or error object
 */
async function loginToPoshmark(username, password, domain = 'poshmark.com') {
  const cleanDomain = domain.trim().toLowerCase().replace(/^www\./i, '') || 'poshmark.com';
  console.log(`[Poshmark Login] Attempting login for user: ${username} on domain: ${cleanDomain}`);

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    // Step 1: GET Poshmark login page to initialize session and extract initial CSRF token
    console.log('[Poshmark Login] Step 1: Fetching login page to initialize CSRF and cookies...');
    const getPageConfig = getAxiosConfig({
      method: 'GET',
      url: `https://www.${cleanDomain}/login`,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const pageRes = await axios(getPageConfig);
    if (pageRes.status !== 200) {
      throw new Error(`Failed to load Poshmark login page. HTTP status: ${pageRes.status}`);
    }

    // Parse cookies and CSRF from page response
    const pageCookies = parseSetCookies(pageRes.headers['set-cookie']);
    const $ = cheerio.load(pageRes.data);
    
    // Extract CSRF token from meta tags
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                      $('body').attr('data-csrf-token') || 
                      pageCookies['_csrf'] || 
                      '';
                      
    console.log(`[Poshmark Login] Initial cookies loaded:`, Object.keys(pageCookies));
    console.log(`[Poshmark Login] CSRF token resolved: ${csrfToken ? 'YES' : 'NO'}`);

    if (!csrfToken) {
      throw new Error('Unable to extract CSRF token from Poshmark login page.');
    }

    // Step 2: POST credentials to Poshmark user login endpoint
    console.log('[Poshmark Login] Step 2: Submitting login credentials...');
    
    const loginPayload = {
      login_form: {
        username_email: username.trim(),
        password: password
      }
    };

    const cookieHeader = serializeCookies(pageCookies);
    const postLoginConfig = getAxiosConfig({
      method: 'POST',
      url: `https://www.${cleanDomain}/vm-rest/users/login`,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'x-xsrf-token': csrfToken,
        'cookie': cookieHeader,
        'origin': `https://www.${cleanDomain}`,
        'referer': `https://www.${cleanDomain}/login`
      },
      data: loginPayload
    });

    const loginRes = await axios(postLoginConfig);
    console.log(`[Poshmark Login] Response Status: ${loginRes.status}`);

    if (loginRes.status !== 200 && loginRes.status !== 201) {
      const errMsg = loginRes.data?.error?.errorMessage || loginRes.data?.message || `HTTP error ${loginRes.status}`;
      throw new Error(errMsg);
    }

    // Step 3: Parse and merge authenticated session cookies
    const authCookies = parseSetCookies(loginRes.headers['set-cookie']);
    const mergedCookiesObj = { ...pageCookies, ...authCookies };
    
    const hasSessionCookie = mergedCookiesObj['_poshmark_session'] || mergedCookiesObj['jwt'];
    if (!hasSessionCookie) {
      // If we got 200 but no session cookies, it might have triggered security challenge
      if (loginRes.data?.security_challenge || loginRes.data?.captcha_required) {
        throw new Error('Security verification (CAPTCHA) required by Poshmark.');
      }
      throw new Error('Login successful but Poshmark session cookie was not returned.');
    }

    // Append the elister_domain tag so our backendPublishService knows which domain to target
    const finalCookieString = `${serializeCookies(mergedCookiesObj)}; elister_domain=${cleanDomain}`;
    
    // Resolve final CSRF token
    const finalCsrfToken = loginRes.headers['x-csrf-token'] || 
                           loginRes.headers['x-xsrf-token'] || 
                           mergedCookiesObj['_csrf'] || 
                           csrfToken;

    console.log('[Poshmark Login] Login successful! Session captured.');

    return {
      success: true,
      username: loginRes.data?.user?.username || username.trim(),
      sessionCookie: finalCookieString,
      csrfToken: finalCsrfToken
    };

  } catch (error) {
    console.error('[Poshmark Login] Direct login failed with error:', error.message);
    let userMsg = error.message;
    if (error.response?.data?.error?.errorMessage) {
      userMsg = error.response.data.error.errorMessage;
    }
    
    if (userMsg.toLowerCase().includes('captcha') || userMsg.toLowerCase().includes('security')) {
      userMsg = 'Security verification (CAPTCHA) required by Poshmark. Please log in using the eLister Chrome Extension instead.';
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
