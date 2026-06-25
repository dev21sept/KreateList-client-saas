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
    chrome.cookies.getAll({}, (allCookies) => {
      const poshCookies = allCookies ? allCookies.filter(c => c.domain.includes(baseDomain)) : [];
      console.log(`[Background] Found Poshmark cookies (attempt ${attempt}):`, poshCookies.map(c => ({ name: c.name, domain: c.domain })));

      const hasSessionCookie = poshCookies.some(c => c.name === '_poshmark_session');
      const hasJwt = poshCookies.some(c => c.name === 'jwt');

      if (!hasSessionCookie && hasJwt && attempt === 1) {
        console.log(`[Background] _poshmark_session not found on ${baseDomain} but jwt is present. Establishing session via fetch...`);
        // Fetch /create-listing with a cache-buster to trigger Rails session cookie setup
        fetch(`https://${baseDomain}/create-listing?_elister_cb=` + Date.now())
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
    });
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
      chrome.tabs.update(tabId, { url: 'https://poshmark.com/create-listing' }, (tab) => {
        const flow = {
          tabId: tab.id,
          token,
          backendUrl,
          frontendUrl
        };
        setStorageData('activeConnectFlow', flow).then(() => {
          console.log('Redirecting same tab for Poshmark Connect Flow:', tab.id);
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
  
  else if (message.action === 'SILENT_SYNC_POSHMARK') {
    const { token, backendUrl } = message.data;
    if (typeof chrome.cookies === 'undefined') {
      sendResponse({ success: false, message: 'chrome.cookies API is undefined.' });
      return true;
    }
    
    getPoshmarkCookiesWithSessionCheck(sender, (poshCookies, baseDomain) => {
      const hasJwt = poshCookies.some(c => c.name === 'jwt');
      if (!hasJwt) {
        sendResponse({ success: false, message: 'No active Poshmark session found in browser.' });
        return;
      }
      
      getStorageData('cachedCsrfTokens', {}).then((tokens) => {
        const csrfToken = tokens['poshmark'] || '';
        const sessionCookie = `${poshCookies.map(c => `${c.name}=${c.value}`).join('; ')}; elister_domain=${baseDomain}`;
        
        const uiCookie = poshCookies.find(c => c.name === 'ui');
        let username = 'nicks771';
        if (uiCookie) {
          try {
            const decoded = decodeURIComponent(uiCookie.value);
            const uiObj = JSON.parse(decoded);
            if (uiObj && uiObj.dh) {
              username = uiObj.dh;
            }
          } catch (e) {
            console.error('Error parsing username from ui cookie:', e);
          }
        }
        
        console.log('[Background] Silently syncing Poshmark session for:', username);
        fetch(`${backendUrl}/poshmark/connect`, {
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
        .then((data) => {
          if (data.success) {
            getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
              cachedDetails['poshmark'] = {
                username,
                sessionCookie,
                csrfToken
              };
              setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
                sendResponse({ success: true, message: 'Session synced successfully.' });
              });
            });
          } else {
            sendResponse({ success: false, message: data.message || 'Sync connection failed' });
          }
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      });
    });
    return true;
  }
  
  else if (message.action === 'COMPLETE_POSHMARK_CONNECT') {
    const { username, csrfToken } = message.data;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (!flow) {
        sendResponse({ success: false, message: 'No active connect flow found' });
        return;
      }
      const { token, backendUrl, frontendUrl } = flow;
      
      if (typeof chrome.cookies === 'undefined') {
        console.error('chrome.cookies API is undefined! Permission may be missing or extension needs a full reload.');
        sendResponse({ success: false, message: 'chrome.cookies API is undefined. Please remove and re-load the extension.' });
        return;
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
        fetch(`${backendUrl}/poshmark/connect`, {
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
        .then((data) => {
          console.log('Backend connect response:', data);
          if (data.success) {
            getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
              cachedDetails['poshmark'] = {
                username,
                sessionCookie,
                csrfToken
              };
              setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
                chrome.tabs.update(flow.tabId, { url: `${frontendUrl}/ebay-accounts?success=poshmark` });
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
          console.error('Error connecting Poshmark to backend:', err);
          sendResponse({ success: false, error: err.message });
        });
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
    if (platform === 'poshmark') {
      getPoshmarkCookiesWithSessionCheck(sender, (poshCookies, baseDomain) => {
        const sessionCookie = `${poshCookies.map(c => `${c.name}=${c.value}`).join('; ')}; elister_domain=${baseDomain}`;
        
        getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
          cachedDetails[platform] = {
            username: data.username,
            csrfToken: data.csrfToken,
            sessionCookie
          };
          setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
            console.log(`Cached Connection Details for ${platform}:`, cachedDetails[platform]);
            sendResponse({ success: true });
          });
        });
      });
      return true;
    } else {
      getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
        cachedDetails[platform] = data;
        setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
          sendResponse({ success: true });
        });
      });
      return true;
    }
  }

  else if (message.action === 'GET_CONNECTION_DETAILS') {
    if (message.platform === 'poshmark') {
      getPoshmarkCookiesWithSessionCheck(sender, (poshCookies, baseDomain) => {
        getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
          const details = cachedDetails['poshmark'] || {};
          const sessionCookie = `${poshCookies.map(c => `${c.name}=${c.value}`).join('; ')}; elister_domain=${baseDomain}`;
          
          sendResponse({
            success: true,
            data: {
              username: details.username || 'nicks771',
              csrfToken: details.csrfToken || '',
              sessionCookie
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
  
  else if (message.action === 'GET_CACHED_CSRF_TOKEN') {
    getStorageData('cachedCsrfTokens', {}).then((tokens) => {
      sendResponse({ success: true, token: tokens[message.site] });
    });
    return true;
  }
  
  else if (message.action === 'START_POSHMARK_LISTING') {
    const appTabId = sender.tab ? sender.tab.id : null;
    const pendingData = {
      ...message.data,
      appTabId: appTabId
    };
    setStorageData('pendingListingData', pendingData).then(() => {
      console.log('Stored pending Poshmark listing data in queue with appTabId:', appTabId);
      
      // Open Poshmark create listing page in a background tab
      chrome.tabs.create({ url: 'https://poshmark.com/create-listing', active: false }, (tab) => {
        console.log('Opened Poshmark background tab, ID:', tab.id);
      });
      
      sendResponse({ success: true, message: 'Poshmark background tab opened. Listing queued.' });
    });
    return true;
  }
  
  else if (message.action === 'POSHMARK_PUBLISH_STATUS') {
    const { appTabId, status, message: statusMsg, percent, listingId } = message;
    if (appTabId) {
      chrome.tabs.sendMessage(appTabId, {
        action: 'ELISTER_PUBLISH_STATUS_FROM_EXTENSION',
        status,
        message: statusMsg,
        percent,
        listingId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] Error sending status to app tab:', chrome.runtime.lastError.message);
        }
      });
    }
    
    // Close the Poshmark automation tab when done
    if (status === 'success' || status === 'error') {
      if (sender.tab && sender.tab.id) {
        console.log(`[Background] Closing Poshmark automation tab: ${sender.tab.id}`);
        chrome.tabs.remove(sender.tab.id);
      }
    }
    sendResponse({ success: true });
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
