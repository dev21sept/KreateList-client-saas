let pendingListingData = null;
let cachedCsrfTokens = {};
let cachedConnectionDetails = {};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Fast Automator Service Worker installed!');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'PING_BACKGROUND') {
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
    if (platform && data) {
      cachedConnectionDetails[platform] = data;
      console.log(`Cached Connection Details for ${platform}:`, data);
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
