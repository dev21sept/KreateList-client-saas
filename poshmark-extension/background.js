let pendingListingData = null;
let cachedCsrfTokens = {};
let cachedConnectionDetails = {};
let activeConnectFlow = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Fast Automator Service Worker installed!');
});

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
    
    console.log('Fetching all cookies to resolve Poshmark session...');
    chrome.cookies.getAll({}, (cookies) => {
      if (!cookies || cookies.length === 0) {
        console.error('No cookies returned by chrome.cookies.getAll');
        sendResponse({ success: false, message: 'No cookies found. Please check extension permissions.' });
        return;
      }
      
      // Filter for Poshmark session cookies (jwt, _poshmark_session, _csrf, rt)
      const relevantNames = ['jwt', '_poshmark_session', '_csrf', 'rt'];
      const poshCookies = cookies.filter(c => c.domain.includes('poshmark.com') && relevantNames.includes(c.name));
      console.log('Found Poshmark session cookies:', poshCookies.map(c => ({ name: c.name, domain: c.domain })));
      
      const hasSessionCookie = poshCookies.some(c => c.name === '_poshmark_session');
      
      if (!hasSessionCookie) {
        const cookieNames = cookies.filter(c => c.domain.includes('poshmark')).map(c => `${c.name} (${c.domain})`).slice(0, 30).join(', ');
        sendResponse({ 
          success: false, 
          message: `Active Poshmark session (_poshmark_session) not found. Please log in first. Poshmark cookies found: [${cookieNames || 'none'}]` 
        });
        return;
      }
      
      // Combine them into a single Cookie header string
      const sessionCookie = poshCookies.map(c => `${c.name}=${c.value}`).join('; ');
      
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
      chrome.cookies.getAll({}, (cookies) => {
        const relevantNames = ['jwt', '_poshmark_session', '_csrf', 'rt'];
        const poshCookies = cookies ? cookies.filter(c => c.domain.includes('poshmark.com') && relevantNames.includes(c.name)) : [];
        const sessionCookie = poshCookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        cachedConnectionDetails[platform] = {
          username: data.username,
          csrfToken: data.csrfToken,
          sessionCookie
        };
        console.log(`Cached Connection Details for ${platform}:`, cachedConnectionDetails[platform]);
      });
    } else {
      cachedConnectionDetails[platform] = data;
    }
    sendResponse({ success: true });
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
