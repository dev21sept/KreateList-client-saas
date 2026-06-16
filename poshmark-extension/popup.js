// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const platformVal = document.getElementById('platform-val');
const csrfVal = document.getElementById('csrf-val');
const userVal = document.getElementById('user-val');
const btnTestApi = document.getElementById('btn-test-api');
const btnFetchCloset = document.getElementById('btn-fetch-closet');
const actionStatus = document.getElementById('action-status');
const consoleEl = document.getElementById('console');
const btnClearConsole = document.getElementById('btn-clear-console');

let activeTabId = null;
let currentSite = null; // 'poshmark', 'vinted', or null

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
function setDisconnectedState(msg = 'Open Poshmark or Vinted to activate options.') {
  currentSite = null;
  statusBadge.className = 'status-badge disconnected';
  statusText.textContent = 'Disconnected';
  platformVal.textContent = 'Disconnected';
  platformVal.className = 'value';
  
  csrfVal.textContent = 'Not Found';
  csrfVal.className = 'value status-val warning';
  
  userVal.textContent = 'N/A';
  
  btnTestApi.disabled = true;
  btnFetchCloset.disabled = true;
  
  // Set default button layout
  btnFetchCloset.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
    Load Closet Data
  `;
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

  // Set action buttons dynamically based on platform
  if (site === 'poshmark') {
    btnFetchCloset.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
      Load Closet Data
    `;
    if (username && username !== 'Guest') {
      btnFetchCloset.disabled = false;
      actionStatus.textContent = 'Ready for Poshmark API operations.';
    } else {
      btnFetchCloset.disabled = true;
      actionStatus.textContent = 'Please log in to Poshmark to load closet data.';
    }
  }
}

// Search active tab and check session
async function checkActiveConnection() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "*://poshmark.com/*",
        "*://*.poshmark.com/*",
        "*://poshmark.ca/*",
        "*://*.poshmark.ca/*",
        "*://poshmark.co.uk/*",
        "*://*.poshmark.co.uk/*",
        "*://poshmark.com.au/*",
        "*://*.poshmark.com.au/*"
      ]
    });

    if (tabs.length === 0) {
      setDisconnectedState();
      log('No matching Poshmark tab found. Open Poshmark to begin.', 'warning');
      return;
    }

    const activeTab = tabs.find(t => t.active) || tabs[0];
    activeTabId = activeTab.id;

    log(`Tab found (ID: ${activeTabId}). Querying session status...`, 'system');

    chrome.tabs.sendMessage(activeTabId, { action: 'GET_SESSION_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setDisconnectedState('Please refresh the active tab to load the extension.');
        log('Content script not initialized on tab. Reload the page.', 'error');
        return;
      }

      if (response && response.success) {
        const { site, username, csrfToken } = response.data;
        setConnectedState(site, username, csrfToken);
        log(`Session fetched for ${site.toUpperCase()}. User: ${username || 'Guest'}`, 'success');
      } else {
        setDisconnectedState('Failed to read session data.');
        log('Failed to fetch session details from tab.', 'error');
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
  
  log(`Sending ${currentSite.toUpperCase()} API test request...`, 'system');
  actionStatus.textContent = `Testing ${currentSite} connection...`;
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
      actionStatus.textContent = 'API connection verified.';
    } else {
      log(`API Test failed: ${response?.error || 'Unknown error'}`, 'error');
      actionStatus.textContent = 'API Test failed.';
    }
  });
});

// Action: Fetch Platform Action
btnFetchCloset.addEventListener('click', () => {
  if (!activeTabId || !currentSite) return;

  if (currentSite === 'poshmark') {
    log('Initiating Poshmark closet fetch...', 'system');
    actionStatus.textContent = 'Fetching closet listings...';
    btnFetchCloset.disabled = true;
    
    chrome.tabs.sendMessage(activeTabId, { action: 'LOAD_CLOSET_DATA' }, (response) => {
      btnFetchCloset.disabled = false;
      
      if (chrome.runtime.lastError) {
        log(`Closet fetch failed: ${chrome.runtime.lastError.message}`, 'error');
        actionStatus.textContent = 'Closet fetch failed.';
        return;
      }
      
      if (response && response.success) {
        const listings = response.data.listings || [];
        log(`Successfully fetched closet data!`, 'success');
        log(`Found ${listings.length} listings in active page fetch.`, 'info');
        
        listings.slice(0, 3).forEach((item, index) => {
          log(`[${index + 1}] Title: "${item.title}" | Price: ${item.price} | Status: ${item.inventory_status}`, 'info');
        });
        
        if (listings.length > 3) {
          log(`...and ${listings.length - 3} more items.`, 'system');
        }
        actionStatus.textContent = `Closet loaded. ${listings.length} items found.`;
      } else {
        log(`Fetch failed: ${response?.error || 'Unknown error'}`, 'error');
        actionStatus.textContent = 'Closet fetch failed.';
      }
    });
  }
});

// Initialize connection on popup load
document.addEventListener('DOMContentLoaded', checkActiveConnection);

// Listen to captured API messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOG_CAPTURED_API') {
    const { site, url, method, body, response } = message.data;
    log(`[CAPTURED API (${site.toUpperCase()})] ${method} ${url.split('?')[0]}`, 'success');
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
