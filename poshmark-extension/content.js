// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper: Extract CSRF Token from Poshmark or Vinted DOM / Cookies
function getCsrfToken(site) {
  // 1. Check sessionStorage cache first
  const cached = sessionStorage.getItem('elister_captured_csrf_token');
  if (cached) return cached;

  // 2. Try scanning all meta tags
  const metas = document.querySelectorAll('meta');
  for (let meta of metas) {
    const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
    const content = meta.getAttribute('content');
    if ((name.includes('csrf') || name.includes('xsrf') || name.includes('token')) && content && content.length > 20) {
      console.log('[Elister Extension] Extracted CSRF token from meta tag:', name);
      return content;
    }
  }

  // 3. Try reading NextJS Hydration Data from DOM script tag
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      const text = nextDataEl.textContent;
      const match = text.match(/"csrfToken"\s*:\s*"([a-zA-Z0-9_\-]{20,60})"/i) ||
                    text.match(/"xsrfToken"\s*:\s*"([a-zA-Z0-9_\-]{20,60})"/i) ||
                    text.match(/"token"\s*:\s*"([a-zA-Z0-9_\-]{20,60})"/i);
      if (match && match[1]) {
        console.log('[Elister Extension] Extracted CSRF token from __NEXT_DATA__ script tag');
        return match[1];
      }
    }
  } catch(e) {}

  // 4. Try scanning all cookies (including pattern matches)
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    const parts = c.trim().split('=');
    const name = parts[0];
    const val = parts.slice(1).join('=');
    if (name) {
      const lowerName = name.toLowerCase();
      if ((lowerName.includes('csrf') || lowerName.includes('xsrf') || lowerName.includes('token')) && val && val.length > 20) {
        console.log('[Elister Extension] Extracted CSRF token from cookie:', name);
        return decodeURIComponent(val);
      }
    }
  }

  // 5. Default legacy fallback naming checks
  if (site === 'poshmark') {
    const pmCookie = getCookie('_csrf_token') || getCookie('csrf_token') || getCookie('xsrf-token');
    if (pmCookie) return pmCookie;
  } else if (site === 'vinted') {
    const scriptCsrf = document.querySelector('script[data-name="csrf-token"]');
    if (scriptCsrf) return scriptCsrf.textContent.trim();
  }

  const generalCsrf = getCookie('csrf_token') || getCookie('authenticity_token');
  if (generalCsrf) return generalCsrf;

  return null;
}

// Helper: Extract Pre-loaded Draft ID from the page context
function findDraftIdFromDOM() {
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      const data = JSON.parse(nextDataEl.textContent);
      
      const candidates = [];
      const scan = (obj, pathArr = []) => {
        if (!obj || typeof obj !== 'object') return;
        if (pathArr.length > 25) return;
        
        for (let key in obj) {
          try {
            const val = obj[key];
            const currentPath = [...pathArr, key];
            if (typeof val === 'string' && /^[a-f0-9]{24}$/.test(val)) {
              candidates.push({
                id: val,
                key: key,
                path: currentPath.join('.'),
                parent: obj
              });
            } else if (val && typeof val === 'object') {
              scan(val, currentPath);
            }
          } catch(e) {}
        }
      };
      
      scan(data);
      
      // Score candidates
      const scored = candidates.map(c => {
        let score = 10;
        const pathLower = c.path.toLowerCase();
        const keyLower = c.key.toLowerCase();
        
        // Exclude user, brand, category, feature, department etc.
        if (
          pathLower.includes('user') ||
          pathLower.includes('seller') ||
          pathLower.includes('creator') ||
          pathLower.includes('owner') ||
          pathLower.includes('actor') ||
          pathLower.includes('brand') ||
          pathLower.includes('category') ||
          pathLower.includes('feature') ||
          pathLower.includes('department') ||
          pathLower.includes('color') ||
          pathLower.includes('size') ||
          pathLower.includes('sharing') ||
          pathLower.includes('follow') ||
          pathLower.includes('like')
        ) {
          score -= 200;
        }
        
        if (c.id.endsWith('8c10d97b4e1245005764')) {
          score -= 200; // standard Poshmark category/department ID pattern
        }
        
        // Match draft/post/listing keys
        if (
          keyLower === 'postid' ||
          keyLower === 'post_id' ||
          keyLower === 'listingid' ||
          keyLower === 'listing_id' ||
          keyLower === 'draftid' ||
          keyLower === 'draft_id' ||
          keyLower === 'currentpostid' ||
          keyLower === 'current_post_id'
        ) {
          score += 100;
        } else if (keyLower === 'id') {
          const parentKey = c.path.split('.').slice(-2, -1)[0] || '';
          const parentKeyLower = parentKey.toLowerCase();
          if (
            parentKeyLower === 'post' ||
            parentKeyLower === 'listing' ||
            parentKeyLower === 'draft' ||
            parentKeyLower === 'current_post' ||
            parentKeyLower === 'currentpost'
          ) {
            score += 90;
          } else {
            score += 40;
          }
        }
        
        // Structural check
        const parentKeys = Object.keys(c.parent);
        const hasListingKeys = parentKeys.some(k => 
          ['title', 'description', 'price', 'brand', 'pictures', 'cover_shot', 'inventory', 'autolist_draft'].includes(k)
        );
        if (hasListingKeys) {
          score += 30;
        }
        
        return { ...c, score };
      });
      
      scored.sort((a, b) => b.score - a.score);
      console.log('[Elister Extension] Scored draft candidates from __NEXT_DATA__:', scored.map(s => ({ id: s.id, path: s.path, score: s.score })));
      
      if (scored.length > 0 && scored[0].score > 0) {
        console.log('[Elister Extension] Selected draft ID from __NEXT_DATA__:', scored[0].id, 'score:', scored[0].score);
        return scored[0].id;
      }
    }
  } catch (e) {
    console.error('[Elister Extension] Error parsing __NEXT_DATA__:', e);
  }

  try {
    const rawText = document.documentElement.innerHTML;
    // Match keys with or without quotes, followed by : or =, followed by a 24-character hex ID in single/double quotes
    const regex = /(?:"?postId"?|"?post_id"?|"?listingId"?|"?listing_id"?|"?draftId"?|"?draft_id"?)\s*[:=]\s*['"]([a-f0-9]{24})['"]/gi;
    let match;
    const matches = [];
    while ((match = regex.exec(rawText)) !== null) {
      const id = match[1];
      if (id && !id.endsWith('8c10d97b4e1245005764')) {
        matches.push(id);
      }
    }
    if (matches.length > 0) {
      console.log('[Elister Extension] Found draft ID candidates in HTML regex:', matches);
      return matches[0];
    }
  } catch(e) {}

  return null;
}
// Helper: Process image Blob (resize to square 1:1, convert to JPEG, size limit)
async function processImageBlob(originalBlob) {
  const maxDim = 1024;
  const minQuality = 0.3; // allow more compression if needed
  const startQuality = 0.9;
  console.log('[Elister] processImageBlob called – original size:', originalBlob.size, 'type:', originalBlob.type);
  try {
    const imgBitmap = await createImageBitmap(originalBlob);
    const { width, height } = imgBitmap;
    
    // Resize image maintaining aspect ratio
    let targetWidth = width;
    let targetHeight = height;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }
    
    // Force square 1:1 aspect ratio by adding white padding (standard for Poshmark)
    const squareSize = Math.max(targetWidth, targetHeight);
    
    // Choose canvas implementation
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
    
    // Fill canvas background with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, squareSize, squareSize);
    
    // Draw image centered in the square canvas
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
        const mime = parts[0].match(/:(.*?);/)[1];
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
    console.log('[Elister] processImageBlob result – size:', blob.size, 'type:', blob.type, 'final quality:', quality);
    // If still too large, fallback to original blob to avoid upload rejection
    if (blob.size > 5 * 1024 * 1024) {
      console.warn('[Elister] Processed image still >5 MB, using original blob');
      return originalBlob;
    }
    // expose globally for debugging (optional)
    window.processImageBlob = processImageBlob;
    return blob;
  } catch (e) {
    console.warn('[Elister] Image processing failed, using original blob:', e);
    return originalBlob;
  }
}

// --- Fallback version for environments without OffscreenCanvas ---
if (typeof OffscreenCanvas === 'undefined') {
  // Helper to convert DataURL to Blob
  function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(','), mime = parts[0].match(/:(.*?);/)[1];
    const bstr = atob(parts[1]);
    let n = bstr.length, u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
  }

  // Redefine processImageBlob using HTMLCanvasElement
  // expose globally for debugging
  window.processImageBlob = processImageBlob;
}


// Helper: Extract Username from DOM
function getUsernameFromDOM(site) {
  if (site === 'poshmark') {
    // 1. Try finding link containing "/closet/" (supports absolute and relative URLs)
    const navProfileLink = document.querySelector('a[href*="/closet/"]');
    if (navProfileLink) {
      const href = navProfileLink.getAttribute('href');
      const parts = href.split('/closet/');
      if (parts[1]) {
        const username = parts[1].split(/[?#/]/)[0];
        if (username && username !== 'drafts') {
          console.log('[Elister Extension] Extracted username from closet link:', username);
          return username;
        }
      }
    }
    
    // 2. Try scanning __NEXT_DATA__ script tag
    try {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        const text = nextDataEl.textContent;
        const match = text.match(/"username"\s*:\s*"([a-zA-Z0-9_\-]+)"/i) || 
                      text.match(/"creator_username"\s*:\s*"([a-zA-Z0-9_\-]+)"/i);
        if (match && match[1] && match[1] !== 'Guest') {
          console.log('[Elister Extension] Extracted username from __NEXT_DATA__:', match[1]);
          return match[1];
        }
      }
    } catch(e) {}
    
    // 3. Try meta author fallback
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) return metaAuthor.getAttribute('content');
  } else if (site === 'vinted') {
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
  }

  return 'Guest';
}

// Determine current website
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('poshmark')) return 'poshmark';
  if (hostname.includes('vinted')) return 'vinted';
  if (hostname.includes('elister') || hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'elister';
  return 'unknown';
}



// -------------------------------------------------------------
// Core Publisher: 4-Step High-Speed Poshmark API Uploader
// -------------------------------------------------------------
async function executePoshmarkUpload(productData) {
  // Render floating status overlay card on page
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(10, 11, 16, 0.95);
    border: 1px solid rgba(255, 71, 87, 0.3);
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
    <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#ff4757;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">eLister Auto-Publisher</h3>
    <div id="elister-status" style="font-size:11px;margin-bottom:10px;font-weight:500;">Initializing draft...</div>
    <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
      <div id="elister-progress" style="width:0%;height:100%;background:linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);transition:width 0.3s ease;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const updateStatus = (text, percent) => {
    document.getElementById('elister-status').textContent = text;
    document.getElementById('elister-progress').style.width = `${percent}%`;
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  try {
    let csrfToken = getCsrfToken('poshmark');
    if (!csrfToken) {
      // Async fallback to background worker cache
      const bgResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'GET_CACHED_CSRF_TOKEN', site: 'poshmark' }, resolve);
      });
      if (bgResponse && bgResponse.token) {
        csrfToken = bgResponse.token;
      }
    }
    if (!csrfToken) {
      throw new Error("CSRF security token (x-xsrf-token) not found. Verify you are logged into Poshmark.");
    }
    
    // Step 1: Resolve Poshmark Draft ID
    updateStatus("Step 1/4: Resolving draft session on Poshmark...", 15);
    await delay(1200); // Natural human delay
    
    let draftId = findDraftIdFromDOM();
    if (!draftId) {
      draftId = sessionStorage.getItem('elister_captured_draft_id');
    }
    
    if (!draftId) {
      console.warn('[Elister Extension] Draft ID not found in DOM. Attempting fallback API generation...');
      try {
        const draftRes = await fetch(`/vm-rest/posts?pm_version=2026.23.01`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-xsrf-token': csrfToken,
            'x-csrf-token': csrfToken
          },
          credentials: 'include',
          mode: 'cors',
          body: JSON.stringify({ post: { autolist_draft: false } })
        });
        if (draftRes.ok) {
          let draftData;
          try {
            draftData = await draftRes.json();
          } catch (e) {
            console.error('[Elister Extension] Failed to parse fallback draft response:', e);
          }
          if (draftData) {
            if (draftData.post && draftData.post.id) {
              draftId = draftData.post.id;
            } else if (draftData.id) {
              draftId = draftData.id;
            }
          }
        }
      } catch (e) {
        console.error('[Elister Extension] Fallback draft API failed:', e);
      }
    }
    
    if (!draftId) {
      throw new Error("Could not extract Poshmark Draft ID from page context or fallback API. Ensure you are on the Poshmark Create Listing page.");
    }
    
    console.log('[Elister Extension] Resolved Poshmark Draft ID successfully:', draftId);
    
    // Step 2: Upload Images Binary Flow
    updateStatus("Step 2/4: Preparing listing media files...", 30);
    const uploadedMediaIds = [];
    const images = productData.images || [];
    
    for (let i = 0; i < images.length; i++) {
      updateStatus(`Uploading image ${i+1} of ${images.length}...`, 30 + Math.floor((i / images.length) * 35));
      await delay(1500); // 1.5s delay to keep account safe & anti-spam
      
      // Prepare image Blob (data URL or fetch)
      let imgBlob;
      if (images[i].startsWith('data:')) {
        // Convert data URL to Blob
        const byteString = atob(images[i].split(',')[1]);
        const mimeString = images[i].split(',')[0].match(/data:(.*?);/)[1] || 'image/jpeg';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) {
          ia[j] = byteString.charCodeAt(j);
        }
        imgBlob = new Blob([ab], { type: mimeString });
      } else {
        // Fetch image normally with CORS enabled
        const imgResponse = await fetch(images[i], {mode: 'cors'});
        if (!imgResponse.ok) {
          const errText = await imgResponse.text();
          throw new Error(`Failed to fetch image ${i+1}: ${imgResponse.status}. Response: ${errText}`);
        }
        imgBlob = await imgResponse.blob();
      }

      // ALWAYS process image to standard JPEG to prevent Poshmark background processing failures (e.g. with webp, octet-stream, or high-res)
      const tryUpload = async (rawBlob, index) => {
        console.log(`[Elister] Processing photo ${index + 1}...`);
        const processedBlob = await processImageBlob(rawBlob);
        
        const formData = new FormData();
        formData.append('file', processedBlob, `file${index}.jpg`);
        
        const upload = async () => {
          return await fetch(`/api/posts/${draftId}/media/scratch?app_type=web`, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'x-xsrf-token': csrfToken,
              'x-csrf-token': csrfToken
            },
            credentials: 'include',
            mode: 'cors',
            body: formData
          });
        };
        
        let res = await upload();
        if (!res.ok) {
          console.warn(`[Elister] Upload error for image ${index + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          res = await upload();
          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Failed to upload product photo ${index + 1}. Status: ${res.status}. Response: ${errBody}`);
          }
        }
        return res;
      };

      const uploadRes = await tryUpload(imgBlob, i);

      let uploadData;
      try {
        uploadData = await uploadRes.json();
      } catch (parseErr) {
        throw new Error(`Failed to parse image ${i+1} upload response. Status: ${uploadRes.status}: ${parseErr.message}`);
      }
      
      const mediaId = uploadData.id || (uploadData.media && uploadData.media.id);
      if (!mediaId) {
        throw new Error(`No image ID returned for uploaded photo ${i+1}. Response: ${JSON.stringify(uploadData)}`);
      }
      uploadedMediaIds.push(mediaId);
    }
    
    // Deduplicate cover_shot from the pictures list.
    // Poshmark expects cover_shot to contain the main picture ID, and pictures to contain only the additional picture IDs.
    const coverShotPayload = uploadedMediaIds.length > 0 ? { id: uploadedMediaIds[0] } : null;
    const picturesPayload = uploadedMediaIds.slice(1).map(id => ({ id }));
    
    // Step 3: Save Listing Details & Mappings
    updateStatus("Step 3/4: Saving listing details & categories...", 75);
    await delay(1200);
    
    // Validate colors against allowed Poshmark color list
    const allowedColors = new Set([
      'White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Brown', 'Gray', 'Orange', 'Beige', 'Navy', 'Teal', 'Maroon', 'Olive', 'Gold', 'Silver'
    ]);
    // Normalize and filter colors
    let filteredColors = [];
    if (Array.isArray(productData.colors)) {
      filteredColors = productData.colors.filter(c => {
        const norm = typeof c === 'string' ? c.trim() : '';
        return allowedColors.has(norm);
      }).slice(0, 2);
    }

    // Map and sanitize condition
    const mapCondition = (cond) => {
      const c = String(cond || '').toLowerCase();
      if (c === 'nwt') return 'nwt';
      if (c === 'like_new' || c === 'like new' || c === 'uln' || c === 'nwot') return 'like_new';
      if (c === 'good' || c === 'euc' || c === 'vguc' || c === 'guc') return 'good';
      if (c === 'fair') return 'fair';
      return 'like_new'; // Default fallback
    };

    const savePayload = {
      post: {
        title: productData.title,
        description: productData.description,
        brand: productData.brand || "",
        condition: mapCondition(productData.condition),
        price_amount: {
          val: parseFloat(productData.price) || 0,
          currency_code: "USD",
          currency_symbol: "$"
        },
        original_price_amount: {
          val: parseFloat(productData.originalPrice || 0) || 0,
          currency_code: "USD",
          currency_symbol: "$"
        },
        catalog: {
          department: productData.departmentId,
          category: productData.categoryId,
          category_features: productData.subcategoryIds || []
        },
        colors: filteredColors,
        style_tags: productData.styleTags || [],
        pictures: picturesPayload,
        cover_shot: coverShotPayload,
        inventory: {
          status: "available",
          multi_item: false,
          size_quantity_revision: 0,
          size_quantities: [
            {
              size_id: productData.size || "OS",
              size_obj: {
                id: productData.size || "OS",
                short: productData.size || "OS",
                long: productData.size || "OS",
                display: productData.size || "OS",
                display_with_size_set: productData.size || "OS",
                display_with_size_system: `US ${productData.size || "OS"}`,
                display_with_system_and_set: `US ${productData.size || "OS"}`,
                equivalent_sizes: {},
                size_system: "us"
              },
              quantity_available: 1,
              quantity_sold: 0,
              size_system: "us",
              size_set_tags: ["standard"]
            }
          ]
        },
        offer_auto_actions_v2_enabled: false,
        seller_private_info: {},
        autolist_draft: false,
        seller_shipping_discount: { id: null }
      }
    };

    let saveData;
    let saveSuccess = false;
    let useCondition = true;
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Elister] Save details attempt ${attempt} of ${maxRetries}...`);
      
      const currentPayload = JSON.parse(JSON.stringify(savePayload));
      if (!useCondition) {
        delete currentPayload.post.condition;
      }

      const saveRes = await fetch(`/vm-rest/posts/${draftId}?pm_version=2026.23.01`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-xsrf-token': csrfToken,
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify(currentPayload)
      });
      let responseData;
      try {
        responseData = await saveRes.json();
      } catch (parseErr) {
        if (!saveRes.ok) throw new Error(`Failed to save product attributes. Status: ${saveRes.status}`);
        throw new Error(`Failed to parse save details response. Server returned status ${saveRes.status}: ${parseErr.message}`);
      }
      if (responseData && responseData.error) {
        const errMsg = responseData.error.errorMessage || responseData.error.userMessage || responseData.error.errorType || "";
        if (errMsg.includes("Error processing image") && attempt < maxRetries) {
          console.warn(`[Elister] Poshmark server still processing images. Retrying in 2.5 seconds...`);
          await delay(2500);
          continue;
        }
        if (errMsg.toLowerCase().includes("invalid condition") && useCondition) {
          console.warn(`[Elister] Poshmark returned invalid condition error: ${errMsg}. Retrying without condition field...`);
          useCondition = false;
          continue;
        }
        throw new Error(errMsg || "Failed to save details.");
      }
      if (!saveRes.ok) throw new Error(`Failed to save product attributes. Status: ${saveRes.status}`);
      saveSuccess = true;
      break;
    }
    
    // Step 4: Publish Listing
    updateStatus("Step 4/4: Activating listing live on Poshmark feed...", 90);
    await delay(1500);
    
    const publishRes = await fetch(`/vm-rest/posts/${draftId}/status/published?app_version=2.55&pm_version=2026.23.01`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-xsrf-token': csrfToken,
        'x-csrf-token': csrfToken
      },
      credentials: 'include',
      mode: 'cors',
      body: "{}"
    });
    if (!publishRes.ok) throw new Error(`Failed to set status to published. Status: ${publishRes.status}`);
    let publishData;
    try {
      publishData = await publishRes.json();
    } catch (parseErr) {
      throw new Error(`Failed to parse publish response. Server returned status ${publishRes.status}: ${parseErr.message}`);
    }
    if (publishData && publishData.error) {
      throw new Error(publishData.error.errorMessage || publishData.error.userMessage || publishData.error.errorType || "Failed to publish listing.");
    }
    const finalStatus = publishData.status || (publishData.post && publishData.post.status);
    if (finalStatus && finalStatus !== 'published') {
      throw new Error(`Listing status is not published (current status: ${finalStatus}).`);
    }
    
    updateStatus("Success! Listing published successfully.", 100);
    overlay.style.border = "1px solid #2ed573";
    await delay(1800);
    
    // Redirect closet to verify
    let username = getUsernameFromDOM('poshmark');
    if (!username || username === 'Guest') {
      try {
        const userRes = await fetch(`/vm-rest/posts/${draftId}?pm_version=2026.23.01`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-xsrf-token': csrfToken,
            'x-csrf-token': csrfToken
          },
          credentials: 'include',
          mode: 'cors'
        });
        if (userRes.ok) {
          let postData;
          try {
            postData = await userRes.json();
          } catch (e) {
            console.error('[Elister Extension] Failed to parse username lookup response:', e);
          }
          if (postData) {
            const parsedUsername = postData.creator_username || 
                                   postData.creator_display_handle ||
                                   (postData.post && (postData.post.creator_username || postData.post.creator_display_handle));
            if (parsedUsername) {
              username = parsedUsername;
              console.log('[Elister Extension] Extracted username from post details API:', username);
            }
          }
        }
      } catch (e) {
        console.error('[Elister Extension] Failed to fetch username from post details API:', e);
      }
    }
    
    if (username && username !== 'Guest') {
      overlay.remove();
      window.location.href = `https://poshmark.com/closet/${username}?created_listing_id=${draftId}`;
    } else {
      console.warn('[Elister Extension] Username is Guest. Skipping redirect. Post details can be checked manually.');
      updateStatus("Published! Redirect skipped (username not found).", 100);
      overlay.style.border = "1px solid #ffb142";
      
      const closeBtn = document.createElement('button');
      closeBtn.textContent = "Close Panel";
      closeBtn.style.cssText = "margin-top:12px;background:#ffb142;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;";
      closeBtn.onclick = () => overlay.remove();
      overlay.appendChild(closeBtn);
    }
    
  } catch (err) {
    console.error("[Elister Publisher Error]", err);
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
const currentSite = detectSite();

if (currentSite === 'poshmark' || currentSite === 'vinted') {

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

  // Listen for captured Draft IDs
  window.addEventListener('ELISTER_DRAFT_ID_CAPTURED', (event) => {
    const draftId = event.detail.draftId;
    if (draftId) {
      sessionStorage.setItem('elister_captured_draft_id', draftId);
    }
  });

  // If on Poshmark create listing page, check background queue for pending automation lists
  if (window.location.pathname.includes('/create-listing')) {
    chrome.runtime.sendMessage({ action: 'GET_PENDING_LISTING' }, (response) => {
      if (response && response.success && response.data) {
        console.log('[Elister Extension] Found queued listing data. Launching Auto-Publisher...', response.data);
        executePoshmarkUpload(response.data);
      }
    });
  }
} 
else if (currentSite === 'elister') {
  // Inject extension detection attribute for the React frontend
  document.body.dataset.elisterExtensionInstalled = "true";

  // If running on eLister React page, listen to messages dispatched by the web application
  window.addEventListener('message', (event) => {
    // Basic origin filtering for security
    const isAllowedOrigin = event.origin.includes('elister.ai') || event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
    if (!isAllowedOrigin) return;

    if (event.data && event.data.action === 'ELISTER_LIST_ITEM_TRIGGER') {
      console.log('[Elister Extension] Intercepted trigger from app page:', event.data);
      
      // Dispatch data to background service worker queue
      chrome.runtime.sendMessage({
        action: 'START_POSHMARK_LISTING',
        data: event.data.data
      }, (response) => {
        console.log('[Elister Extension] Background script acknowledged queue:', response);
      });
    }
  });
}

// Message Listener for Popup status queries
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_SESSION_STATUS') {
    const csrfToken = getCsrfToken(currentSite);
    const username = getUsernameFromDOM(currentSite);
    const anonId = currentSite === 'vinted' ? getCookie('anon_id') : null;

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
    if (currentSite === 'poshmark') {
      fetch(`${window.location.origin}/api/v1/users/self`, {
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': getCsrfToken('poshmark'),
          'X-XSRF-Token': getCsrfToken('poshmark')
        },
        credentials: 'include',
        mode: 'cors'
      })
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, data: { status: 'Authorized', username: data.username } });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    } 
    else if (currentSite === 'vinted') {
      const csrf = getCsrfToken('vinted');
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
  }

  else if (request.action === 'LOAD_CLOSET_DATA') {
    if (currentSite === 'poshmark') {
      const csrf = getCsrfToken('poshmark');
      fetch(`${window.location.origin}/api/v1/users/self`, {
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': csrf,
          'X-XSRF-Token': csrf
        },
        credentials: 'include',
        mode: 'cors'
      })
      .then(res => res.json())
      .then(profile => {
        const username = profile.username;
        return fetch(`${window.location.origin}/api/v1/users/${username}/posts?request_context=closet&count=15`, {
          headers: {
            'Accept': 'application/json',
            'X-CSRF-Token': csrf,
            'X-XSRF-Token': csrf
          },
          credentials: 'include',
          mode: 'cors'
        });
      })
      .then(res => res.json())
      .then(postsData => {
        const listings = (postsData.data || []).map(post => ({
          id: post.id, title: post.title, price: post.price, brand: post.brand, size: post.size, inventory_status: post.inventory_status
        }));
        sendResponse({ success: true, data: { listings } });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    }
  }

  else if (request.action === 'FETCH_VINTED_SIZES') {
    if (currentSite !== 'vinted') return;
    const catalogId = request.catalogId || 1773;
    const csrf = getCsrfToken('vinted');
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

console.log('[Elister Extension] Content script initialized.');
