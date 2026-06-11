// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper: Extract Depop Bearer Token from Session Storage
function getAuthToken() {
  return sessionStorage.getItem('elister_captured_depop_token');
}

// Process image Blob (resize and pad to 1:1 square ratio)
async function processImageBlob(originalBlob) {
  const maxDim = 1024;
  const minQuality = 0.3;
  const startQuality = 0.9;
  
  try {
    const imgBitmap = await createImageBitmap(originalBlob);
    const { width, height } = imgBitmap;
    
    let targetWidth = width;
    let targetHeight = height;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }
    
    const squareSize = Math.max(targetWidth, targetHeight);
    let canvas, ctx;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(squareSize, squareSize);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = squareSize;
      canvas.height = squareSize;
      ctx = canvas.getContext('2d');
    }
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, squareSize, squareSize);
    
    const dx = (squareSize - targetWidth) / 2;
    const dy = (squareSize - targetHeight) / 2;
    ctx.drawImage(imgBitmap, dx, dy, targetWidth, targetHeight);
    
    let quality = startQuality;
    let blob;
    if (typeof canvas.convertToBlob === 'function') {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      while (blob.size > 5 * 1024 * 1024 && quality > minQuality) {
        quality -= 0.1;
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      }
    } else {
      const dataURLtoBlob = (dataURL) => {
        const parts = dataURL.split(',');
        const mime = parts[0].match(/data:(.*?);/)[1] || 'image/jpeg';
        const bstr = atob(parts[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        return new Blob([u8arr], { type: mime });
      };
      let dataURL = canvas.toDataURL('image/jpeg', quality);
      blob = dataURLtoBlob(dataURL);
      while (blob.size > 5 * 1024 * 1024 && quality > minQuality) {
        quality -= 0.1;
        dataURL = canvas.toDataURL('image/jpeg', quality);
        blob = dataURLtoBlob(dataURL);
      }
    }
    
    if (blob.size > 5 * 1024 * 1024) return originalBlob;
    return blob;
  } catch (e) {
    console.warn('[Elister Depop] Image processing fallback:', e);
    return originalBlob;
  }
}

// UUID generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// -------------------------------------------------------------
// Core Publisher: Dedicated Depop API Uploader
// -------------------------------------------------------------
async function executeDepopUpload(productData) {
  // Render floating status overlay card on page
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(10, 11, 16, 0.95);
    border: 1px solid rgba(255, 38, 0, 0.3);
    backdrop-filter: blur(12px);
    color: #f5f6fa;
    padding: 22px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 999999;
    font-family: 'Inter', system-ui, sans-serif;
    width: 330px;
  `;
  overlay.innerHTML = `
    <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#ff2600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">eLister Depop Auto-Publisher</h3>
    <div id="elister-status" style="font-size:11px;margin-bottom:10px;font-weight:500;">Initializing session...</div>
    <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
      <div id="elister-progress" style="width:0%;height:100%;background:linear-gradient(135deg, #ff2600 0%, #ff5e3a 100%);transition:width 0.3s ease;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const updateStatus = (text, percent) => {
    document.getElementById('elister-status').textContent = text;
    document.getElementById('elister-progress').style.width = `${percent}%`;
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  try {
    let authToken = getAuthToken();
    if (!authToken) {
      const bgResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'GET_CACHED_CSRF_TOKEN', site: 'depop' }, resolve);
      });
      if (bgResponse && bgResponse.token) {
        authToken = bgResponse.token;
      }
    }
    if (!authToken) {
      throw new Error("Authorization Bearer Token not found. Please log into Depop or open your Depop profile.");
    }

    const tempUuid = generateUUID();

    // Step 1: Attribute Resolutions
    updateStatus("Step 1/4: Resolving Depop listing details...", 15);
    await delay(1000);

    // Map Condition ID
    // Depop Condition IDs: 1 (Brand New), 2 (Like New), 3 (Used - Excellent), 4 (Used - Very Good), 5 (Used - Good), 6 (Used - Fair)
    const conditionIdMap = {
      'new_with_tags': 1,
      'new_without_tags': 2,
      'very_good': 3,
      'good': 4,
      'satisfactory': 5,
      'fair': 6
    };
    const conditionId = conditionIdMap[productData.conditionId] || 3;

    // Step 2: Upload Images Binary Flow
    updateStatus("Step 2/4: Preparing listing media files...", 30);
    const assignedPhotos = [];
    const images = productData.images || [];

    let successfulUploadConfig = null;

    const uploadPhotoWithFallback = async (blob, index) => {
      const candidates = [
        { url: '/api/v1/photos/', key: 'photo', type: 'item' },
        { url: '/api/v1/assets/', key: 'file', type: 'item' },
        { url: '/api/v2/photos/', key: 'file', type: 'item' },
        { url: '/api/v1/media/', key: 'file', type: 'item' }
      ];
 
      if (successfulUploadConfig) {
        try {
          const formData = new FormData();
          formData.append(successfulUploadConfig.key, blob, `file${index}.jpg`);
          const res = await fetch(`${window.location.origin}${successfulUploadConfig.url}`, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'authorization': authToken
            },
            credentials: 'include',
            body: formData
          });
          if (res.ok) return res;
          successfulUploadConfig = null;
        } catch (err) {
          successfulUploadConfig = null;
        }
      }
 
      let lastStatus = 0;
      let lastErrorText = '';
 
      for (const candidate of candidates) {
        try {
          console.log(`[Elister Depop] Probing upload endpoint: ${candidate.url} with key: ${candidate.key}`);
          const formData = new FormData();
          formData.append(candidate.key, blob, `file${index}.jpg`);
 
          const res = await fetch(`${window.location.origin}${candidate.url}`, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'authorization': authToken
            },
            credentials: 'include',
            body: formData
          });
 
          lastStatus = res.status;
          if (res.ok) {
            const resClone = res.clone();
            try {
              const data = await resClone.json();
              const photoId = data.id || (data.photo && data.photo.id) || (data.data && data.data.id) || data.photo_id;
              if (photoId) {
                successfulUploadConfig = candidate;
                console.log(`[Elister Depop] Successfully matched uploader config: URL=${candidate.url}, key=${candidate.key}`);
                return res;
              }
            } catch (e) {}
          } else {
            lastErrorText = await res.text();
          }
        } catch (err) {
          lastErrorText = err.message;
        }
      }
 
      const err = new Error(`All photo upload candidate endpoints failed.`);
      err.status = lastStatus;
      err.details = lastErrorText;
      throw err;
    };

    for (let i = 0; i < images.length; i++) {
      updateStatus(`Uploading image ${i+1} of ${images.length}...`, 30 + Math.floor((i / images.length) * 35));
      await delay(1200);

      let imgBlob;
      if (images[i].startsWith('data:')) {
        const byteString = atob(images[i].split(',')[1]);
        const mimeString = images[i].split(',')[0].match(/data:(.*?);/)[1] || 'image/jpeg';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
        imgBlob = new Blob([ab], { type: mimeString });
      } else {
        const imgResponse = await fetch(images[i], { mode: 'cors' });
        if (!imgResponse.ok) {
          throw new Error(`Failed to fetch image ${i+1}. Status: ${imgResponse.status}`);
        }
        imgBlob = await imgResponse.blob();
      }

      const processedBlob = await processImageBlob(imgBlob);
      const uploadRes = await uploadPhotoWithFallback(processedBlob, i);
      const uploadData = await uploadRes.json();
      const photoId = uploadData.id || (uploadData.photo && uploadData.photo.id) || (uploadData.data && uploadData.data.id) || uploadData.photo_id;
      
      if (photoId) {
        assignedPhotos.push(photoId);
      }
    }

    if (assignedPhotos.length === 0) {
      throw new Error("No photos were successfully uploaded to Depop.");
    }

    // Step 3: Save Listing Attributes & Details
    updateStatus("Step 3/4: Saving listing details & categories...", 75);
    await delay(1500);

    const priceCents = Math.round((parseFloat(productData.price) || 0) * 100);
    const savePayload = {
      description: productData.description || '',
      price: priceCents,
      currency: "USD",
      categoryId: parseInt(productData.categoryId) || 1, // Fallback default category
      conditionId: conditionId,
      photos: assignedPhotos,
      brand: productData.brand || '',
      sizeId: parseInt(productData.size) || null,
      colorIds: productData.color ? [parseInt(productData.color)] : [],
      countryCode: productData.country || "US",
      shipping: {
        price: Math.round((parseFloat(productData.shippingPrice) || 0) * 100),
        national: true,
        international: !!productData.worldwideShipping
      },
      status: "active"
    };

    // Try standard Depop listing creation endpoints
    const saveCandidates = [
      { url: '/api/v1/products/', method: 'POST' },
      { url: '/api/v2/products/', method: 'POST' },
      { url: '/api/v1/listings/', method: 'POST' }
    ];

    let saveSuccess = false;
    let savedProductData = null;

    for (const cand of saveCandidates) {
      try {
        console.log(`[Elister Depop] Trying save endpoint: ${cand.url}`);
        const res = await fetch(`${window.location.origin}${cand.url}`, {
          method: cand.method,
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': authToken
          },
          credentials: 'include',
          body: JSON.stringify(savePayload)
        });

        if (res.ok) {
          savedProductData = await res.json();
          saveSuccess = true;
          break;
        } else {
          console.warn(`[Elister Depop] Save endpoint ${cand.url} failed. Status: ${res.status}`);
        }
      } catch (err) {
        console.warn(`[Elister Depop] Error saving to ${cand.url}:`, err.message);
      }
    }

    if (!saveSuccess) {
      throw new Error("Failed to save product details on Depop. Check connection and try again.");
    }

    // Step 4: Finalize & Success Notification
    updateStatus("Step 4/4: Listing successfully published!", 100);
    await delay(2000);
    
    // Log Activity to backend
    if (productData.backendUrl && productData.token) {
      fetch(`${productData.backendUrl}/listings/${productData.listingId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${productData.token}`
        },
        body: JSON.stringify({ status: 'published', platform: 'depop' })
      }).catch(err => console.warn('Activity log failed:', err));
    }

    overlay.innerHTML = `
      <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#2ed573;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">Success!</h3>
      <div style="font-size:11px;margin-bottom:10px;font-weight:500;color:#f5f6fa;">Your listing has been published to Depop!</div>
      <button id="elister-close-overlay" style="background:#2ed573;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;width:100%;">Close</button>
    `;
    
    document.getElementById('elister-close-overlay').addEventListener('click', () => {
      overlay.remove();
    });

  } catch (err) {
    console.error('[Elister Depop Auto-Publisher Error]', err);
    updateStatus(`Error: ${err.message}`, 100);
    
    overlay.style.border = '1px solid rgba(255, 71, 87, 0.4)';
    overlay.innerHTML = `
      <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#ff4757;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">Publishing Failed</h3>
      <div style="font-size:11px;margin-bottom:10px;font-weight:500;color:#ff4757;word-break:break-word;">${err.message}</div>
      <button id="elister-close-overlay" style="background:#ff4757;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;width:100%;">Dismiss</button>
    `;
    
    document.getElementById('elister-close-overlay').addEventListener('click', () => {
      overlay.remove();
    });
  }
}

// -------------------------------------------------------------
// Message Listener & Context Detector
// -------------------------------------------------------------
const currentHostname = window.location.hostname;
let currentSite = 'unknown';

if (currentHostname.includes('depop.com')) {
  currentSite = 'depop';
} else if (currentHostname.includes('elister') || currentHostname.includes('localhost') || currentHostname.includes('127.0.0.1')) {
  currentSite = 'elister';
}

if (currentSite === 'depop') {
  // Listen for captured API details from interceptor
  window.addEventListener('ELISTER_DEPOP_API_CAPTURED', (event) => {
    chrome.runtime.sendMessage({
      action: 'LOG_CAPTURED_API',
      data: {
        site: currentSite,
        url: event.detail.url,
        method: event.detail.method,
        body: event.detail.body,
        response: event.detail.response ? event.detail.response.substring(0, 1000) : ''
      }
    }).catch(() => {});
  });

  // Listen for auth token updates
  window.addEventListener('ELISTER_DEPOP_TOKEN_CAPTURED', (event) => {
    const token = event.detail.token;
    if (token) {
      sessionStorage.setItem('elister_captured_depop_token', token);
      chrome.runtime.sendMessage({
        action: 'CACHE_CSRF_TOKEN',
        data: { site: currentSite, token }
      }).catch(() => {});
    }
  });

  // Launch queue check on product creation URL loading
  if (window.location.pathname.includes('/products/create/')) {
    console.log('[Elister Depop] Active on create product path. Checking queue...');
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LISTING' }, (response) => {
      if (response && response.success && response.data) {
        console.log('[Elister Depop] Queued listing data found:', response.data);
        executeDepopUpload(response.data);
      }
    });
  }
} 
else if (currentSite === 'elister') {
  // Flag extension as installed for React App
  document.body.dataset.elisterDepopExtensionInstalled = "true";

  // Capture dispatch window messages from React app
  window.addEventListener('message', (event) => {
    const isAllowedOrigin = event.origin.includes('elister.ai') || event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
    if (!isAllowedOrigin) return;

    if (event.data && event.data.action === 'ELISTER_DEPOP_LIST_ITEM_TRIGGER') {
      console.log('[Elister Depop] Message trigger received from application:', event.data);
      
      chrome.runtime.sendMessage({
        action: 'START_DEPOP_LISTING',
        data: event.data.data
      }, (response) => {
        console.log('[Elister Depop] Background worker acknowledged listing start:', response);
      });
    }
  });
}

// Runtime messaging handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_SESSION_STATUS') {
    const token = getAuthToken();
    sendResponse({
      success: true,
      data: {
        site: currentSite,
        username: 'Depop User',
        csrfToken: token ? `${token.substring(0, 15)}...` : null
      }
    });
  }

  else if (request.action === 'TEST_API_CONNECTION') {
    const token = getAuthToken();
    const headers = { 'accept': 'application/json' };
    if (token) headers['authorization'] = token;

    // Test a basic depop endpoint
    fetch(`https://api.depop.com/api/v1/countries/`, { headers, credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      sendResponse({ success: true, data: { status: 'Connected', details: `Countries loaded: ${data.length || 0}` } });
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
  }

  return true;
});

console.log('[Elister Depop] Content script loaded.');
