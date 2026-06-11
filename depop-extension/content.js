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

function backgroundFetch(url, options = {}, responseType = 'json') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'BACKGROUND_DEPOP_REQUEST',
      data: {
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null,
        responseType
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response || !response.success) {
        return reject(new Error(response?.error || 'Unknown background fetch error'));
      }
      resolve({
        ok: response.ok,
        status: response.status,
        json: async () => response.data,
        text: async () => response.data
      });
    });
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

    const uploadPhoto = async (blob, index) => {
      console.log(`[Elister Depop] Initializing image upload ${index + 1}...`);
      const initRes = await backgroundFetch("https://webapi.depop.com/api/v4/pictures/", {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': authToken
        },
        body: JSON.stringify({
          type: "product",
          extension: "jpg",
          dimensions: { width: 1280, height: 1280 }
        })
      }, 'json');

      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`Failed to initialize image upload. Status: ${initRes.status}. Details: ${errText}`);
      }

      const initData = await initRes.json();
      const photoId = initData.id || initData.picture_id || initData.pictureId;
      const uploadUrl = initData.upload_url || initData.uploadUrl;

      if (!photoId || !uploadUrl) {
        throw new Error(`Invalid response from pictures API: ${JSON.stringify(initData)}`);
      }

      console.log(`[Elister Depop] Uploading binary to S3 for image ${index + 1}...`);
      const base64String = await blobToBase64(blob);
      const putRes = await backgroundFetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: { type: 'base64', data: base64String }
      }, 'text');

      if (!putRes.ok) {
        throw new Error(`Failed to PUT binary image to S3. Status: ${putRes.status}`);
      }

      console.log(`[Elister Depop] Successfully uploaded image ${index + 1}. Photo ID: ${photoId}`);
      return photoId;
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
        const imgResponse = await backgroundFetch(images[i], { method: 'GET' }, 'base64');
        if (!imgResponse.ok) {
          throw new Error(`Failed to fetch image ${i+1}. Status: ${imgResponse.status}`);
        }
        const byteString = atob(imgResponse.data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
        imgBlob = new Blob([ab], { type: 'image/jpeg' });
      }

      const processedBlob = await processImageBlob(imgBlob);
      const photoId = await uploadPhoto(processedBlob, i);
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

    const getCountryCode = (countryName) => {
      const c = String(countryName).toLowerCase();
      if (c === 'india' || c === 'in') return 'IN';
      if (c === 'united kingdom' || c === 'uk' || c === 'gb') return 'GB';
      if (c === 'united states' || c === 'us' || c === 'usa') return 'US';
      if (c === 'australia' || c === 'au') return 'AU';
      return 'US';
    };

    const getCountryName = (code) => {
      if (code === 'IN') return 'India';
      if (code === 'GB') return 'United Kingdom';
      if (code === 'AU') return 'Australia';
      return 'United States';
    };

    const mapCondition = (cond) => {
      const c = String(cond).toLowerCase();
      if (c.includes('brand_new') || c.includes('brand new') || c.includes('nwt')) return 'brand_new';
      if (c.includes('like_new') || c.includes('like new') || c.includes('nwot') || c.includes('used_like_new')) return 'used_like_new';
      if (c.includes('excellent')) return 'used_excellent';
      if (c.includes('good') || c.includes('very_good') || c.includes('very good') || c.includes('used_good')) return 'used_good';
      if (c.includes('fair') || c.includes('used_fair')) return 'used_fair';
      return 'used_excellent';
    };

    const getGender = (categoryPath) => {
      const p = String(categoryPath).toLowerCase();
      if (p.includes('women')) return 'female';
      if (p.includes('men')) return 'male';
      return 'unisex';
    };

    const isKids = (categoryPath) => {
      return String(categoryPath).toLowerCase().includes('kids');
    };

    const getGeo = (countryCode) => {
      if (countryCode === 'IN') return { lat: 22.1991660760527, lng: 78.476681027237 };
      return { lat: 37.09024, lng: -95.712891 };
    };

    const countryCode = getCountryCode(productData.country);
    const countryName = getCountryName(countryCode);
    const geo = getGeo(countryCode);
    const condition = mapCondition(productData.conditionId || productData.selectedCondition);

    let variantSet = 54; // default
    let variantsPayload = { "5": 1 }; // default
    
    if (productData.size) {
      const match = String(productData.size).match(/^(\d+)\.(\d+)-(\w+)$/);
      if (match) {
        variantSet = parseInt(match[1]);
        const sizeId = match[2];
        variantsPayload = {};
        variantsPayload[sizeId] = parseInt(productData.quantity) || 1;
      }
    }

    const attributesPayload = {};
    if (productData.occasion) attributesPayload["occasion"] = [productData.occasion.toLowerCase()];
    if (productData.material) attributesPayload["material"] = [productData.material.toLowerCase()];
    if (productData.bodyFit) attributesPayload["body-fit"] = [productData.bodyFit.toLowerCase()];
    if (productData.fastening) attributesPayload["fastening"] = [productData.fastening.toLowerCase()];
    if (productData.fit) attributesPayload["fit"] = [productData.fit.toLowerCase()];

    const listingLifecycleId = generateUUID();
    const persistentId = generateUUID();

    const savePayload = {
      age: productData.age ? [productData.age.toLowerCase()] : ["modern"],
      address: countryName,
      attributes: attributesPayload,
      brand: (productData.brand || '').toLowerCase(),
      colour: productData.color ? [productData.color.toLowerCase()] : [],
      condition: condition,
      country: countryCode,
      description: productData.description || '',
      gender: getGender(productData.category),
      geo_position_lat: geo.lat,
      geo_position_lng: geo.lng,
      is_kids: isKids(productData.category),
      listing_lifecycle_id: listingLifecycleId,
      national_shipping_cost: parseFloat(productData.shippingPrice || 0).toFixed(2),
      picture_ids: assignedPhotos,
      price_amount: parseFloat(productData.price || 0).toFixed(2),
      price_currency: "USD",
      product_type: productData.categoryId || "shirts",
      shipping_methods: [],
      sku: productData.sku || `KL${Date.now()}`,
      source: productData.source ? [productData.source.toLowerCase()] : ["preloved"],
      style: productData.styleTag ? productData.styleTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ["casual"],
      variant_set: variantSet,
      variants: variantsPayload,
      persistent_id: persistentId,
      quantity: null
    };

    console.log('[Elister Depop] Saving product with payload:', JSON.stringify(savePayload));

    const saveRes = await backgroundFetch("https://webapi.depop.com/presentation/api/v1/listing/products/", {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': authToken
      },
      body: JSON.stringify(savePayload)
    }, 'json');

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      throw new Error(`Failed to save product details on Depop. Status: ${saveRes.status}. Details: ${errText}`);
    }

    const savedProductData = await saveRes.json();
    console.log('[Elister Depop] Save successful! Response:', savedProductData);

    // Step 4: Finalize & Success Notification
    updateStatus("Step 4/4: Listing successfully published!", 100);
    await delay(2000);
    
    // Log Activity to backend
    if (productData.backendUrl && productData.token) {
      backgroundFetch(`${productData.backendUrl}/listings/${productData.listingId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${productData.token}`
        },
        body: JSON.stringify({ status: 'published', platform: 'depop' })
      }, 'json').catch(err => console.warn('Activity log failed:', err));
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
    if (!event || !event.detail) return;
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
