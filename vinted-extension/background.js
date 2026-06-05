let pendingListingData = null;
let cachedCsrfTokens = {};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Vinted Fast Automator Service Worker installed!');
});

// Helper to find existing Vinted tab to determine the correct regional domain (portal)
function getVintedPortalUrl(callback) {
  chrome.tabs.query({}, (tabs) => {
    const vintedTab = tabs.find(tab => tab.url && tab.url.includes('vinted.'));
    if (vintedTab) {
      try {
        const urlObj = new URL(vintedTab.url);
        // Returns e.g. https://www.vinted.fr or https://www.vinted.com
        callback(`${urlObj.protocol}//${urlObj.hostname}/items/new`);
        return;
      } catch (e) {
        console.error('Error parsing Vinted tab URL:', e);
      }
    }
    callback('https://www.vinted.com/items/new');
  });
}

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Vinted Background received message:', message);
  
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
  
  else if (message.action === 'GET_CACHED_CSRF_TOKEN') {
    sendResponse({ success: true, token: cachedCsrfTokens[message.site] });
  }
  
  else if (message.action === 'START_VINTED_LISTING') {
    // Store data in transition memory
    pendingListingData = message.data;
    console.log('Stored pending Vinted listing data in queue:', pendingListingData);
    
    // Open Vinted create listing page in a new tab matching the portal in use
    getVintedPortalUrl((url) => {
      console.log('Opening Vinted listing page:', url);
      chrome.tabs.create({ url }, (tab) => {
        console.log('Opened Vinted tab, ID:', tab.id);
      });
    });
    
    sendResponse({ success: true, message: 'Vinted tab opened. Listing queued.' });
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
