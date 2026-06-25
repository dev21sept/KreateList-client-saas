// Helper to get/set state variables from storage
function getStorageData(key, defaultValue) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] !== undefined ? result[key] : defaultValue);
    });
  });
}

function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Depop Fast Automator Service Worker installed!');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Depop Background received message:', message);
  
  if (message.action === 'START_DEPOP_CONNECT_FLOW') {
    const { token, backendUrl, frontendUrl } = message.data;
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.tabs.update(tabId, { url: 'https://www.depop.com/login/' }, (tab) => {
        const flow = {
          tabId: tab.id,
          token,
          backendUrl,
          frontendUrl
        };
        setStorageData('activeConnectFlow', flow).then(() => {
          console.log('Redirecting same tab for Depop Connect Flow:', tab.id);
          sendResponse({ success: true });
        });
      });
    } else {
      sendResponse({ success: false, message: 'No sender tab found' });
    }
    return true;
  }
  
  else if (message.action === 'GET_CONNECT_FLOW') {
    const tabId = sender.tab ? sender.tab.id : null;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (flow && flow.tabId === tabId) {
        sendResponse({ success: true, flow });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
  
  else if (message.action === 'COMPLETE_DEPOP_CONNECT') {
    const { username, accessToken } = message.data;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (!flow) {
        sendResponse({ success: false, message: 'No active connect flow found' });
        return;
      }
      const { token, backendUrl, frontendUrl } = flow;
      
      console.log('Submitting captured Depop credentials to backend:', backendUrl);
      fetch(`${backendUrl}/depop/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: 'depop',
          username,
          accessToken
        })
      })
      .then(res => res.json())
      .then((data) => {
        console.log('Backend connect response:', data);
        if (data.success) {
          getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
            cachedDetails['depop'] = {
              username,
              accessToken
            };
            setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
              chrome.tabs.update(flow.tabId, { url: `${frontendUrl}/ebay-accounts?success=depop` });
              setStorageData('activeConnectFlow', null).then(() => {
                sendResponse({ success: true });
              });
            });
          });
        } else {
          sendResponse({ success: false, message: data.message || 'Backend connection failed' });
        }
      })
      .catch(err => {
        console.error('Error connecting Depop to backend:', err);
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
      getStorageData('cachedCsrfTokens', {}).then((tokens) => {
        tokens[site] = token;
        setStorageData('cachedCsrfTokens', tokens).then(() => {
          console.log(`Cached CSRF Token for ${site}:`, token);
          sendResponse({ success: true });
        });
      });
    } else {
      sendResponse({ success: true });
    }
    return true;
  }
  
  else if (message.action === 'CACHE_CONNECTION_DETAILS') {
    const { platform, data } = message;
    if (platform && data) {
      getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
        cachedDetails[platform] = data;
        setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
          console.log(`Cached Connection Details for ${platform}:`, data);
          sendResponse({ success: true });
        });
      });
      return true;
    }
    sendResponse({ success: true });
  }

  else if (message.action === 'GET_CONNECTION_DETAILS') {
    getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
      sendResponse({ success: true, data: cachedDetails[message.platform] });
    });
    return true;
  }
  
  else if (message.action === 'GET_CACHED_CSRF_TOKEN') {
    getStorageData('cachedCsrfTokens', {}).then((tokens) => {
      sendResponse({ success: true, token: tokens[message.site] });
    });
    return true;
  }
  
  else if (message.action === 'START_DEPOP_LISTING') {
    const pendingData = message.data;
    setStorageData('pendingListingData', pendingData).then(() => {
      console.log('Stored pending Depop listing data in queue:', pendingData);
      
      // Open Depop create listing page in a new tab
      chrome.tabs.create({ url: 'https://www.depop.com/products/create/' }, (tab) => {
        console.log('Opened Depop tab, ID:', tab.id);
      });
      
      sendResponse({ success: true, message: 'Depop tab opened. Listing queued.' });
    });
    return true;
  }
  
  else if (message.action === 'GET_PENDING_LISTING') {
    getStorageData('pendingListingData', null).then((pendingData) => {
      if (pendingData) {
        sendResponse({ success: true, data: pendingData });
        setStorageData('pendingListingData', null).then(() => {});
      } else {
        sendResponse({ success: false, message: 'No pending listing queued.' });
      }
    });
    return true;
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
