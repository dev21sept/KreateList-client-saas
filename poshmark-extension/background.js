let pendingListingData = null;
let cachedCsrfTokens = {};
let cachedConnectionDetails = {};
let activeConnectFlow = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Fast Automator Service Worker installed!');
});

// Helper: Extract base domain from sender tab URL (e.g. poshmark.com, poshmark.ca, etc.)
function getBaseDomain(sender) {
  try {
    if (sender && sender.tab && sender.tab.url) {
      const url = new URL(sender.tab.url);
      const host = url.hostname.toLowerCase();
      const match = host.match(/poshmark\.(com|ca|co\.uk|com\.au)/);
      if (match) {
        return match[0];
      }
    }
  } catch (e) {
    console.error('Error parsing base domain from sender:', e);
  }
  return 'poshmark.com';
}

// Helper: Query Poshmark cookies and optionally establish session if missing but jwt is present
function getPoshmarkCookiesWithSessionCheck(sender, callback) {
  const baseDomain = getBaseDomain(sender);
  console.log(`[Background] Querying cookies for base domain: ${baseDomain}`);

  const queryAndCheck = (attempt = 1) => {
    chrome.cookies.getAll({ domain: baseDomain }, (cookies) => {
      // Fallback if domain-specific query returns nothing or is blocked
      if (!cookies || cookies.length === 0) {
        chrome.cookies.getAll({}, (allCookies) => {
          const filtered = allCookies ? allCookies.filter(c => c.domain.includes(baseDomain)) : [];
          processCookies(filtered, attempt);
        });
      } else {
        processCookies(cookies, attempt);
      }
    });
  };

  const processCookies = (poshCookies, attempt) => {
    console.log(`[Background] Found Poshmark cookies (attempt ${attempt}):`, poshCookies.map(c => ({ name: c.name, domain: c.domain })));

    const hasSessionCookie = poshCookies.some(c => c.name === '_poshmark_session');
    const hasJwt = poshCookies.some(c => c.name === 'jwt');

    if (!hasSessionCookie && hasJwt && attempt === 1) {
      console.log(`[Background] _poshmark_session not found on ${baseDomain} but jwt is present. Establishing session via fetch...`);
      // Fetch the API endpoint to trigger Rails session cookie setup
      fetch(`https://www.${baseDomain}/vm-rest/users/self`)
        .then(() => {
          // Wait 1.5 seconds for the browser to receive and apply Set-Cookie, then query again
          setTimeout(() => queryAndCheck(2), 1500);
        })
        .catch(err => {
          console.error('[Background] Failed to establish Poshmark session:', err);
          callback(poshCookies, baseDomain);
        });
    } else {
      callback(poshCookies, baseDomain);
    }
  };

  queryAndCheck(1);
}

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'START_POSHMARK_CONNECT_FLOW') {
    const { token, backendUrl, frontendUrl } = message.data;
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.tabs.update(tabId, { url: 'https://poshmark.com/login' }, (tab) => {
        activeConnectFlow = {
          tabId: tab.id,
          token,
          backendUrl,
          frontendUrl
        };
        console.log('Redirecting same tab for Poshmark Connect Flow:', tab.id);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, message: 'No sender tab found' });
    }
    return true;
  }
  
  else if (message.action === 'GET_CONNECT_FLOW') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (activeConnectFlow && activeConnectFlow.tabId === tabId) {
      sendResponse({ success: true, flow: activeConnectFlow });
    } else {
      sendResponse({ success: false });
    }
  }
  
  else if (message.action === 'COMPLETE_POSHMARK_CONNECT') {
    const { username, csrfToken } = message.data;
    if (!activeConnectFlow) {
      sendResponse({ success: false, message: 'No active connect flow found' });
      return true;
    }
    const { token, backendUrl, frontendUrl } = activeConnectFlow;
    
    if (typeof chrome.cookies === 'undefined') {
      console.error('chrome.cookies API is undefined! Permission may be missing or extension needs a full reload.');
      sendResponse({ success: false, message: 'chrome.cookies API is undefined. Please remove and re-load the extension.' });
      return true;
    }
    
    console.log('Resolving Poshmark session cookies...');
    getPoshmarkCookiesWithSessionCheck(sender, (poshCookies, baseDomain) => {
      const hasSession = poshCookies.some(c => c.name === '_poshmark_session' || c.name === 'jwt');
      
      if (!hasSession) {
        const cookieNames = poshCookies.map(c => `${c.name} (${c.domain})`).join(', ');
        sendResponse({ 
          success: false, 
          message: `Active Poshmark session not found on ${baseDomain}. Please log in first. Poshmark cookies found: [${cookieNames || 'none'}]` 
        });
        return;
      }
      
      // Combine them into a single Cookie header string, appending the capture domain
      const sessionCookie = `${poshCookies.map(c => `${c.name}=${c.value}`).join('; ')}; elister_domain=${baseDomain}`;
      
      console.log('Submitting captured Poshmark credentials to backend:', backendUrl);
      fetch(`${backendUrl}/external-import/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: 'poshmark',
          username,
          sessionCookie,
          csrfToken
        })
      })
      .then(res => res.json())
      .then(data => {
        console.log('Backend connect response:', data);
        if (data.success) {
          cachedConnectionDetails['poshmark'] = {
            username,
            sessionCookie,
            csrfToken
          };
          chrome.tabs.update(activeConnectFlow.tabId, { url: `${frontendUrl}/ebay-accounts?success=poshmark` });
          activeConnectFlow = null;
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, message: data.message || 'Backend connection failed' });
        }
      })
      .catch(err => {
        console.error('Error connecting Poshmark to backend:', err);
        sendResponse({ success: false, error: err.message });
      });
    });
    return true;
  }
  
  else if (message.action === 'PING_BACKGROUND') {
    sendResponse({ success: true, message: 'Background worker is active' });
  }
  
  else if (message.action === 'CACHE_CSRF_TOKEN') {
    const { site, token } = message.data;
    if (site && token) {
      cachedCsrfTokens[site] = token;
      console.log(`Cached CSRF Token for ${site}:`, token);
    }
    sendResponse({ success: true });
  }
  
  else if (message.action === 'CACHE_CONNECTION_DETAILS') {
    const { platform, data } = message;
    if (platform === 'poshmark') {
      getPoshmarkCookiesWithSessionCheck(sender, (poshCookies, baseDomain) => {
        const sessionCookie = `${poshCookies.map(c => `${c.name}=${c.value}`).join('; ')}; elister_domain=${baseDomain}`;
        
        cachedConnectionDetails[platform] = {
          username: data.username,
          csrfToken: data.csrfToken,
          sessionCookie
        };
        console.log(`Cached Connection Details for ${platform}:`, cachedConnectionDetails[platform]);
        sendResponse({ success: true });
      });
      return true;
    } else {
      cachedConnectionDetails[platform] = data;
      sendResponse({ success: true });
    }
  }

  else if (message.action === 'GET_CONNECTION_DETAILS') {
    sendResponse({ success: true, data: cachedConnectionDetails[message.platform] });
  }
  
  else if (message.action === 'GET_CACHED_CSRF_TOKEN') {
    sendResponse({ success: true, token: cachedCsrfTokens[message.site] });
  }
  
  else if (message.action === 'START_POSHMARK_LISTING') {
    // Store data in transition memory
    pendingListingData = message.data;
    console.log('Stored pending Poshmark listing data in queue:', pendingListingData);
    
    // Open Poshmark create listing page in a new tab
    chrome.tabs.create({ url: 'https://poshmark.com/create-listing' }, (tab) => {
      console.log('Opened Poshmark tab, ID:', tab.id);
    });
    
    sendResponse({ success: true, message: 'Poshmark tab opened. Listing queued.' });
  }
  
  else if (message.action === 'GET_PENDING_LISTING') {
    // Return queued data if available
    if (pendingListingData) {
      sendResponse({ success: true, data: pendingListingData });
      // Clear queue once dispatched to prevent duplicate attempts
      pendingListingData = null;
    } else {
      sendResponse({ success: false, message: 'No pending listing queued.' });
    }
  }
  
  else if (message.action === 'LOG_CAPTURED_API') {
    // Broadcast captured API metrics to popup logs
    chrome.runtime.sendMessage(message).catch(() => {
      // Silently catch error if popup is closed
    });
  }

  else if (message.action === 'RELOAD_ELISTER_TABS') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && (tab.url.includes('elister.ai') || tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
          console.log('Reloading tab:', tab.id, tab.url);
          chrome.tabs.reload(tab.id);
        }
      });
    });
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open
});
