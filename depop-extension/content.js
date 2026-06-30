// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper: Extract Depop Bearer Token from Session Storage
function getAuthToken() {
  const domToken = document.documentElement.getAttribute('data-elister-auth-token');
  if (domToken) return domToken;
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
        text: async () => typeof response.data === 'object' && response.data !== null && response.data.type === 'base64' ? response.data.data : response.data
      });
    });
  });
}

let fetchRequestIdCounter = 0;
const pendingFetchRequests = new Map();

window.addEventListener('ELISTER_DEPOP_FETCH_RESPONSE', (event) => {
  if (!event || !event.detail) return;
  const { requestId, success, ok, status, data, error } = event.detail;
  const promise = pendingFetchRequests.get(requestId);
  if (promise) {
    pendingFetchRequests.delete(requestId);
    if (success) {
      promise.resolve({
        ok,
        status,
        json: async () => data,
        text: async () => {
          if (typeof data === 'object' && data !== null) {
            if (data.type === 'base64') return data.data;
            return JSON.stringify(data);
          }
          return data;
        }
      });
    } else {
      promise.reject(new Error(error || 'Fetch failed in page context'));
    }
  }
});

function pageContextFetch(url, options = {}, responseType = 'json') {
  return new Promise((resolve, reject) => {
    const requestId = ++fetchRequestIdCounter;
    pendingFetchRequests.set(requestId, { resolve, reject });
    
    window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_EXECUTE_FETCH', {
      detail: {
        requestId,
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null,
        responseType
      }
    }));
    
    setTimeout(() => {
      if (pendingFetchRequests.has(requestId)) {
        pendingFetchRequests.delete(requestId);
        reject(new Error('Page context fetch timed out'));
      }
    }, 45000);
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
  if (!document.body) {
    await new Promise(resolve => {
      if (document.body) return resolve();
      window.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

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
    if (!document.body.contains(overlay)) {
      console.log('[Elister Depop] Overlay was removed from DOM. Re-appending...');
      document.body.appendChild(overlay);
    }
    const statusEl = document.getElementById('elister-status');
    const progressEl = document.getElementById('elister-progress');
    if (statusEl) statusEl.textContent = text;
    if (progressEl) progressEl.style.width = `${percent}%`;
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
      updateStatus("Waiting for Depop authentication session (up to 10s)...", 5);
      for (let attempt = 0; attempt < 50; attempt++) {
        await delay(200);
        authToken = getAuthToken();
        if (!authToken) {
          const bgResponse = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'GET_CACHED_CSRF_TOKEN', site: 'depop' }, resolve);
          });
          if (bgResponse && bgResponse.token) {
            authToken = bgResponse.token;
          }
        }
        if (authToken) {
          break;
        }
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
      const initRes = await pageContextFetch("https://webapi.depop.com/api/v4/pictures/", {
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
        if (initRes.status === 403) {
          sessionStorage.removeItem('elister_captured_depop_token');
          chrome.runtime.sendMessage({ action: 'CACHE_CSRF_TOKEN', data: { site: 'depop', token: null } }).catch(() => {});
          throw new Error("Depop authorization session expired (403 Forbidden). Please open Depop, log out and log back in, and then try again.");
        }
        const errText = await initRes.text();
        throw new Error(`Failed to initialize image upload. Status: ${initRes.status}. Details: ${errText}`);
      }

      const initData = await initRes.json();
      const photoId = initData.id || initData.picture_id || initData.pictureId || initData.sid;
      const uploadUrl = initData.url || initData.upload_url || initData.uploadUrl;

      if (!photoId || !uploadUrl) {
        throw new Error(`Invalid response from pictures API: ${JSON.stringify(initData)}`);
      }

      console.log(`[Elister Depop] Uploading binary to S3 for image ${index + 1}...`);
      const base64String = await blobToBase64(blob);
      const putRes = await pageContextFetch(uploadUrl, {
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
        const base64Str = await imgResponse.text();
        const byteString = atob(base64Str);
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
      if (c === 'india' || c === 'in') return 'IN'; // Keep as IN
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
    let variantsPayload = {};
    if (productData.size) {
      const catId = (productData.categoryId || '').toLowerCase();
      const isMens = String(productData.category || '').toLowerCase().includes('men');
      const isBottom = catId.includes('bottom') || catId.includes('jeans') || catId.includes('trousers') || catId.includes('shorts');
      
      const match = String(productData.size).match(/^(\d+)\.(\d+)-(\w+)$/);
      let sizeName = '';
      if (match) {
        variantSet = parseInt(match[1]);
        const sizeId = match[2];
        sizeName = match[3] || '';
        variantsPayload[sizeId] = parseInt(productData.quantity) || 1;
      } else {
        sizeName = String(productData.size).trim().toUpperCase();
        const standardSizes = {
          'XXS': '1', 'XS': '2', 'S': '3', 'M': '4', 'L': '5', 'XL': '6', 'XXL': '7', '3XL': '8', '4XL': '9',
          'ONE SIZE': '90', 'OS': '90'
        };
        const sizeId = standardSizes[sizeName] || '4'; // Default to M
        variantsPayload[sizeId] = parseInt(productData.quantity) || 1;
      }

      // Auto-correct variant set and size ID if it's Men's category but using Women's variant set
      if (isMens) {
        if (!isBottom) {
          variantSet = 54;
          const mensTopsSizes = {
            'XXS': '1', 'XS': '2', 'S': '3', 'M': '4', 'L': '5', 'XL': '6', 'XXL': '7', '3XL': '8', '4XL': '9',
            'ONE SIZE': '90', 'OS': '90'
          };
          let resolvedSizeName = sizeName.toUpperCase();
          if (match && (variantSet !== 54)) {
            const womensUSMap = { '15': 'XS', '16': 'S', '17': 'M', '18': 'L', '19': 'XL', '20': 'XXL' };
            resolvedSizeName = womensUSMap[match[2]] || resolvedSizeName;
          }
          const sizeId = mensTopsSizes[resolvedSizeName] || '4';
          variantsPayload = { [sizeId]: parseInt(productData.quantity) || 1 };
        } else {
          variantSet = 56;
          let waistVal = sizeName.replace(/[^0-9]/g, '');
          if (!waistVal) waistVal = '32'; // Default waist
          variantsPayload = { [waistVal]: parseInt(productData.quantity) || 1 };
        }
      }
    }

    // Resolve allowed attributes for the selected category
    let allowedAttributes = productData.allowedAttributes;
    if (!allowedAttributes || allowedAttributes.length === 0) {
      // Fallback: guess allowed attributes based on categoryId
      const catId = (productData.categoryId || '').toLowerCase();
      const isBottoms = catId.includes('bottom') || catId.includes('jeans') || catId.includes('trousers') || catId.includes('skirt') || catId.includes('shorts') || catId.includes('jogger');
      const isFootwear = catId.includes('footwear') || catId.includes('shoes') || catId.includes('trainers') || catId.includes('sandals') || catId.includes('boots');
      const isBeauty = catId.includes('beauty') || catId.includes('skincare') || catId.includes('makeup');
      
      allowedAttributes = ["occasion", "material"];
      if (isBottoms) {
        allowedAttributes.push("bottom-fit", "bottom-style", "body-fit", "size-fit");
      } else if (isFootwear) {
        allowedAttributes.push("trainers-type", "heel-type", "shoe-type", "fastening", "size-fit");
      } else if (isBeauty) {
        allowedAttributes = ["beauty-type"];
      } else {
        // Tops / dresses / general apparel
        allowedAttributes.push("body-fit", "size-fit");
      }
    }

    const attributesPayload = {};
    if (productData.occasion && allowedAttributes.includes("occasion")) {
      attributesPayload["occasion"] = [productData.occasion.toLowerCase()];
    }
    if (productData.material && allowedAttributes.includes("material")) {
      attributesPayload["material"] = [productData.material.toLowerCase()];
    }
    if (productData.bodyFit && allowedAttributes.includes("body-fit")) {
      attributesPayload["body-fit"] = [productData.bodyFit.toLowerCase()];
    }
    if (productData.fastening && allowedAttributes.includes("fastening")) {
      attributesPayload["fastening"] = [productData.fastening.toLowerCase()];
    }

    // Dynamic mapping for 'fit' based on what key the category supports
    if (productData.fit) {
      const normalizedFit = productData.fit.toLowerCase();
      if (allowedAttributes.includes("bottom-fit")) {
        attributesPayload["bottom-fit"] = [normalizedFit];
      } else if (allowedAttributes.includes("size-fit")) {
        attributesPayload["size-fit"] = [normalizedFit];
      } else if (allowedAttributes.includes("dress-length")) {
        attributesPayload["dress-length"] = [normalizedFit];
      } else if (allowedAttributes.includes("heel-type")) {
        attributesPayload["heel-type"] = [normalizedFit];
      } else if (allowedAttributes.includes("fit")) {
        attributesPayload["fit"] = [normalizedFit];
      }
    }

    // Dynamic mapping for 'depopType' based on what key the category supports
    if (productData.depopType) {
      const normalizedType = productData.depopType.toLowerCase();
      const typeAttrs = [
        "bottom-style", "dress-type", "coat-type", "jacket-type", 
        "jumpssuit-type", "dungarees-type", "trainers-type", 
        "shoe-type", "boot-type", "beauty-type"
      ];
      const matchedAttr = allowedAttributes.find(attr => typeAttrs.includes(attr));
      if (matchedAttr) {
        attributesPayload[matchedAttr] = [normalizedType];
      }
    }

    let shippingMethods = [];
    let sellerAddress = countryName;
    let sellerGeo = geo;
    let sellerCountry = countryCode;

    try {
      updateStatus("Resolving shipping preferences...", 70);
      const addrRes = await backgroundFetch('https://webapi.depop.com/api/v1/shop/seller-addresses/', {
        method: 'GET',
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }, 'json');

      if (addrRes && addrRes.ok) {
        const addresses = await addrRes.json();
        if (addresses && addresses.length > 0) {
          const activeAddress = addresses[0];
          const addressId = activeAddress.id || activeAddress.address_id;
          
          sellerAddress = activeAddress.city || activeAddress.town || countryName;
          sellerCountry = activeAddress.country || countryCode;
          sellerGeo = {
            lat: activeAddress.geo_position_lat || geo.lat,
            lng: activeAddress.geo_position_lng || geo.lng
          };

          const providersRes = await backgroundFetch(`https://webapi.depop.com/api/v1/shop/seller-addresses/${addressId}/shipping-providers/`, {
            method: 'GET',
            headers: {
              'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }, 'json');

          if (providersRes && providersRes.ok) {
            const providers = await providersRes.json();
            if (providers && providers.length > 0) {
              const firstProvider = providers[0];
              const sizeObj = (firstProvider.parcel_sizes && firstProvider.parcel_sizes.find(s => s.name === 'medium')) || (firstProvider.parcel_sizes && firstProvider.parcel_sizes[0]) || {};
              
              shippingMethods = [{
                shipping_provider_id: firstProvider.id,
                parcel_size_id: sizeObj.id,
                shipping_type: 'depop',
                price: parseFloat(productData.shippingPrice || 0).toFixed(2)
              }];
              console.log('[Elister Depop] Resolved shipping method dynamically:', shippingMethods);
            }
          }
        }
      }
    } catch (shipErr) {
      console.error('[Elister Depop] Failed to fetch shipping preferences:', shipErr);
    }

    const listingLifecycleId = generateUUID();
    const persistentId = generateUUID();

    const savePayload = {
      age: productData.age ? [productData.age.toLowerCase()] : ["modern"],
      address: sellerAddress,
      attributes: attributesPayload,
      brand: (productData.brand || '').toLowerCase(),
      colour: productData.color ? [productData.color.toLowerCase()] : [],
      condition: condition,
      country: sellerCountry,
      description: productData.description || '',
      gender: getGender(productData.category),
      geo_position_lat: sellerGeo.lat,
      geo_position_lng: sellerGeo.lng,
      is_kids: isKids(productData.category),
      listing_lifecycle_id: listingLifecycleId,
      national_shipping_cost: parseFloat(productData.shippingPrice || 0).toFixed(2),
      picture_ids: assignedPhotos,
      price_amount: parseFloat(productData.price || 0).toFixed(2),
      price_currency: "USD",
      product_type: productData.categoryId || "shirts",
      shipping_methods: shippingMethods,
      sku: productData.sku || `KL${Date.now()}`,
      source: productData.source ? [productData.source.toLowerCase()] : ["preloved"],
      style: productData.styleTag ? productData.styleTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ["casual"],
      variant_set: variantSet,
      variants: variantsPayload,
      persistent_id: persistentId,
      quantity: null
    };

    console.log('[Elister Depop] Saving product with payload:', JSON.stringify(savePayload));

    const saveRes = await pageContextFetch("https://webapi.depop.com/presentation/api/v1/listing/products/", {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': authToken
      },
      body: JSON.stringify(savePayload)
    }, 'json');

    if (!saveRes.ok) {
      if (saveRes.status === 403) {
        sessionStorage.removeItem('elister_captured_depop_token');
        chrome.runtime.sendMessage({ action: 'CACHE_CSRF_TOKEN', data: { site: 'depop', token: null } }).catch(() => {});
        throw new Error("Depop authorization session expired (403 Forbidden). Please open Depop, log out and log back in, and then try again.");
      }
      const errText = await saveRes.text();
      throw new Error(`Failed to save product details on Depop. Status: ${saveRes.status}. Details: ${errText}`);
    }

    const savedProductData = await saveRes.json();
    console.log('[Elister Depop] Save successful! Response:', savedProductData);

    const depopId = savedProductData.id || '';
    const depopSlug = savedProductData.slug || '';
    const depopUrl = depopSlug ? `https://www.depop.com/products/${depopSlug}/` : (depopId ? `https://www.depop.com/products/${depopId}/` : 'https://www.depop.com/');

    // Log Activity & save live ID/URL to backend
    if (productData.backendUrl && productData.token && productData.listingId) {
      console.log('[Elister Depop] Updating database status and live URL for ID:', productData.listingId);
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
            platform: 'depop',
            depopUrl: depopUrl,
            depopListingId: String(depopId)
          })
        });
        
        console.log('[Elister Depop] Database update response status:', updateRes.status);
        // Reload elister tabs to show status updates on frontend
        chrome.runtime.sendMessage({ action: 'RELOAD_ELISTER_TABS' }).catch(() => {});
      } catch (updateErr) {
        console.error('[Elister Depop] Database update failed:', updateErr);
      }
    }

    // Step 4: Finalize & Success Notification
    updateStatus("Step 4/4: Listing successfully published!", 100);
    await delay(1200);

    overlay.style.border = '1px solid #2ed573';
    overlay.innerHTML = `
      <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#2ed573;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">Success!</h3>
      <div style="font-size:11px;margin-bottom:10px;font-weight:500;color:#f5f6fa;">Your listing has been published to Depop! Redirecting...</div>
    `;
    
    await delay(1500);
    overlay.remove();
    window.location.href = depopUrl;

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

function getUsernameFromToken(token) {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const parts = cleanToken.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = atob(payloadBase64);
      const payloadObj = JSON.parse(decodedPayload);
      console.log('[Elister Depop] Decoded JWT Token payload:', payloadObj);
      if (payloadObj.username) return payloadObj.username;
      if (payloadObj.username_canonical) return payloadObj.username_canonical;
      if (payloadObj.sub) return payloadObj.sub;
    }
  } catch (e) {
    console.error('[Elister Depop] Error decoding JWT token:', e);
  }
  return null;
}

function getUsernameFromDOM() {
  try {
    // Prioritize header navigation to avoid footer links like /blog/, /careers/, etc.
    const header = document.querySelector('header') || document.querySelector('[class*="Header"]') || document.querySelector('[class*="navigation"]') || document.querySelector('[class*="Nav"]');
    const anchors = header ? header.querySelectorAll('a[href]') : document.querySelectorAll('a[href]');
    
    const excluded = ['login', 'register', 'search', 'settings', 'products', 'create', 'category', 'bag', 'cart', 'messages', 'notifications', 'help', 'terms', 'privacy', 'explore', 'shop', 'blog', 'careers', 'press', 'about', 'community', 'safety', 'support', 'news', 'cookies', 'sell', 'buy', 'download', 'featured', 'editorial', 'sitemap', 'jobs', 'advertise', 'terms-of-service'];
    
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      if (!href) continue;
      
      const cleanHref = href.replace(/^https:\/\/www\.depop\.com/, '').trim();
      if (cleanHref.startsWith('/') && cleanHref.endsWith('/')) {
        const parts = cleanHref.split('/').filter(Boolean);
        if (parts.length === 1) {
          const potentialUser = parts[0];
          if (/^[a-z0-9_-]{3,20}$/i.test(potentialUser)) {
            if (!excluded.includes(potentialUser.toLowerCase())) {
              return potentialUser;
            }
          }
        }
      }
    }

    const images = document.querySelectorAll('img[alt]');
    for (const img of images) {
      const alt = img.getAttribute('alt') || '';
      const match = alt.match(/^([a-z0-9_-]+)'s\s+profile/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.error('[Elister Depop] Error scraping username from DOM:', e);
  }
  return null;
}

function getDepopUsername() {
  // 0. Check sessionStorage for intercepted username
  try {
    const sessionUser = sessionStorage.getItem('elister_captured_depop_username');
    if (sessionUser) {
      console.log('[Elister Depop] Resolved username from captured session:', sessionUser);
      return sessionUser;
    }
  } catch (e) {}

  // 1. Try to get username from JWT token
  const token = getAuthToken();
  if (token) {
    const usernameFromToken = getUsernameFromToken(token);
    if (usernameFromToken && isNaN(usernameFromToken)) {
      console.log('[Elister Depop] Resolved username from JWT token:', usernameFromToken);
      return usernameFromToken;
    }
  }

  // 2. Scan ALL localStorage keys for "username"
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (val && val.includes('username')) {
        const match = val.match(/"username"\s*:\s*"([a-zA-Z0-9_\-\.]+)"/i);
        if (match && match[1] && isNaN(match[1])) {
          console.log('[Elister Depop] Found username in localStorage key:', key, 'value:', match[1]);
          return match[1];
        }
      }
    }
  } catch (e) {}

  // 3. Scan ALL sessionStorage keys for "username"
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      const val = sessionStorage.getItem(key);
      if (val && val.includes('username')) {
        const match = val.match(/"username"\s*:\s*"([a-zA-Z0-9_\-\.]+)"/i);
        if (match && match[1] && isNaN(match[1])) {
          console.log('[Elister Depop] Found username in sessionStorage key:', key, 'value:', match[1]);
          return match[1];
        }
      }
    }
  } catch (e) {}

  // 4. Scan Document Cookies for username/user
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const parts = cookie.trim().split('=');
      const name = parts[0];
      const val = parts.slice(1).join('=');
      if (name && (name.toLowerCase().includes('username') || name.toLowerCase() === 'user')) {
        if (val && /^[a-z0-9_-]{3,20}$/i.test(val) && isNaN(val)) {
          console.log('[Elister Depop] Found username in cookie:', name, 'value:', val);
          return val;
        }
      }
    }
  } catch (e) {}

  // 5. Parse DOM profile links
  const domUser = getUsernameFromDOM();
  if (domUser) {
    console.log('[Elister Depop] Found username in DOM:', domUser);
    return domUser;
  }

  // 6. Parse pathname if on profile
  try {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && !['products', 'create', 'settings', 'search', 'category', 'login', 'register'].includes(pathParts[0])) {
      console.log('[Elister Depop] Found username in pathname:', pathParts[0]);
      return pathParts[0];
    }
  } catch (e) {}

  return null;
}

let isResolvingUsername = false;
let lastApiResolveTime = 0;

async function resolveUsernameFromApi(token) {
  // Rate limit: Only allow API resolution once every 5 seconds to prevent 429 spam
  const now = Date.now();
  if (isResolvingUsername || (now - lastApiResolveTime < 5000)) {
    console.log('[Elister Depop] API resolution locked or rate-limited. Skipping to prevent 429 spam.');
    return null;
  }

  isResolvingUsername = true;
  lastApiResolveTime = now;

  try {
    // 1. Try the settings API first via direct page-context fetch (includes cookies automatically)
    try {
      console.log('[Elister Depop] Fetching settings via page-context fetch...');
      const res = await window.fetch('https://webapi.depop.com/presentation/api/v1/users/me/settings/', {
        method: 'GET',
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[Elister Depop] Settings API response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Elister Depop] Settings API response data:', data);
        const resolvedUser = data.username || data.username_canonical || data.usernameCanonical || data.sub;
        if (resolvedUser) {
          console.log('[Elister Depop] Resolved username from settings API:', resolvedUser);
          return resolvedUser;
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('[Elister Depop] Settings API returned non-OK status. Body:', errText);
      }
    } catch (err) {
      console.error('[Elister Depop] Failed to fetch settings from Depop API:', err);
    }

    // 2. Fallback to auth session API via direct page-context fetch
    try {
      console.log('[Elister Depop] Fetching session via page-context fetch...');
      const res = await window.fetch('https://webapi.depop.com/api/v1/auth/session', {
        method: 'GET',
        headers: {
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[Elister Depop] Session API response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Elister Depop] Session API response data:', data);
        const resolvedUser = data.username || data.username_canonical || data.usernameCanonical || data.sub;
        if (resolvedUser) {
          console.log('[Elister Depop] Resolved username from session API:', resolvedUser);
          return resolvedUser;
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('[Elister Depop] Session API returned non-OK status. Body:', errText);
      }
    } catch (err) {
      console.error('[Elister Depop] Failed to fetch session from Depop API:', err);
    }
  } finally {
    isResolvingUsername = false;
  }
  return null;
}

async function checkAndCompleteConnection() {
  const token = getAuthToken();
  if (!token) return;

  let username = getDepopUsername();
  if (!username) {
    console.log('[Elister Depop] Username not found in storage/URL. Resolving from API...');
    const apiUsername = await resolveUsernameFromApi(token);
    if (apiUsername) username = apiUsername;
  }

  console.log('[Elister Depop] Checking connection status:', { username, hasToken: !!token });

  if (!username) {
    console.warn('[Elister Depop] Could not resolve Depop username. Using fallback "depop_user" to complete connection.');
    username = 'depop_user';
  }

  chrome.runtime.sendMessage({ action: 'GET_CONNECT_FLOW' }, (response) => {
    if (response && response.success && response.flow) {
      console.log('[Elister Depop] Active Depop connection flow detected! Syncing with backend...');
      chrome.runtime.sendMessage({
        action: 'COMPLETE_DEPOP_CONNECT',
        data: {
          username: username,
          accessToken: token.startsWith('Bearer ') ? token : `Bearer ${token}`
        }
      }, (res) => {
        console.log('[Elister Depop] COMPLETE_DEPOP_CONNECT response:', res);
      });
    }
  });
}

if (currentSite === 'depop') {
  if (window.location.search.includes('elister_background_publish=true')) {
    console.log('[Elister Depop] Active on background publish tab! Initializing API publish...');
    
    // Helper to convert base64 to Blob
    const base64ToBlob = (base64Data) => {
      const parts = base64Data.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    };

    const publishDepopViaPageContext = async (listing, token) => {
      try {
        console.log('[Page Context Publisher] Starting background publish for:', listing.title);
        const base64Images = listing.base64Images || [];
        const pictureIds = [];

        // Step 1: Upload Images
        for (let i = 0; i < Math.min(base64Images.length, 4); i++) {
          try {
            console.log(`[Page Context Publisher] Converting base64 image ${i + 1} (length: ${base64Images[i].length})...`);
            const imgBlob = base64ToBlob(base64Images[i]);

            console.log(`[Page Context Publisher] Initializing image upload ${i + 1} on Depop...`);
            let initRes;
            try {
              initRes = await window.fetch('https://webapi.depop.com/api/v4/pictures/', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
                },
                body: JSON.stringify({
                  type: "product",
                  extension: "jpg",
                  dimensions: { width: 1280, height: 1280 }
                }),
                credentials: 'include'
              });
            } catch (fetchErr) {
              console.error(`[Page Context Publisher] Fetching pictures init API failed:`, fetchErr);
              throw new Error(`Failed to initialize picture upload API call: ${fetchErr.message}`);
            }

            if (!initRes.ok) {
              const errBody = await initRes.text().catch(() => '');
              throw new Error(`Failed to initialize picture upload: Status ${initRes.status}. Details: ${errBody}`);
            }

            const initData = await initRes.json();
            const photoId = initData.id || initData.picture_id || initData.pictureId || initData.sid;
            const uploadUrl = initData.url || initData.upload_url || initData.uploadUrl;

            if (!photoId || !uploadUrl) {
              throw new Error(`Invalid response structure: ${JSON.stringify(initData)}`);
            }

            console.log(`[Page Context Publisher] Uploading image ${i + 1} to S3 URL:`, uploadUrl.substring(0, 80));
            let putRes;
            try {
              putRes = await window.fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'image/jpeg'
                },
                body: imgBlob
              });
            } catch (s3Err) {
              console.error(`[Page Context Publisher] S3 upload fetch failed:`, s3Err);
              throw new Error(`S3 upload fetch failed: ${s3Err.message}`);
            }

            if (!putRes.ok) {
              throw new Error(`Failed to upload image to S3: Status ${putRes.status}`);
            }

            pictureIds.push(photoId);
            console.log(`[Page Context Publisher] Upload success for image ${i + 1}. ID: ${photoId}`);
          } catch (imgErr) {
            console.error(`[Page Context Publisher] Failed to upload image ${i + 1}:`, imgErr);
            throw new Error(`Depop Image Upload Failed: ${imgErr.message}`);
          }
        }

        if (pictureIds.length === 0) {
          throw new Error('No images were successfully uploaded to Depop.');
        }

        // Step 2: Resolve Listing Attributes
        const mapCondition = (cond) => {
          const c = String(cond || '').toLowerCase();
          if (c.includes('brand_new') || c.includes('brand new') || c.includes('nwt')) return 'brand_new';
          if (c.includes('like_new') || c.includes('like new') || c.includes('nwot') || c.includes('used_like_new')) return 'used_like_new';
          if (c.includes('excellent')) return 'used_excellent';
          if (c.includes('good') || c.includes('very_good') || c.includes('very good') || c.includes('used_good')) return 'used_good';
          if (c.includes('fair') || c.includes('used_fair')) return 'used_fair';
          return 'used_excellent';
        };

        const getGender = (cat) => {
          const c = String(cat || '').toLowerCase();
          if (c.includes('women')) return 'female';
          if (c.includes('men')) return 'male';
          return 'unisex';
        };

        let shippingMethods = [];
        let sellerAddress = "United States";
        let sellerGeo = { lat: 37.09024, lng: -95.712891 };
        let sellerCountry = "US";

        try {
          console.log('[Page Context Publisher] Fetching seller addresses...');
          const addrRes = await window.fetch('https://webapi.depop.com/api/v1/shop/seller-addresses/', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
            },
            credentials: 'include'
          });

          if (addrRes.ok) {
            const addrData = await addrRes.json();
            if (addrData && addrData.length > 0) {
              const activeAddress = addrData[0];
              const addressId = activeAddress.id || activeAddress.address_id;
              
              sellerAddress = activeAddress.city || activeAddress.town || "United States";
              sellerCountry = activeAddress.country || "US";
              sellerGeo = {
                lat: activeAddress.geo_position_lat || 37.09024,
                lng: activeAddress.geo_position_lng || -95.712891
              };

              console.log(`[Page Context Publisher] Fetching shipping providers for address: ${addressId}`);
              const providersRes = await window.fetch(`https://webapi.depop.com/api/v1/shop/seller-addresses/${addressId}/shipping-providers/`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
                },
                credentials: 'include'
              });

              if (providersRes.ok) {
                const providersData = await providersRes.json();
                if (providersData && providersData.length > 0) {
                  const firstProvider = providersData[0];
                  const sizeObj = (firstProvider.parcel_sizes && firstProvider.parcel_sizes.find(s => s.name === 'medium')) || (firstProvider.parcel_sizes && firstProvider.parcel_sizes[0]) || {};
                  
                  shippingMethods = [{
                    shipping_provider_id: firstProvider.id,
                    parcel_size_id: sizeObj.id,
                    shipping_type: 'depop',
                    price: parseFloat(listing.shippingPrice || 0).toFixed(2)
                  }];
                  console.log('[Page Context Publisher] Dynamically resolved shipping method:', shippingMethods);
                }
              }
            }
          }
        } catch (shipErr) {
          console.error('[Page Context Publisher] Failed to resolve shipping details dynamically:', shipErr.message);
        }

        // Build listing creation payload
        const savePayload = {
          age: listing.age ? [listing.age.toLowerCase()] : ["modern"],
          address: sellerAddress,
          attributes: {},
          brand: (listing.brand || '').toLowerCase(),
          colour: listing.color ? [listing.color.toLowerCase()] : [],
          condition: mapCondition(listing.selectedCondition || listing.conditionId),
          country: sellerCountry,
          description: listing.description || '',
          gender: getGender(listing.category),
          geo_position_lat: sellerGeo.lat,
          geo_position_lng: sellerGeo.lng,
          is_kids: String(listing.category).toLowerCase().includes('kids'),
          listing_lifecycle_id: window.crypto.randomUUID(),
          national_shipping_cost: parseFloat(listing.shippingPrice || 0).toFixed(2),
          picture_ids: pictureIds,
          price_amount: parseFloat(listing.price || 0).toFixed(2),
          price_currency: "USD",
          product_type: listing.categoryId || "shirts",
          shipping_methods: shippingMethods,
          sku: listing.sku || `KL${Date.now()}`,
          source: listing.source ? [listing.source.toLowerCase()] : ["preloved"],
          style: listing.styleTag ? listing.styleTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ["casual"],
          variant_set: (() => {
            const catId = (listing.categoryId || '').toLowerCase();
            const isBottom = catId.includes('bottom') || catId.includes('jeans') || catId.includes('trousers') || catId.includes('shorts');
            const isMens = String(listing.category || '').toLowerCase().includes('men');
            
            if (isMens) {
              return isBottom ? 56 : 54;
            }
            
            if (listing.size) {
              const match = String(listing.size).match(/^(\d+)\.(\d+)-(\w+)$/);
              if (match) return parseInt(match[1]);
            }
            return 54; // default
          })(),
          variants: (() => {
            const catId = (listing.categoryId || '').toLowerCase();
            const isBottom = catId.includes('bottom') || catId.includes('jeans') || catId.includes('trousers') || catId.includes('shorts');
            const isMens = String(listing.category || '').toLowerCase().includes('men');
            const qty = parseInt(listing.quantity) || 1;
            
            let sizeName = '';
            let match = null;
            if (listing.size) {
              match = String(listing.size).match(/^(\d+)\.(\d+)-(\w+)$/);
              if (match) {
                sizeName = match[3] || '';
              } else {
                sizeName = String(listing.size).trim().toUpperCase();
              }
            }
            
            if (isMens) {
              if (!isBottom) {
                const mensTopsSizes = {
                  'XXS': '1', 'XS': '2', 'S': '3', 'M': '4', 'L': '5', 'XL': '6', 'XXL': '7', '3XL': '8', '4XL': '9',
                  'ONE SIZE': '90', 'OS': '90'
                };
                let resolvedSizeName = sizeName.toUpperCase();
                if (match) {
                  const womensUSMap = { '15': 'XS', '16': 'S', '17': 'M', '18': 'L', '19': 'XL', '20': 'XXL' };
                  resolvedSizeName = womensUSMap[match[2]] || resolvedSizeName;
                }
                const sizeId = mensTopsSizes[resolvedSizeName] || '4';
                return { [sizeId]: qty };
              } else {
                let waistVal = sizeName.replace(/[^0-9]/g, '');
                if (!waistVal) waistVal = '32';
                return { [waistVal]: qty };
              }
            }
            
            // Default / Women's / Kids
            if (listing.size && match) {
              return { [match[2]]: qty };
            } else if (listing.size) {
              const standardSizes = {
                'XXS': '1', 'XS': '2', 'S': '3', 'M': '4', 'L': '5', 'XL': '6', 'XXL': '7', '3XL': '8', '4XL': '9',
                'ONE SIZE': '90', 'OS': '90'
              };
              const sizeId = standardSizes[sizeName] || '4';
              return { [sizeId]: qty };
            }
            return { "4": qty }; // Default M
          })(),
          persistent_id: window.crypto.randomUUID(),
          quantity: null
        };

        console.log('[Page Context Publisher] Step 2: Creating listing on Depop...');
        const saveRes = await window.fetch('https://webapi.depop.com/presentation/api/v1/listing/products/', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
          },
          body: JSON.stringify(savePayload),
          credentials: 'include'
        });

        if (!saveRes.ok) {
          const errBody = await saveRes.text().catch(() => '');
          throw new Error(`Failed to create product listing: Status ${saveRes.status}. Details: ${errBody}`);
        }

        const saveData = await saveRes.json();
        const depopId = saveData.id || saveData.slug;
        const depopUrl = `https://www.depop.com/products/${saveData.slug || depopId}/`;
        
        console.log('[Page Context Publisher] Successfully created listing on Depop:', depopId);
        return { success: true, id: depopId, url: depopUrl };

      } catch (err) {
        console.error('[Page Context Publisher] Error during publish:', err.message);
        return { success: false, error: err.message };
      }
    };

    chrome.storage.local.get(['backgroundPublishData'], async (resData) => {
      const data = resData.backgroundPublishData;
      if (!data) {
        console.error('[Elister Depop] No background publish data found.');
        chrome.runtime.sendMessage({ action: 'BACKGROUND_PUBLISH_RESULT', result: { success: false, error: 'No listing data found' } });
        return;
      }
      
      const publishResult = await publishDepopViaPageContext(data.listing, data.token);
      chrome.runtime.sendMessage({ action: 'BACKGROUND_PUBLISH_RESULT', result: publishResult });
    });
  }

  // Listen for username captured event from interceptor
  window.addEventListener('ELISTER_DEPOP_USERNAME_CAPTURED', (event) => {
    const username = event.detail.username;
    if (username) {
      console.log('[Elister Depop] Username captured event received:', username);
      checkAndCompleteConnection();
    }
  });

  // Check immediately on load
  setTimeout(checkAndCompleteConnection, 1000);

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

      // Parse username from pathname if on profile
      let username = getDepopUsername();

      chrome.runtime.sendMessage({
        action: 'CACHE_CONNECTION_DETAILS',
        platform: 'depop',
        data: {
          username,
          accessToken: token.startsWith('Bearer ') ? token : `Bearer ${token}`
        }
      }).catch(() => {});

      // Check and complete connection if redirect flow is active
      checkAndCompleteConnection();
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

    if (event.data && event.data.action === 'ELISTER_DEPOP_PUBLISH_BACKGROUND_TRIGGER') {
      console.log('[Elister Depop] Direct API publish trigger received from application:', event.data);
      const { listing, token } = event.data;
      chrome.runtime.sendMessage({
        action: 'PUBLISH_DEPOP_BACKGROUND',
        data: { listing, token }
      }, (response) => {
        console.log('[Elister Depop] Direct API publish background response:', response);
        window.postMessage({
          action: 'ELISTER_DEPOP_PUBLISH_BACKGROUND_RESPONSE',
          success: response.success,
          id: response.id,
          url: response.url,
          error: response.error
        }, '*');
      });
    }

    else if (event.data && event.data.action === 'ELISTER_START_CONNECT_FLOW' && event.data.platform === 'depop') {
      console.log('[Elister Depop] Initiating Depop Connect Flow with credentials...');
      const { token, backendUrl, frontendUrl } = event.data;
      chrome.runtime.sendMessage({
        action: 'START_DEPOP_CONNECT_FLOW',
        data: { token, backendUrl, frontendUrl }
      });
    }

    // Capture automatic connection trigger from settings
    else if (event.data && event.data.action === 'ELISTER_GET_CONNECTION_DETAILS' && event.data.platform === 'depop') {
      console.log('[Elister Depop] Fetching cached Depop connection details...');
      chrome.runtime.sendMessage({
        action: 'GET_CONNECTION_DETAILS',
        platform: 'depop'
      }, (response) => {
        if (response && response.success && response.data) {
          console.log('[Elister Depop] Sending connection details back to app...');
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'depop',
            success: true,
            data: response.data
          }, '*');
        } else {
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'depop',
            success: false,
            error: 'Session details not found in extension cache. Please login/open Depop tab.'
          }, '*');
        }
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
