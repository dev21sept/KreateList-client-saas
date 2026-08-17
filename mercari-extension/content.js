// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Detect current site
const host = window.location.hostname.toLowerCase();
let currentSite = 'unknown';

if (host.includes('mercari.com')) {
  currentSite = 'mercari';
} else if (host.includes('elister.ai') || host === 'localhost' || host === '127.0.0.1') {
  currentSite = 'elister';
}

console.log('[Elister Mercari Extension] Content script loaded on:', window.location.href, '| Site category:', currentSite);

if (currentSite === 'elister') {
  // Flag that the extension is installed
  document.body.dataset.elisterExtensionInstalled = "true";
  document.body.dataset.elisterMercariExtensionInstalled = "true";
  console.log('[Elister Mercari Extension] Flagged presence in document body.');
}

// Handler on Mercari page to finish connection flow automatically
if (currentSite === 'mercari') {
  // Check if we are inside a redirect login capture flow
  chrome.runtime.sendMessage({ action: 'GET_CONNECT_FLOW' }, (res) => {
    if (res && res.success && res.flow) {
      console.log('[Elister Mercari Extension] Detected active connection flow redirect. Checking login state...');
      
      // Wait for page to load and extract user details
      const checkLoginInterval = setInterval(() => {
        // Mercari uses specific selectors for profile/mypage
        const myPageBtn = document.querySelector('a[href*="/mypage/"], [data-testid="MyPageButton"]');
        const isLoggedIn = document.cookie.includes('sid=') || document.cookie.includes('mercarius_session=') || document.cookie.includes('_mercari_session=') || document.cookie.includes('user_id=') || myPageBtn;
        
        if (isLoggedIn) {
          clearInterval(checkLoginInterval);
          console.log('[Elister Mercari Extension] User is logged in! Completing connection...');
          
          let username = 'Mercari User';
          // Try to scrape name from UI
          const nameEl = document.querySelector('[data-testid="MyPageProfileName"], [class*="profile" i] [class*="name" i], [class*="MyPage" i] h1, [class*="userName" i], h1[class*="Name"], [class*="name" i] h1');
          if (nameEl && nameEl.textContent) {
            username = nameEl.textContent.trim();
          }
          
          chrome.runtime.sendMessage({
            action: 'COMPLETE_MERCARI_CONNECT',
            data: { username }
          }, (response) => {
            console.log('[Elister Mercari Extension] Connection completed response:', response);
          });
        }
      }, 2000);
      
      // Stop checking after 60 seconds
      setTimeout(() => clearInterval(checkLoginInterval), 60000);
    }
  });
}

// Window listener for App communications
if (currentSite === 'elister') {
  window.addEventListener('message', (event) => {
    // Only accept messages from same window
    if (event.source !== window) return;
    
    if (event.data && event.data.action === 'ELISTER_MERCARI_BRAND_SEARCH') {
      chrome.runtime.sendMessage({
        action: 'SEARCH_MERCARI_BRANDS',
        query: event.data.query
      }, (response) => {
        window.postMessage({
          action: 'ELISTER_MERCARI_BRAND_SEARCH_RESPONSE',
          success: response?.success || false,
          brands: response?.brands || []
        }, '*');
      });
    }
    
    else if (event.data && event.data.action === 'ELISTER_START_CONNECT_FLOW' && event.data.platform === 'mercari') {
      console.log('[Elister Mercari Extension] Initiating Mercari Connect Flow with credentials...');
      const { token, backendUrl, frontendUrl } = event.data;
      chrome.runtime.sendMessage({
        action: 'START_MERCARI_CONNECT_FLOW',
        data: { token, backendUrl, frontendUrl }
      });
    }
    
    // Capture automatic connection trigger from settings
    else if (event.data && event.data.action === 'ELISTER_GET_CONNECTION_DETAILS' && event.data.platform === 'mercari') {
      console.log('[Elister Mercari Extension] Fetching cached Mercari connection details...');
      chrome.runtime.sendMessage({
        action: 'GET_CONNECTION_DETAILS',
        platform: 'mercari'
      }, (response) => {
        if (response && response.success && response.data) {
          console.log('[Elister Mercari Extension] Sending connection details back to app...');
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'mercari',
            success: true,
            data: response.data
          }, '*');
        } else {
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'mercari',
            success: false,
            error: 'Session details not found in extension cache. Please login/open Mercari tab.'
          }, '*');
        }
      });
    }
  });
}
