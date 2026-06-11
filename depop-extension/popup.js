// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const platformVal = document.getElementById('platform-val');
const csrfVal = document.getElementById('csrf-val');
const userVal = document.getElementById('user-val');
const btnTestApi = document.getElementById('btn-test-api');
const actionStatus = document.getElementById('action-status');
const consoleEl = document.getElementById('console');
const btnClearConsole = document.getElementById('btn-clear-console');

let activeTabId = null;
let currentSite = null; // 'depop' or null

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
function setDisconnectedState(msg = 'Open Depop to activate options.') {
  currentSite = null;
  statusBadge.className = 'status-badge disconnected';
  statusText.textContent = 'Disconnected';
  platformVal.textContent = 'Disconnected';
  platformVal.className = 'value';
  
  csrfVal.textContent = 'Not Found';
  csrfVal.className = 'value status-val warning';
  
  userVal.textContent = 'N/A';
  btnTestApi.disabled = true;
  actionStatus.textContent = msg;
}

// Update UI based on connected platform and site context
function setConnectedState(site, username, token) {
  currentSite = site;
  statusBadge.className = 'status-badge connected';
  statusText.textContent = 'Connected';
  
  const siteDisplayName = site.charAt(0).toUpperCase() + site.slice(1);
  platformVal.textContent = siteDisplayName;
  platformVal.className = 'value text-success';
  
  if (token) {
    csrfVal.textContent = 'Available';
    csrfVal.className = 'value status-val success';
  } else {
    csrfVal.textContent = 'Missing Auth';
    csrfVal.className = 'value status-val error';
  }
  
  userVal.textContent = username || 'Depop Seller';
  btnTestApi.disabled = false;
  actionStatus.textContent = 'Ready for Depop API operations.';
}

// Search active tab and check session
async function checkActiveConnection() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "*://*.depop.com/*"
      ]
    });

    if (tabs.length === 0) {
      setDisconnectedState();
      log('No active Depop tab found. Open Depop to begin.', 'warning');
      return;
    }

    const activeTab = tabs.find(t => t.active) || tabs[0];
    activeTabId = activeTab.id;

    log(`Depop tab found (ID: ${activeTabId}). Querying session status...`, 'system');

    chrome.tabs.sendMessage(activeTabId, { action: 'GET_SESSION_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setDisconnectedState('Please refresh the active tab to load the extension.');
        log('Content script not initialized on Depop tab. Reload the page.', 'error');
        return;
      }

      if (response && response.success) {
        const { site, username, csrfToken } = response.data;
        setConnectedState(site, username, csrfToken);
        log(`Session fetched for Depop.`, 'success');
      } else {
        setDisconnectedState('Failed to read session data.');
        log('Failed to fetch session details from Depop tab.', 'error');
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
  
  log(`Sending Depop API test request...`, 'system');
  actionStatus.textContent = `Testing Depop connection...`;
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
      }
      actionStatus.textContent = 'Depop connection verified.';
    } else {
      log(`API Test failed: ${response?.error || 'Unknown error'}`, 'error');
      actionStatus.textContent = 'API Test failed.';
    }
  });
});

// Initialize connection on popup load
document.addEventListener('DOMContentLoaded', checkActiveConnection);

// Listen to captured API messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOG_CAPTURED_API') {
    const { site, url, method, body, response } = message.data;
    log(`[CAPTURED API (DEPOP)] ${method} ${url.split('?')[0]}`, 'success');
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
