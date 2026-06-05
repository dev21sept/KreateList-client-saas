// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper: Extract CSRF Token from Vinted DOM / Cookies
function getCsrfToken() {
  // 1. Check Meta tags
  const metas = document.querySelectorAll('meta');
  for (let meta of metas) {
    const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
    const content = meta.getAttribute('content');
    if ((name.includes('csrf') || name.includes('xsrf') || name.includes('token')) && content && content.length > 20) {
      return content;
    }
  }

  // 2. Scan script tags
  const scriptCsrf = document.querySelector('script[data-name="csrf-token"]');
  if (scriptCsrf) return scriptCsrf.textContent.trim();

  // 3. Scan cookies
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    const parts = c.trim().split('=');
    const name = parts[0];
    const val = parts.slice(1).join('=');
    if (name) {
      const lowerName = name.toLowerCase();
      if ((lowerName.includes('csrf') || lowerName.includes('xsrf') || lowerName.includes('token')) && val && val.length > 20) {
        return decodeURIComponent(val);
      }
    }
  }

  return null;
}

// Helper: Process image Blob (resize and pad to 1:1 ratio, convert to JPEG, compress below 5 MB)
async function processImageBlob(originalBlob) {
  const maxDim = 1024;
  const minQuality = 0.3;
  const startQuality = 0.9;
  
  try {
    const imgBitmap = await createImageBitmap(originalBlob);
    const { width, height } = imgBitmap;
    
    // Scale down if dimensions exceed max limit
    let targetWidth = width;
    let targetHeight = height;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }
    
    // Create canvas
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
    
    // Fill background with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, squareSize, squareSize);
    
    // Center draw image
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
    
    if (blob.size > 5 * 1024 * 1024) {
      return originalBlob;
    }
    return blob;
  } catch (e) {
    console.warn('[Elister Vinted] Image process fallback:', e);
    return originalBlob;
  }
}

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper: Extract username or user link from DOM
function getUsernameFromDOM() {
  const userProfileLink = document.querySelector('a[href^="/member/"], a[href^="/users/"]');
  if (userProfileLink) {
    const href = userProfileLink.getAttribute('href');
    const parts = href.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const subparts = lastPart.split('-');
      return subparts.slice(1).join('-') || subparts[0];
    }
  }
  const userSpan = document.querySelector('.sidebar-user-info__title, .menu-item__title');
  if (userSpan) return userSpan.textContent.trim();
  return 'Guest';
}

// -------------------------------------------------------------
// Core Publisher: Dedicated High-Speed Vinted API Uploader
// -------------------------------------------------------------
async function executeVintedUpload(productData) {
  // Render floating status overlay card on page
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(10, 11, 16, 0.95);
    border: 1px solid rgba(9, 177, 186, 0.3);
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
    <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#09b1ba;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">eLister Vinted Auto-Publisher</h3>
    <div id="elister-status" style="font-size:11px;margin-bottom:10px;font-weight:500;">Initializing session...</div>
    <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
      <div id="elister-progress" style="width:0%;height:100%;background:linear-gradient(135deg, #09b1ba 0%, #22d3ee 100%);transition:width 0.3s ease;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const updateStatus = (text, percent) => {
    document.getElementById('elister-status').textContent = text;
    document.getElementById('elister-progress').style.width = `${percent}%`;
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  try {
    let csrfToken = getCsrfToken();
    if (!csrfToken) {
      const bgResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'GET_CACHED_CSRF_TOKEN', site: 'vinted' }, resolve);
      });
      if (bgResponse && bgResponse.token) {
        csrfToken = bgResponse.token;
      }
    }
    if (!csrfToken) {
      throw new Error("CSRF security token (x-csrf-token) not found. Verify you are logged into Vinted.");
    }
    
    const anonId = getCookie('anon_id');
    if (!anonId) {
      throw new Error("Vinted security cookie (anon_id) not found. Please reload Vinted and try again.");
    }

    const tempUuid = generateUUID();
    const catalogId = parseInt(productData.categoryId) || 1807;

    // Step 1: Attribute Resolutions (Conditions, Sizes, Colors, Brands, Materials)
    updateStatus("Step 1/4: Resolving Vinted listing details...", 15);
    await delay(1000);

    // Resolve Condition ID
    const conditionIdMap = {
      'new_with_tags': 6,
      'new_without_tags': 1,
      'very_good': 2,
      'good': 3,
      'satisfactory': 4
    };
    const conditionId = conditionIdMap[productData.condition] || conditionIdMap[productData.conditionId] || 2;

    // Resolve Color IDs
    let colorIds = [];
    if (productData.color) {
      try {
        const colorNames = productData.color.split(',').map(c => c.trim().toLowerCase());
        const colorsRes = await fetch(`${window.location.origin}/api/v2/colors`, {
          headers: {
            'accept': 'application/json',
            'x-csrf-token': csrfToken,
            'x-anon-id': anonId
          },
          credentials: 'include'
        });
        if (colorsRes.ok) {
          const colorsData = await colorsRes.json();
          const colorsList = colorsData.colors || [];
          for (let name of colorNames) {
            const matchedColor = colorsList.find(c => (c.title || c.name || '').toLowerCase() === name);
            if (matchedColor) {
              colorIds.push(matchedColor.id);
            }
          }
        }
      } catch (err) {
        console.warn('[Elister Vinted] Color resolution error:', err);
      }
    }
    if (colorIds.length === 0) colorIds.push(10); // Fallback Red/Brown/Multi Default Color

    // Resolve Size ID
    let sizeId = null;
    if (productData.size) {
      try {
        const sizesRes = await fetch(`${window.location.origin}/api/v2/item_upload/size_groups?catalog_ids=${catalogId}`, {
          headers: {
            'accept': 'application/json',
            'x-csrf-token': csrfToken,
            'x-anon-id': anonId
          },
          credentials: 'include'
        });
        if (sizesRes.ok) {
          const sizesData = await sizesRes.json();
          const groups = sizesData.size_groups || [];
          const userSize = productData.size.trim().toLowerCase();
          
          let matchedSize = null;
          for (let g of groups) {
            const sizes = g.sizes || [];
            matchedSize = sizes.find(s => (s.name || s.title || '').toLowerCase() === userSize || (s.equivalent_sizes && s.equivalent_sizes.us && s.equivalent_sizes.us.toLowerCase() === userSize));
            if (matchedSize) break;
          }
          if (matchedSize) {
            sizeId = matchedSize.id;
          }
        }
      } catch (err) {
        console.warn('[Elister Vinted] Size resolution error:', err);
      }
    }

    // Resolve Brand ID
    let brandId = null;
    let finalBrandName = productData.brand || '';
    if (productData.brand) {
      try {
        const brandsRes = await fetch(`${window.location.origin}/api/v2/item_upload/brands?category_id=${catalogId}&keyword=${encodeURIComponent(productData.brand)}`, {
          headers: {
            'accept': 'application/json',
            'x-csrf-token': csrfToken,
            'x-anon-id': anonId
          },
          credentials: 'include'
        });
        if (brandsRes.ok) {
          const brandsData = await brandsRes.json();
          const brandsList = brandsData.brands || [];
          const matchedBrand = brandsList.find(b => (b.title || b.name || '').toLowerCase() === productData.brand.toLowerCase());
          if (matchedBrand) {
            brandId = matchedBrand.id;
            finalBrandName = matchedBrand.title || matchedBrand.name;
          }
        }
      } catch (err) {
        console.warn('[Elister Vinted] Brand resolution error:', err);
      }
    }

    // Resolve Material IDs
    let materialIds = [];
    if (productData.material) {
      try {
        const materialNames = productData.material.split(',').map(m => m.trim().toLowerCase());
        const materialsRes = await fetch(`${window.location.origin}/api/v2/materials`, {
          headers: {
            'accept': 'application/json',
            'x-csrf-token': csrfToken,
            'x-anon-id': anonId
          },
          credentials: 'include'
        });
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          const materialsList = materialsData.materials || [];
          for (let name of materialNames) {
            const matchedMat = materialsList.find(m => (m.name || m.title || '').toLowerCase() === name);
            if (matchedMat) {
              materialIds.push(matchedMat.id);
            }
          }
        }
      } catch (err) {
        console.warn('[Elister Vinted] Material resolution for Vinted failed:', err);
      }
    }

    // Step 2: Upload Images Binary Flow
    updateStatus("Step 2/4: Preparing listing media files...", 30);
    const assignedPhotos = [];
    const images = productData.images || [];

    for (let i = 0; i < images.length; i++) {
      updateStatus(`Uploading image ${i+1} of ${images.length}...`, 30 + Math.floor((i / images.length) * 35));
      await delay(1200); // Account safety rate-limit padding

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

      // Process image size limits and format checks
      const processedBlob = await processImageBlob(imgBlob);

      const uploadPhoto = async () => {
        const formData = new FormData();
        formData.append('file', processedBlob, `file${i}.jpg`);

        return await fetch(`${window.location.origin}/api/v2/temporary_photos`, {
          method: 'POST',
          headers: {
            'accept': 'application/json,text/plain,*/*',
            'x-csrf-token': csrfToken,
            'x-anon-id': anonId
          },
          credentials: 'include',
          body: formData
        });
      };

      let uploadRes = await uploadPhoto();
      if (!uploadRes.ok) {
        console.warn(`[Elister Vinted] Upload photo error, retrying...`);
        await delay(2000);
        uploadRes = await uploadPhoto();
        if (!uploadRes.ok) {
          throw new Error(`Vinted image upload rejected for photo ${i+1}. Status: ${uploadRes.status}`);
        }
      }

      const uploadData = await uploadRes.json();
      const photoId = uploadData.id || (uploadData.photo && uploadData.photo.id);
      if (!photoId) {
        throw new Error(`No image ID returned for uploaded photo ${i+1}.`);
      }
      assignedPhotos.push({ id: photoId, orientation: 0 });
    }

    // Step 3: Run Eligibility Check
    updateStatus("Step 3/4: Verification & attribute checks...", 75);
    await delay(800);

    try {
      await fetch(`${window.location.origin}/api/v2/offline_verification/eligibility`, {
        method: 'POST',
        headers: {
          'accept': 'application/json,text/plain,*/*',
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-anon-id': anonId
        },
        credentials: 'include',
        body: JSON.stringify({
          item_attributes: [
            { field_name: "brand", value: brandId },
            { field_name: "price", value: String(productData.price) },
            { field_name: "category", value: catalogId }
          ]
        })
      });
    } catch (e) {
      console.warn('[Elister Vinted] Optional eligibility check failed. Proceeding...', e);
    }

    // Step 4: Final Item Submission
    updateStatus("Step 4/4: Publishing listing live on Vinted feed...", 85);
    await delay(1200);

    const descriptionText = productData.description + (productData.measurements ? "\n\nMeasurements:\n" + productData.measurements : "");

    const itemAttributes = [
      { code: "condition", ids: [conditionId] }
    ];
    if (materialIds.length > 0) {
      itemAttributes.push({ code: "material", ids: materialIds });
    }
    if (productData.author) {
      itemAttributes.push({ code: "author", value: productData.author });
    }
    if (productData.bookTitle) {
      itemAttributes.push({ code: "book_title", value: productData.bookTitle });
    }
    if (productData.videoGameRating) {
      // Game ratings are often integers/IDs in arrays
      const ratingId = parseInt(productData.videoGameRating);
      if (!isNaN(ratingId)) {
        itemAttributes.push({ code: "video_game_rating", ids: [ratingId] });
      }
    }

    const payload = {
      item: {
        id: null,
        currency: productData.currency || "USD",
        temp_uuid: tempUuid,
        title: productData.title,
        description: descriptionText,
        brand_id: brandId,
        brand: finalBrandName,
        catalog_id: catalogId,
        isbn: productData.isbn || null,
        is_unisex: false,
        ai_photo: false,
        price: parseFloat(productData.price) || 0.0,
        package_size_id: 1,
        shipment_prices: {
          domestic: null,
          international: null
        },
        color_ids: colorIds,
        assigned_photos: assignedPhotos,
        measurement_length: 20,
        measurement_width: 20,
        item_attributes: itemAttributes,
        manufacturer: null,
        manufacturer_labelling: null,
        size_id: sizeId
      },
      feedback_id: null,
      push_up: false,
      parcel: null,
      upload_session_id: tempUuid
    };

    const publishRes = await fetch(`${window.location.origin}/api/v2/item_upload/items`, {
      method: 'POST',
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'x-anon-id': anonId,
        'x-enable-dynamic-attribute-condition': "true",
        'x-enable-dynamic-attribute-size': "false",
        'x-enable-dynamic-attribute-video-game-rating': "true",
        'x-upload-form': "true"
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      throw new Error(`Failed to save listing attributes. Status: ${publishRes.status}. Details: ${errText}`);
    }

    const publishData = await publishRes.json();
    const itemInfo = publishData.item || {};
    const vintedId = itemInfo.id;
    const vintedPath = itemInfo.path;

    if (!vintedId) {
      throw new Error("Vinted did not return an item ID. Submission details might have been rejected.");
    }

    const vintedUrl = vintedPath ? `${window.location.origin}${vintedPath}` : `${window.location.origin}/items/${vintedId}`;
    updateStatus("Success! Listing published successfully.", 95);
    overlay.style.border = "1px solid #2ed573";

    // Call eLister backend to update status to 'published'
    if (productData.listingId && productData.token && productData.backendUrl) {
      console.log('[Elister Vinted] Updating database status to published for ID:', productData.listingId);
      try {
        const updateRes = await fetch(`${productData.backendUrl}/listings/${productData.listingId}`, {
          method: 'PUT',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${productData.token}`
          },
          body: JSON.stringify({
            status: 'published',
            vintedUrl: vintedUrl,
            vintedListingId: String(vintedId)
          })
        });
        if (updateRes.ok) {
          console.log('[Elister Vinted] Successfully updated listing status in eLister database!');
          chrome.runtime.sendMessage({ action: 'RELOAD_ELISTER_TABS' }).catch(() => {});
        } else {
          console.error('[Elister Vinted] Failed to update eLister database status:', updateRes.status);
        }
      } catch (updateErr) {
        console.error('[Elister Vinted] Database update failed:', updateErr);
      }
    }

    updateStatus("Redirecting to your live item page...", 100);
    await delay(1200);
    overlay.remove();
    window.location.href = vintedUrl;

  } catch (err) {
    console.error("[Elister Vinted Publisher Error]", err);
    updateStatus(`Upload Failed: ${err.message}`, 100);
    overlay.style.border = "1px solid #ff4757";
    document.getElementById('elister-progress').style.background = "#ff4757";
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = "Close Panel";
    closeBtn.style.cssText = "margin-top:12px;background:#ff4757;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;";
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);
  }
}

// -------------------------------------------------------------
// Global Event Initialization & Listeners
// -------------------------------------------------------------
const hostname = window.location.hostname;
const currentSite = (hostname.includes('vinted')) ? 'vinted' : (hostname.includes('elister') || hostname.includes('localhost') || hostname.includes('127.0.0.1')) ? 'elister' : 'unknown';

if (currentSite === 'vinted') {
  // Forward captured events to background service worker
  window.addEventListener('ELISTER_API_CAPTURED', (event) => {
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

  // Listen for captured CSRF tokens
  window.addEventListener('ELISTER_TOKEN_CAPTURED', (event) => {
    const token = event.detail.csrfToken;
    if (token) {
      sessionStorage.setItem('elister_captured_csrf_token', token);
      chrome.runtime.sendMessage({
        action: 'CACHE_CSRF_TOKEN',
        data: { site: currentSite, token }
      }).catch(() => {});
    }
  });

  // If on Vinted create listing page, check background queue for pending automation lists
  if (window.location.pathname.endsWith('/items/new')) {
    console.log('[Elister Vinted] Active on upload endpoint. Querying pending queue...');
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LISTING' }, (response) => {
      if (response && response.success && response.data) {
        console.log('[Elister Vinted] Found queued listing data. Launching Auto-Publisher...', response.data);
        executeVintedUpload(response.data);
      }
    });
  }
} 
else if (currentSite === 'elister') {
  // Inject extension detection attribute for the React frontend
  document.body.dataset.elisterVintedExtensionInstalled = "true";

  // If running on eLister React page, listen to messages dispatched by the web application
  window.addEventListener('message', (event) => {
    const isAllowedOrigin = event.origin.includes('elister.ai') || event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
    if (!isAllowedOrigin) return;

    if (event.data && event.data.action === 'ELISTER_VINTED_LIST_ITEM_TRIGGER') {
      console.log('[Elister Vinted] Intercepted trigger from app page:', event.data);
      
      // Dispatch data to background service worker queue
      chrome.runtime.sendMessage({
        action: 'START_VINTED_LISTING',
        data: event.data.data
      }, (response) => {
        console.log('[Elister Vinted] Background script acknowledged queue:', response);
      });
    }
  });
}

// Message Listener for Popup status queries
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_SESSION_STATUS') {
    const csrfToken = getCsrfToken();
    const username = getUsernameFromDOM();
    const anonId = getCookie('anon_id');

    sendResponse({
      success: true,
      data: {
        site: currentSite,
        username,
        csrfToken: csrfToken ? `${csrfToken.substring(0, 8)}...` : null,
        anonId: anonId ? `${anonId.substring(0, 8)}...` : null
      }
    });
  }

  else if (request.action === 'TEST_API_CONNECTION') {
    const csrf = getCsrfToken();
    const anonId = getCookie('anon_id');
    const headers = { 'Accept': 'application/json,text/plain,*/*', 'locale': 'en-US' };
    if (csrf) headers['x-csrf-token'] = csrf;
    if (anonId) headers['x-anon-id'] = anonId;

    fetch(`${window.location.origin}/api/v2/item_upload/size_groups?catalog_ids=1773`, { headers, credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      sendResponse({ success: true, data: { status: 'Authorized', details: `Size Groups count: ${data.size_groups?.length || 0}` } });
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
  }

  else if (request.action === 'FETCH_VINTED_SIZES') {
    const catalogId = request.catalogId || 1773;
    const csrf = getCsrfToken();
    const anonId = getCookie('anon_id');
    const headers = { 'Accept': 'application/json,text/plain,*/*', 'locale': 'en-US' };
    if (csrf) headers['x-csrf-token'] = csrf;
    if (anonId) headers['x-anon-id'] = anonId;

    fetch(`${window.location.origin}/api/v2/item_upload/size_groups?catalog_ids=${catalogId}`, { headers, credentials: 'include' })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
  }

  return true; 
});

console.log('[Elister Vinted] Content script initialized.');
