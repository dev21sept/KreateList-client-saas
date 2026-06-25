// Helper: Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper: Extract CSRF Token from Poshmark or Vinted DOM / Cookies
function getCsrfToken(site) {
  // Check DOM attribute set by interceptor first to prevent race conditions
  const domCsrf = document.documentElement.getAttribute('data-elister-csrf-token');
  if (domCsrf) return domCsrf;

  // 1. Check sessionStorage cache first
  const cached = sessionStorage.getItem('elister_captured_csrf_token');
  if (cached) return cached;

  // 2. Try specific meta tags first
  const specificMeta = document.querySelector('meta[name="csrf-token"]') || 
                       document.querySelector('meta[name="xsrf-token"]') || 
                       document.querySelector('meta[name="csrf_token"]');
  if (specificMeta) {
    const content = specificMeta.getAttribute('content');
    if (content && content.length > 10) {
      console.log('[Elister Extension] Extracted CSRF token from specific meta tag:', specificMeta.getAttribute('name'));
      return content;
    }
  }

  // 3. Try specific cookies first
  const pmCookie = getCookie('_csrf') || getCookie('_csrf_token') || getCookie('csrf_token') || getCookie('xsrf-token') || getCookie('authenticity_token');
  if (pmCookie && pmCookie.length > 10) {
    console.log('[Elister Extension] Extracted CSRF token from specific cookie');
    return pmCookie;
  }

  // 4. Try scanning all meta tags
  const metas = document.querySelectorAll('meta');
  for (let meta of metas) {
    const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
    const content = meta.getAttribute('content');
    if ((name.includes('csrf') || name.includes('xsrf') || name.includes('token')) && content && content.length > 20) {
      console.log('[Elister Extension] Extracted CSRF token from meta tag:', name);
      return content;
    }
  }

  // 5. Try reading NextJS Hydration Data from DOM script tag
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

  // 6. Try scanning all cookies (including pattern matches)
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    const parts = c.trim().split('=');
    const name = parts[0];
    const val = parts.slice(1).join('=');
    if (name) {
      const lowerName = name.toLowerCase();
      if ((lowerName.includes('csrf') || lowerName.includes('xsrf') || lowerName.includes('token')) && val && val.length > 20) {
        const decoded = decodeURIComponent(val);
        console.log('[Elister Extension] Extracted CSRF token from cookie:', name);
        return decoded;
      }
    }
  }

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
    // 0. Try reading from Poshmark 'ui' cookie
    try {
      const cookies = document.cookie.split(';');
      for (let c of cookies) {
        const parts = c.trim().split('=');
        if (parts[0] === 'ui') {
          const decoded = decodeURIComponent(parts.slice(1).join('='));
          const uiObj = JSON.parse(decoded);
          if (uiObj && uiObj.dh) {
            console.log('[Elister Extension] Extracted username from ui cookie:', uiObj.dh);
            return uiObj.dh;
          }
        }
      }
    } catch (e) {
      console.error('[Elister Extension] Error parsing ui cookie:', e);
    }

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
  }

  return 'Guest';
}

// Determine current website
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('poshmark')) return 'poshmark';
  if (hostname.includes('elister') || hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'elister';
  return 'unknown';
}



// Helper: Translate legacy/mismatched Poshmark category and department IDs to actual Poshmark IDs
function normalizePoshmarkIds(deptId, catId) {
  const NATIVE_CATEGORIES = new Set([
    '00248975d97b4e80ef00a955', '002a8975d97b4e80ef00a955', '00108975d97b4e80ef00a955',
    '00148975d97b4e80ef00a955', '001a8975d97b4e80ef00a955', '001c8975d97b4e80ef00a955',
    '00268975d97b4e80ef00a955', '001e8975d97b4e80ef00a955', '00128975d97b4e80ef00a955',
    '00168975d97b4e80ef00a955', '00188975d97b4e80ef00a955', '03008c10d97b4e1245005764',
    '02008c10d97b4e1245005764', '04008c10d97b4e1245005764', '05008c10d97b4e1245005764',
    '06008c10d97b4e1245005764', '07008c10d97b4e1245005764', '08008c10d97b4e1245005764',
    '09008c10d97b4e1245005764', '0b008c10d97b4e1245005764', '21008c10d97b4e1245005764',
    '22008c10d97b4e1245005764', '23008c10d97b4e1245005764', '29008c10d97b4e1245005764',
    '2e008c10d97b4e1245005764', '000e8975d97b4e80ef00a955', '01008c10d97b4e1245005764',
    '20008c10d97b4e1245005764', '5b3b13d30640fd0aeb9c5cb6', 'af08bf904024037d7a7b5fad',
    '583c7d134024035188906153', '5d1cb37951e70e1762c90bc7'
  ]);

  if (catId && NATIVE_CATEGORIES.has(catId)) {
    let resolvedDeptId = deptId;
    if (catId.endsWith('d97b4e80ef00a955')) {
      resolvedDeptId = '000e8975d97b4e80ef00a955'; // Women
    } else if (catId.endsWith('d97b4e1245005764')) {
      if (catId.startsWith('2')) {
        resolvedDeptId = '20008c10d97b4e1245005764'; // Kids
      } else {
        resolvedDeptId = '01008c10d97b4e1245005764'; // Men
      }
    } else {
      resolvedDeptId = catId; // Home, Pets, Electronics, Beauty departments match category ID
    }
    return { departmentId: resolvedDeptId, categoryId: catId };
  }

  let resolvedDeptId = deptId;
  let resolvedCatId = catId;

  // 1. Normalize department ID
  if (resolvedDeptId === '01008c10d97b4e1245005763') {
    resolvedDeptId = '000e8975d97b4e80ef00a955'; // Women
  } else if (resolvedDeptId === '01008c10d97b4e1245005765') {
    resolvedDeptId = '20008c10d97b4e1245005764'; // Kids
  } else if (resolvedDeptId === '5c464bf26e4757c3d221aa90') {
    resolvedDeptId = '5b3b13d30640fd0aeb9c5cb6'; // Home
  } else if (resolvedDeptId === '60abfaa1a415ff1c2ee1df39') {
    resolvedDeptId = 'af08bf904024037d7a7b5fad'; // Pets
  } else if (resolvedDeptId === '60abfa98bfd32f1465e902b7') {
    resolvedDeptId = '583c7d134024035188906153'; // Electronics
  }

  // 2. Map legacy category IDs
  if (resolvedCatId && typeof resolvedCatId === 'string') {
    const catPrefix = resolvedCatId.substring(0, 8);
    
    // Women department
    if (resolvedDeptId === '000e8975d97b4e80ef00a955') {
      const womenMap = {
        '02008c10': '00248975d97b4e80ef00a955', // Bags
        '09008c10': '002a8975d97b4e80ef00a955', // Accessories
        '0b008c10': '00108975d97b4e80ef00a955', // Dresses
        '08008c10': '00148975d97b4e80ef00a955', // Jackets & Coats
        '04008c10': '001a8975d97b4e80ef00a955', // Jeans
        '05008c10': '001c8975d97b4e80ef00a955', // Pants
        '03008c10': '00268975d97b4e80ef00a955', // Shoes
        '06008c10': '001e8975d97b4e80ef00a955', // Shorts
        '0c008c10': '00128975d97b4e80ef00a955', // Skirts
        '0d008c10': '00168975d97b4e80ef00a955', // Sweaters
        '07008c10': '00188975d97b4e80ef00a955'  // Tops
      };
      if (womenMap[catPrefix]) {
        resolvedCatId = womenMap[catPrefix];
      }
    }
    
    // Kids department
    else if (resolvedDeptId === '20008c10d97b4e1245005764') {
      const kidsMap = {
        '09008c10': '21008c10d97b4e1245005764', // Accessories
        '0b008c10': '22008c10d97b4e1245005764', // Dresses
        '08008c10': '23008c10d97b4e1245005764', // Jackets & Coats
        '03008c10': '29008c10d97b4e1245005764', // Shoes
        '07008c10': '2e008c10d97b4e1245005764'  // Shirts & Tops
      };
      if (kidsMap[catPrefix]) {
        resolvedCatId = kidsMap[catPrefix];
      }
    }
    
    // Men department
    else if (resolvedDeptId === '01008c10d97b4e1245005764') {
      const menMap = {
        '02008c10': '03008c10d97b4e1245005764', // Bags (mapped 02 to 03)
        '09008c10': '02008c10d97b4e1245005764', // Accessories (mapped 09 to 02)
        '08008c10': '04008c10d97b4e1245005764', // Jackets & Coats (mapped 08 to 04)
        '04008c10': '05008c10d97b4e1245005764', // Jeans (mapped 04 to 05)
        '05008c10': '06008c10d97b4e1245005764', // Pants (mapped 05 to 06)
        '07008c10': '07008c10d97b4e1245005764', // Shirts
        '03008c10': '08008c10d97b4e1245005764', // Shoes (mapped 03 to 08)
        '06008c10': '09008c10d97b4e1245005764', // Shorts (mapped 06 to 09)
        '0d008c10': '0b008c10d97b4e1245005764'  // Sweaters (mapped 0d to 0b)
      };
      if (menMap[catPrefix]) {
        resolvedCatId = menMap[catPrefix];
      }
    }
  }

  return { departmentId: resolvedDeptId, categoryId: resolvedCatId };
}

// Helper: Map Poshmark category paths (e.g. "Men > Shirts > Casual Button Down Shirts") to hex IDs
function resolvePoshmarkCategory(path) {
  const defaultRes = {
    department: '01008c10d97b4e1245005764', // Men
    category: '07008c10d97b4e1245005764', // Shirts
    subcategories: []
  };

  if (!path || typeof path !== 'string') return defaultRes;

  const parts = path.split('>').map(p => p.trim());
  if (parts.length === 0) return defaultRes;

  // Resolve Department
  const deptName = parts[0].toLowerCase();
  const DEPARTMENTS = {
    'men': '01008c10d97b4e1245005764',
    'women': '000e8975d97b4e80ef00a955',
    'kids': '20008c10d97b4e1245005764',
    'home': '5b3b13d30640fd0aeb9c5cb6',
    'pets': 'af08bf904024037d7a7b5fad',
    'electronics': '583c7d134024035188906153',
    'beauty': '5d1cb37951e70e1762c90bc7'
  };
  
  // Support matching by name or by legacy ID strings
  let deptId = DEPARTMENTS[deptName] || DEPARTMENTS['men'];
  if (deptName.includes('women') || deptName === '01008c10d97b4e1245005763') {
    deptId = '000e8975d97b4e80ef00a955';
  } else if (deptName.includes('kids') || deptName === '01008c10d97b4e1245005765') {
    deptId = '20008c10d97b4e1245005764';
  } else if (deptName.includes('home') || deptName === '5c464bf26e4757c3d221aa90') {
    deptId = '5b3b13d30640fd0aeb9c5cb6';
  } else if (deptName.includes('pets') || deptName === '60abfaa1a415ff1c2ee1df39') {
    deptId = 'af08bf904024037d7a7b5fad';
  } else if (deptName.includes('electronics') || deptName === '60abfa98bfd32f1465e902b7') {
    deptId = '583c7d134024035188906153';
  }

  if (parts.length < 2) {
    return { department: deptId, category: '', subcategories: [] };
  }

  const catName = parts[1];
  const subcatName = parts[2] || '';

  // 1. Try to find the exact hex IDs recursively from __NEXT_DATA__ or script tags
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      const nextData = JSON.parse(nextDataEl.textContent);
      
      const findCategoryIdsFromObject = (obj, deptName, catName, subcatName) => {
        if (!obj || typeof obj !== 'object') return null;
        
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const res = findCategoryIdsFromObject(item, deptName, catName, subcatName);
            if (res) return res;
          }
        } else {
          if (Array.isArray(obj.departments) && obj.departments.length > 0 && obj.departments[0].categories) {
            const depts = obj.departments;
            const dName = String(deptName || '').toLowerCase();
            const dept = depts.find(d => String(d.display || d.name || '').toLowerCase() === dName);
            if (dept) {
              const cName = String(catName || '').toLowerCase();
              const cat = (dept.categories || []).find(c => String(c.display || c.name || '').toLowerCase() === cName);
              if (cat) {
                let subcatId = null;
                if (subcatName) {
                  const sName = String(subcatName || '').toLowerCase();
                  const sub = (cat.category_features || cat.features || []).find(s => String(s.display || s.name || '').toLowerCase() === sName);
                  if (sub) {
                    subcatId = sub.id;
                  }
                }
                return {
                  department: dept.id,
                  category: cat.id,
                  subcategories: subcatId ? [subcatId] : []
                };
              }
            }
          }
          
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const val = obj[key];
              if (val && typeof val === 'object') {
                const res = findCategoryIdsFromObject(val, deptName, catName, subcatName);
                if (res) return res;
              }
            }
          }
        }
        return null;
      };

      const result = findCategoryIdsFromObject(nextData, parts[0], parts[1], parts[2] || '');
      if (result && result.category) {
        console.log('[Elister] Matched category/subcategory directly from __NEXT_DATA__ catalog object:', result);
        return result;
      }
    }
  } catch (e) {
    console.warn('[Elister] Failed to parse and scan __NEXT_DATA__ directly:', e);
  }

  // 1.b Fallback to raw text scan of scripts for name strings if structured scan failed
  try {
    const scanTextForName = (text, name, dId) => {
      const deptSuffix = dId ? dId.slice(-12).toLowerCase() : null;
      const searchStr = `"${name.toLowerCase()}"`;
      let idx = -1;
      
      while ((idx = text.toLowerCase().indexOf(searchStr, idx + 1)) !== -1) {
        const start = Math.max(0, idx - 150);
        const end = Math.min(text.length, idx + 150);
        const windowText = text.substring(start, end);
        
        const matches = windowText.match(/"id"\s*:\s*"([a-f0-9]{24})"/gi);
        if (matches) {
          for (const m of matches) {
            const id = m.match(/"id"\s*:\s*"([a-f0-9]{24})"/i)[1];
            if (!deptSuffix || id.toLowerCase().endsWith(deptSuffix)) {
              return id;
            }
          }
        }
      }
      return null;
    };

    const scripts = document.querySelectorAll('script');
    let dynamicCatId = null;
    let dynamicSubcatId = null;

    for (const script of scripts) {
      if (!script.src && script.textContent) {
        const text = script.textContent;
        if (!dynamicCatId) {
          dynamicCatId = scanTextForName(text, catName, deptId);
        }
        if (subcatName && !dynamicSubcatId) {
          dynamicSubcatId = scanTextForName(text, subcatName, deptId);
        }
        if (dynamicCatId && (!subcatName || dynamicSubcatId)) {
          break;
        }
      }
    }

    if (dynamicCatId) {
      console.log('[Elister] Dynamically matched category and subcategory from script tags:', { dynamicCatId, dynamicSubcatId });
      return {
        department: deptId,
        category: dynamicCatId,
        subcategories: dynamicSubcatId ? [dynamicSubcatId] : []
      };
    }
  } catch(e) {
    console.warn("[Elister] Failed to scan script tags for category mapping:", e);
  }

  // 2. Hardcoded fallback list for standard categories if dynamic scan fails
  const getFallbackCategory = (dId, cName) => {
    const normName = String(cName || '').toLowerCase();
    
    const womenCategories = {
      'accessories': '002a8975d97b4e80ef00a955',
      'bags': '00248975d97b4e80ef00a955',
      'dresses': '00108975d97b4e80ef00a955',
      'intimates & sleepwear': '00208975d97b4e80ef00a955',
      'jackets & coats': '00148975d97b4e80ef00a955',
      'jeans': '001a8975d97b4e80ef00a955',
      'jewelry': '00288975d97b4e80ef00a955',
      'makeup': '002c8975d97b4e80ef00a955',
      'pants & jumpsuits': '001c8975d97b4e80ef00a955',
      'pants': '001c8975d97b4e80ef00a955',
      'shoes': '00268975d97b4e80ef00a955',
      'shorts': '001e8975d97b4e80ef00a955',
      'skirts': '00128975d97b4e80ef00a955',
      'sweaters': '00168975d97b4e80ef00a955',
      'swim': '00228975d97b4e80ef00a955',
      'tops': '00188975d97b4e80ef00a955',
      'shirts': '00188975d97b4e80ef00a955'
    };

    const menCategories = {
      'accessories': '02008c10d97b4e1245005764',
      'bags': '03008c10d97b4e1245005764',
      'jackets & coats': '04008c10d97b4e1245005764',
      'jeans': '05008c10d97b4e1245005764',
      'pants': '06008c10d97b4e1245005764',
      'shirts': '07008c10d97b4e1245005764',
      'tops': '07008c10d97b4e1245005764',
      'shoes': '08008c10d97b4e1245005764',
      'shorts': '09008c10d97b4e1245005764',
      'suits & blazers': '0a008c10d97b4e1245005764',
      'sweaters': '0b008c10d97b4e1245005764',
      'swim': '0d008c10d97b4e1245005764',
      'underwear & socks': '0e008c10d97b4e1245005764'
    };

    const kidsCategories = {
      'accessories': '21008c10d97b4e1245005764',
      'dresses': '22008c10d97b4e1245005764',
      'jackets & coats': '23008c10d97b4e1245005764',
      'one pieces': '25008c10d97b4e1245005764',
      'matching sets': '26008c10d97b4e1245005764',
      'pajamas': '27008c10d97b4e1245005764',
      'shoes': '29008c10d97b4e1245005764',
      'swim': '2d008c10d97b4e1245005764',
      'shirts & tops': '2e008c10d97b4e1245005764',
      'tops': '2e008c10d97b4e1245005764',
      'shirts': '2e008c10d97b4e1245005764',
      'costumes': '30008c10d97b4e1245005764'
    };

    if (dId === '000e8975d97b4e80ef00a955') {
      return womenCategories[normName] || womenCategories['shirts'];
    } else if (dId === '20008c10d97b4e1245005764') {
      return kidsCategories[normName] || kidsCategories['shirts'];
    } else {
      return menCategories[normName] || menCategories['shirts'];
    }
  };

  const mappedCatId = getFallbackCategory(deptId, catName);

  return {
    department: deptId,
    category: mappedCatId,
    subcategories: []
  };
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
  if (productData.appTabId) {
    overlay.style.display = 'none';
  }
  overlay.innerHTML = `
    <h3 style="margin-top:0;font-size:13px;font-weight:700;color:#ff4757;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:12px;">eLister Auto-Publisher</h3>
    <div id="elister-status" style="font-size:11px;margin-bottom:10px;font-weight:500;">Initializing draft...</div>
    <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
      <div id="elister-progress" style="width:0%;height:100%;background:linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);transition:width 0.3s ease;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const updateStatus = (text, percent) => {
    const statusEl = document.getElementById('elister-status');
    const progressEl = document.getElementById('elister-progress');
    if (statusEl) statusEl.textContent = text;
    if (progressEl) progressEl.style.width = `${percent}%`;
    
    if (productData.appTabId) {
      chrome.runtime.sendMessage({
        action: 'POSHMARK_PUBLISH_STATUS',
        appTabId: productData.appTabId,
        status: 'progress',
        message: text,
        percent: percent,
        listingId: productData.listingId
      }).catch(() => {});
    }
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
      'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold', 'Silver', 'Black', 'Gray', 'White', 'Cream', 'Brown', 'Tan'
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
      if (c === 'like_new' || c === 'like new' || c === 'uln' || c === 'nwot') return 'uln';
      if (c === 'good' || c === 'euc' || c === 'vguc' || c === 'guc' || c === 'ug') return 'ug';
      if (c === 'fair' || c === 'uf') return 'uf';
      return 'uln'; // Default fallback
    };

    // Resolve category/department hex IDs if they are sent as path strings
    let resolvedDeptId = productData.departmentId;
    let resolvedCatId = productData.categoryId;
    let resolvedSubcatIds = productData.subcategoryIds;
    if (resolvedSubcatIds) {
      if (!Array.isArray(resolvedSubcatIds)) {
        resolvedSubcatIds = [resolvedSubcatIds];
      }
    } else {
      resolvedSubcatIds = [];
    }

    const isHex24 = (str) => typeof str === 'string' && /^[a-f0-9]{24}$/i.test(str);

    if (!isHex24(resolvedCatId)) {
      console.log('[Elister] Category ID is not a hex ID. Resolving category path:', resolvedCatId);
      const resolved = resolvePoshmarkCategory(resolvedCatId || productData.category);
      resolvedDeptId = resolved.department;
      resolvedCatId = resolved.category;
      resolvedSubcatIds = resolved.subcategories || [];
      console.log('[Elister] Resolved category path to:', { resolvedDeptId, resolvedCatId, resolvedSubcatIds });
    }

    // Always run resolved IDs through normalizePoshmarkIds to map legacy or incorrect IDs
    const normalized = normalizePoshmarkIds(resolvedDeptId, resolvedCatId);
    resolvedDeptId = normalized.departmentId;
    resolvedCatId = normalized.categoryId;
    console.log('[Elister] Normalized category mapping to Poshmark native IDs:', { resolvedDeptId, resolvedCatId });

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
          department: resolvedDeptId,
          category: resolvedCatId,
          category_features: resolvedSubcatIds
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

    let verifiedCatalog = null;

    // Two-step save to prevent "not a category feature" validation error due to Poshmark Rails backend evaluating features before category update
    if (resolvedSubcatIds && resolvedSubcatIds.length > 0) {
      console.log('[Elister] Performing preliminary category update to sync Poshmark backend draft category...');
      try {
        const prePayload = JSON.parse(JSON.stringify(savePayload));
        prePayload.post.catalog.category_features = [];
        
        const preRes = await fetch(`/vm-rest/posts/${draftId}?pm_version=2026.23.01`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-xsrf-token': csrfToken,
            'x-csrf-token': csrfToken
          },
          credentials: 'include',
          mode: 'cors',
          body: JSON.stringify(prePayload)
        });
        if (preRes.ok) {
          let preData;
          try {
            preData = await preRes.json();
          } catch (e) {}
          if (preData && preData.error) {
            const preErrMsg = preData.error.errorMessage || preData.error.userMessage || preData.error.errorType || "";
            throw new Error(`Preliminary category update failed: ${preErrMsg}`);
          }
          console.log('[Elister] Preliminary category update succeeded. Waiting 3s for database propagation...');
          await delay(3000);
          
          try {
            const verifyRes = await fetch(`/vm-rest/posts/${draftId}?pm_version=2026.23.01`, {
              method: 'GET',
              headers: {
                'accept': 'application/json',
                'x-xsrf-token': csrfToken,
                'x-csrf-token': csrfToken
              },
              credentials: 'include'
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              const postObj = verifyData && (verifyData.post || verifyData);
              const catObj = postObj && postObj.catalog;
              verifiedCatalog = {
                catalog: catObj,
                topKeys: Object.keys(verifyData || {}),
                postKeys: verifyData.post ? Object.keys(verifyData.post) : null,
                hasTitle: !!(postObj && postObj.title)
              };
              console.log('[Elister] Verified catalog status on server:', verifiedCatalog);
            } else {
              const errText = await verifyRes.text();
              verifiedCatalog = { verifyStatus: verifyRes.status, verifyErrorText: errText };
            }
          } catch (e) {
            console.warn('[Elister] Failed to verify draft category:', e);
            verifiedCatalog = { verifyError: e.message, verifyStack: e.stack };
          }
        } else {
          const preErrText = await preRes.text();
          throw new Error(`Preliminary category update HTTP error ${preRes.status}: ${preErrText}`);
        }
      } catch (preErr) {
        console.error('[Elister] Preliminary category update error:', preErr);
        throw preErr; // Throw so that it immediately stops and shows the exact error in the popup panel
      }
    }

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
        throw new Error(`${errMsg} (Verified Server Cat: ${JSON.stringify(verifiedCatalog)})`);
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
    
    updateStatus("Success! Listing published successfully.", 95);
    overlay.style.border = "1px solid #2ed573";

    // Call eLister backend to update status to 'published'
    if (productData.listingId && productData.token && productData.backendUrl) {
      console.log('[Elister Extension] Updating database status to published for ID:', productData.listingId);
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
            poshmarkUrl: `https://poshmark.com/listing/${draftId}`,
            poshmarkListingId: draftId
          })
        });
        if (updateRes.ok) {
          console.log('[Elister Extension] Successfully updated listing status in eLister database!');
          if (productData.appTabId) {
            chrome.runtime.sendMessage({
              action: 'POSHMARK_PUBLISH_STATUS',
              appTabId: productData.appTabId,
              status: 'success',
              message: 'Listing published successfully.',
              percent: 100,
              listingId: productData.listingId
            }).catch(() => {});
            return;
          } else {
            chrome.runtime.sendMessage({ action: 'RELOAD_ELISTER_TABS' }).catch(() => {});
          }
        } else {
          console.error('[Elister Extension] Failed to update eLister database status:', updateRes.status);
          if (productData.appTabId) {
            chrome.runtime.sendMessage({
              action: 'POSHMARK_PUBLISH_STATUS',
              appTabId: productData.appTabId,
              status: 'error',
              message: `Failed to update eLister database status (HTTP ${updateRes.status})`,
              percent: 100,
              listingId: productData.listingId
            }).catch(() => {});
            return;
          }
        }
      } catch (dbErr) {
        console.error('[Elister Extension] Error updating database:', dbErr);
        if (productData.appTabId) {
          chrome.runtime.sendMessage({
            action: 'POSHMARK_PUBLISH_STATUS',
            appTabId: productData.appTabId,
            status: 'error',
            message: `Database update error: ${dbErr.message}`,
            percent: 100,
            listingId: productData.listingId
          }).catch(() => {});
          return;
        }
      }
    }

    if (productData.appTabId) {
      chrome.runtime.sendMessage({
        action: 'POSHMARK_PUBLISH_STATUS',
        appTabId: productData.appTabId,
        status: 'success',
        message: 'Listing published successfully.',
        percent: 100,
        listingId: productData.listingId
      }).catch(() => {});
      return;
    }

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
    sessionStorage.removeItem('elister_captured_draft_id');
    updateStatus(`Upload Failed: ${err.message}`, 100);
    
    if (productData.appTabId) {
      chrome.runtime.sendMessage({
        action: 'POSHMARK_PUBLISH_STATUS',
        appTabId: productData.appTabId,
        status: 'error',
        message: err.message,
        percent: 100,
        listingId: productData.listingId
      }).catch(() => {});
      return;
    }

    overlay.style.border = "1px solid #ff4757";
    const progressEl = document.getElementById('elister-progress');
    if (progressEl) progressEl.style.background = "#ff4757";
    
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

// Helper: check if we are in connection flow and successfully logged in
async function checkAndCompleteConnection() {
  const csrfToken = getCsrfToken('poshmark');
  const username = getUsernameFromDOM('poshmark');

  console.log('[Elister Extension] Checking connection status:', { username, hasCsrf: !!csrfToken });

  chrome.runtime.sendMessage({ action: 'GET_CONNECT_FLOW' }, async (response) => {
    if (response && response.success && response.flow) {
      const isLoginPage = window.location.pathname.includes('/login');
      
      if (!username || username === 'Guest' || !csrfToken) {
        if (!isLoginPage) {
          console.log('[Elister Extension] Connection flow active but user is Guest or CSRF missing. Redirecting to login...');
          window.location.href = 'https://poshmark.com/login';
        }
        return;
      }
      
      console.log('[Elister Extension] Active Poshmark connection flow detected! Refreshing session cookie via same-origin fetch...');
      try {
        // Trigger same-origin fetch to /create-listing with a cache-buster to force Rails session cookie establishment
        await fetch('/create-listing?_elister_cb=' + Date.now());
        console.log('[Elister Extension] Same-origin session recovery fetch completed successfully.');
      } catch (e) {
        console.error('[Elister Extension] Same-origin session fetch failed:', e);
      }
      
      // Brief timeout to let the browser commit cookie to store
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'COMPLETE_POSHMARK_CONNECT',
          data: {
            username: username,
            csrfToken: csrfToken
          }
        }, (res) => {
          console.log('[Elister Extension] COMPLETE_POSHMARK_CONNECT response:', res);
        });
      }, 500);
    }
  });
}

if (currentSite === 'poshmark') {
  // Check immediately on load
  setTimeout(checkAndCompleteConnection, 1000);

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
  window.addEventListener('ELISTER_TOKEN_CAPTURED', async (event) => {
    const token = event.detail.csrfToken;
    if (token) {
      sessionStorage.setItem('elister_captured_csrf_token', token);
      chrome.runtime.sendMessage({
        action: 'CACHE_CSRF_TOKEN',
        data: { site: currentSite, token }
      }).catch(() => {});

      // Cache full Poshmark connection details
      const username = getUsernameFromDOM('poshmark');
      if (username && username !== 'Guest') {
        console.log('[Elister Extension] Token captured. Ensuring Poshmark session is active...');
        try {
          await fetch('/vm-rest/users/self');
        } catch (e) {
          console.error('[Elister Extension] Failed to capture session cookie via fetch:', e);
        }
        
        chrome.runtime.sendMessage({
          action: 'CACHE_CONNECTION_DETAILS',
          platform: 'poshmark',
          data: {
            username: username,
            csrfToken: token
          }
        }).catch(() => {});
      }

      // Check and sync credentials if redirect oauth connect flow is active
      checkAndCompleteConnection();
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

  // Silently check and sync Poshmark cookies on eLister page load/refresh
  setTimeout(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const backendUrl = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
          ? 'http://localhost:5000/api'
          : 'https://api.elister.ai/api';
        
        console.log('[Elister Extension] Triggering auto-sync of active Poshmark cookies...');
        chrome.runtime.sendMessage({
          action: 'SILENT_SYNC_POSHMARK',
          data: { token, backendUrl }
        }, (response) => {
          if (response && response.success) {
            console.log('[Elister Extension] Silent Poshmark session sync succeeded:', response);
          }
        });
      }
    } catch (e) {
      console.error('[Elister Extension] Error in silent auto-sync check:', e);
    }
  }, 2000);

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

    else if (event.data && event.data.action === 'ELISTER_START_CONNECT_FLOW' && event.data.platform === 'poshmark') {
      console.log('[Elister Extension] Initiating Poshmark Connect Flow with credentials...');
      const { token, backendUrl, frontendUrl } = event.data;
      chrome.runtime.sendMessage({
        action: 'START_POSHMARK_CONNECT_FLOW',
        data: { token, backendUrl, frontendUrl }
      });
    }

    // Capture automatic connection trigger from settings
    else if (event.data && event.data.action === 'ELISTER_GET_CONNECTION_DETAILS' && event.data.platform === 'poshmark') {
      console.log('[Elister Extension] Fetching cached Poshmark connection details...');
      chrome.runtime.sendMessage({
        action: 'GET_CONNECTION_DETAILS',
        platform: 'poshmark'
      }, (response) => {
        if (response && response.success && response.data) {
          console.log('[Elister Extension] Sending connection details back to app...');
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'poshmark',
            success: true,
            data: response.data
          }, '*');
        } else {
          window.postMessage({
            action: 'ELISTER_CONNECTION_DETAILS_RESPONSE',
            platform: 'poshmark',
            success: false,
            error: 'Session details not found in extension cache. Please login/open Poshmark tab.'
          }, '*');
        }
      });
    }
  });
}

// Message Listener for Popup status queries
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ELISTER_PUBLISH_STATUS_FROM_EXTENSION') {
    if (currentSite === 'elister') {
      window.postMessage({
        action: 'ELISTER_PUBLISH_STATUS_UPDATE',
        status: request.status,
        message: request.message,
        percent: request.percent,
        listingId: request.listingId
      }, '*');
      sendResponse({ success: true });
    }
    return true;
  }

  if (request.action === 'GET_SESSION_STATUS') {
    const csrfToken = getCsrfToken(currentSite);
    const username = getUsernameFromDOM(currentSite);
    sendResponse({
      success: true,
      data: {
        site: currentSite,
        username,
        csrfToken: csrfToken ? `${csrfToken.substring(0, 8)}...` : null,
        anonId: null
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



  return true; 
});

console.log('[Elister Extension] Content script initialized.');
