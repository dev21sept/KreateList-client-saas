// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const platformVal = document.getElementById('platform-val');
const csrfVal = document.getElementById('csrf-val');
const userVal = document.getElementById('user-val');
const btnTestApi = document.getElementById('btn-test-api');
const btnFetchSizes = document.getElementById('btn-fetch-sizes');
const actionStatus = document.getElementById('action-status');
const consoleEl = document.getElementById('console');
const btnClearConsole = document.getElementById('btn-clear-console');

let activeTabId = null;
let currentSite = null; // 'vinted' or null

// Logger function
function log(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Clear Console
btnClearConsole.addEventListener('click', () => {
  consoleEl.innerHTML = '';
  log('Console cleared.', 'system');
});

// Update UI to disconnected state
function setDisconnectedState(msg = 'Open Vinted to activate options.') {
  currentSite = null;
  statusBadge.className = 'status-badge disconnected';
  statusText.textContent = 'Disconnected';
  platformVal.textContent = 'Disconnected';
  platformVal.className = 'value';
  
  csrfVal.textContent = 'Not Found';
  csrfVal.className = 'value status-val warning';
  
  userVal.textContent = 'N/A';
  
  btnTestApi.disabled = true;
  btnFetchSizes.disabled = true;
  actionStatus.textContent = msg;
}

// Update UI based on connected platform and site context
function setConnectedState(site, username, csrfToken) {
  currentSite = site;
  statusBadge.className = 'status-badge connected';
  statusText.textContent = 'Connected';
  
  // Format site name for display
  const siteDisplayName = site.charAt(0).toUpperCase() + site.slice(1);
  platformVal.textContent = siteDisplayName;
  platformVal.className = 'value text-success';
  
  if (csrfToken) {
    csrfVal.textContent = 'Available';
    csrfVal.className = 'value status-val success';
  } else {
    csrfVal.textContent = 'Missing Token';
    csrfVal.className = 'value status-val error';
  }
  
  userVal.textContent = username || 'Guest (Logged Out)';
  btnTestApi.disabled = false;
  btnFetchSizes.disabled = false;
  actionStatus.textContent = 'Ready for Vinted API operations.';
}

// Search active tab and check session
async function checkActiveConnection() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "*://*.vinted.com/*",
        "*://*.vinted.co.uk/*",
        "*://*.vinted.fr/*",
        "*://*.vinted.de/*",
        "*://*.vinted.it/*",
        "*://*.vinted.es/*",
        "*://*.vinted.nl/*",
        "*://*.vinted.be/*",
        "*://*.vinted.pl/*",
        "*://*.vinted.cz/*",
        "*://*.vinted.se/*",
        "*://*.vinted.ro/*",
        "*://*.vinted.hu/*",
        "*://*.vinted.sk/*",
        "*://*.vinted.at/*"
      ]
    });

    if (tabs.length === 0) {
      setDisconnectedState();
      log('No active Vinted tab found. Open Vinted to begin.', 'warning');
      return;
    }

    const activeTab = tabs.find(t => t.active) || tabs[0];
    activeTabId = activeTab.id;

    log(`Vinted tab found (ID: ${activeTabId}). Querying session status...`, 'system');

    chrome.tabs.sendMessage(activeTabId, { action: 'GET_SESSION_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setDisconnectedState('Please refresh the active tab to load the extension.');
        log('Content script not initialized on Vinted tab. Reload the page.', 'error');
        return;
      }

      if (response && response.success) {
        const { site, username, csrfToken } = response.data;
        setConnectedState(site, username, csrfToken);
        log(`Session fetched for Vinted. User: ${username || 'Guest'}`, 'success');
      } else {
        setDisconnectedState('Failed to read session data.');
        log('Failed to fetch session details from Vinted tab.', 'error');
      }
    });

  } catch (err) {
    log(`Connection check failed: ${err.message}`, 'error');
    setDisconnectedState();
  }
}

// Action: Test API Connection
btnTestApi.addEventListener('click', () => {
  if (!activeTabId || !currentSite) return;
  
  log(`Sending Vinted API test request...`, 'system');
  actionStatus.textContent = `Testing Vinted connection...`;
  btnTestApi.disabled = true;
  
  chrome.tabs.sendMessage(activeTabId, { action: 'TEST_API_CONNECTION' }, (response) => {
    btnTestApi.disabled = false;
    
    if (chrome.runtime.lastError) {
      log(`API Test failed: ${chrome.runtime.lastError.message}`, 'error');
      actionStatus.textContent = 'API Test failed.';
      return;
    }
    
    if (response && response.success) {
      log(`API Test Success!`, 'success');
      if (response.data.details) {
        log(response.data.details, 'info');
      } else if (response.data.username) {
        log(`Logged in user: ${response.data.username}`, 'info');
      }
      actionStatus.textContent = 'Vinted connection verified.';
    } else {
      log(`API Test failed: ${response?.error || 'Unknown error'}`, 'error');
      actionStatus.textContent = 'API Test failed.';
    }
  });
});

// Action: Fetch Sizes
btnFetchSizes.addEventListener('click', () => {
  if (!activeTabId || !currentSite) return;

  log('Sending Vinted fetch request for size groups (Catalog ID: 1773)...', 'system');
  actionStatus.textContent = 'Fetching size groups...';
  btnFetchSizes.disabled = true;

  chrome.tabs.sendMessage(activeTabId, { action: 'FETCH_VINTED_SIZES', catalogId: 1773 }, (response) => {
    btnFetchSizes.disabled = false;

    if (chrome.runtime.lastError) {
      log(`Fetch sizes failed: ${chrome.runtime.lastError.message}`, 'error');
      actionStatus.textContent = 'Sizes fetch failed.';
      return;
    }

    if (response && response.success) {
      const sizeGroups = response.data.size_groups || [];
      log(`Successfully fetched Vinted size groups!`, 'success');
      log(`Found ${sizeGroups.length} size groups.`, 'info');

      sizeGroups.forEach((group) => {
        const sizesList = (group.sizes || []).map(s => s.name || s.title).join(', ');
        log(`Group: "${group.title || 'General'}" | Sizes: [${sizesList}]`, 'info');
      });

      actionStatus.textContent = `Loaded ${sizeGroups.length} size groups.`;
    } else {
      log(`Fetch sizes failed: ${response?.error || 'Unknown error'}`, 'error');
      actionStatus.textContent = 'Sizes fetch failed.';
    }
  });
});

// Initialize connection on popup load
document.addEventListener('DOMContentLoaded', checkActiveConnection);

// Listen to captured API messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOG_CAPTURED_API') {
    const { site, url, method, body, response } = message.data;
    log(`[CAPTURED API (VINTED)] ${method} ${url.split('?')[0]}`, 'success');
    if (body) {
      try {
        const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
        log(`Payload: ${JSON.stringify(parsedBody, null, 2).substring(0, 400)}...`, 'info');
      } catch (e) {
        log(`Payload: ${String(body).substring(0, 400)}...`, 'info');
      }
    }
    if (response) {
      log(`Response Preview: ${response.substring(0, 200)}...`, 'system');
    }
  }
});
