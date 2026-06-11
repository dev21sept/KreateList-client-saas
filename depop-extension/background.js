let pendingListingData = null;
let cachedCsrfTokens = {};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Depop Fast Automator Service Worker installed!');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Depop Background received message:', message);
  
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
  
  else if (message.action === 'START_DEPOP_LISTING') {
    // Store data in transition memory
    pendingListingData = message.data;
    console.log('Stored pending Depop listing data in queue:', pendingListingData);
    
    // Open Depop create listing page in a new tab
    chrome.tabs.create({ url: 'https://www.depop.com/products/create/' }, (tab) => {
      console.log('Opened Depop tab, ID:', tab.id);
    });
    
    sendResponse({ success: true, message: 'Depop tab opened. Listing queued.' });
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

  else if (message.action === 'BACKGROUND_DEPOP_REQUEST') {
    const { url, method, headers, body, responseType } = message.data;
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {}
    };

    if (body) {
      if (typeof body === 'string') {
        fetchOptions.body = body;
      } else if (body.type === 'base64') {
        try {
          const binaryString = atob(body.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fetchOptions.body = bytes;
        } catch (e) {
          console.error("Failed to decode base64 body:", e);
        }
      }
    }

    fetch(url, fetchOptions)
      .then(async (res) => {
        const ok = res.ok;
        const status = res.status;
        let resData = null;

        if (responseType === 'json') {
          resData = await res.json().catch(() => null);
        } else if (responseType === 'blob' || responseType === 'base64') {
          const arrayBuffer = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          resData = btoa(binary);
        } else {
          resData = await res.text().catch(() => null);
        }

        sendResponse({ success: true, ok, status, data: resData });
      })
      .catch((err) => {
        console.error('Background fetch failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open
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
