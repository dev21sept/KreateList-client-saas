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
  console.log('Elister Mercari Fast Automator Service Worker installed!');
});

// Helper: Query Mercari cookies
function getMercariCookies(callback) {
  console.log('[Background] Querying cookies for mercari.com');
  chrome.cookies.getAll({ domain: 'mercari.com' }, (cookiesList) => {
    const cookieString = (cookiesList || []).map(c => `${c.name}=${c.value}`).join('; ');
    callback(cookieString);
  });
}

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mercari Background received message:', message);
  
  if (message.action === 'START_MERCARI_CONNECT_FLOW') {
    const { token, backendUrl, frontendUrl } = message.data;
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.tabs.update(tabId, { url: 'https://www.mercari.com/signin/' }, (tab) => {
        const flow = {
          tabId: tab.id,
          token,
          backendUrl,
          frontendUrl
        };
        setStorageData('activeConnectFlow', flow).then(() => {
          console.log('Redirecting same tab for Mercari Connect Flow:', tab.id);
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
  
  else if (message.action === 'COMPLETE_MERCARI_CONNECT') {
    const { username } = message.data;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (!flow) {
        sendResponse({ success: false, message: 'No active connect flow found' });
        return;
      }
      const { token, backendUrl, frontendUrl } = flow;
      
      // Immediately clear the active flow to prevent duplicate triggers
      setStorageData('activeConnectFlow', null);
      
      getMercariCookies((cookieString) => {
        console.log('[Background] Captured Mercari cookies string length:', cookieString.length);
 
        console.log('Submitting captured Mercari credentials to backend:', backendUrl);
        fetch(`${backendUrl}/mercari/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            platform: 'mercari',
            username: username || 'Mercari User',
            sessionCookie: cookieString
          })
        })
        .then(res => res.json())
        .then((data) => {
          console.log('Backend connect response:', data);
          if (data.success) {
            getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
              cachedDetails['mercari'] = {
                username: username || 'Mercari User',
                sessionCookie: cookieString
              };
              setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
                chrome.tabs.update(flow.tabId, { url: `${flow.frontendUrl}/ebay-accounts?success=mercari` });
                sendResponse({ success: true });
              });
            });
          } else {
            sendResponse({ success: false, message: data.message || 'Backend connection failed' });
          }
        })
        .catch(err => {
          console.error('Error connecting to backend:', err);
          sendResponse({ success: false, message: err.message });
        });
      });
    });
    return true;
  }

  else if (message.action === 'GET_CONNECTION_DETAILS') {
    if (message.platform === 'mercari') {
      getMercariCookies((cookieString) => {
        getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
          const details = cachedDetails['mercari'] || {};
          sendResponse({
            success: true,
            data: {
              username: details.username || 'Mercari User',
              sessionCookie: cookieString
            }
          });
        });
      });
      return true;
    } else {
      getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
        sendResponse({ success: true, data: cachedDetails[message.platform] });
      });
      return true;
    }
  }
});
