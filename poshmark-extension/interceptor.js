(function() {
  // Helper: Try to extract CSRF token from global variables or script tags
  const checkGlobalToken = () => {
    try {
      let token = null;
      
      // 1. Check common window variables
      if (window.App && window.App.csrfToken) token = window.App.csrfToken;
      else if (window.App && window.App.xsrfToken) token = window.App.xsrfToken;
      else if (window.App && window.App.token) token = window.App.token;
      else if (window.csrfToken) token = window.csrfToken;
      else if (window.xsrfToken) token = window.xsrfToken;

      // Filter out NextJS UUID tokens containing hyphens
      if (token && token.includes('-')) {
        token = null;
      }

      if (token) {
        document.documentElement.setAttribute('data-elister-csrf-token', token);
        window.dispatchEvent(new CustomEvent('ELISTER_TOKEN_CAPTURED', {
          detail: { csrfToken: token }
        }));
        return true;
      }
    } catch(e) {}
    return false;
  };

  // Helper: Try to extract pre-loaded draft/listing ID from global window objects
  const checkGlobalDraftId = () => {
    try {
      let draftId = null;
      
      // 1. Direct checks on window.App
      if (window.App && window.App.post && window.App.post.id) draftId = window.App.post.id;
      else if (window.App && window.App.listing && window.App.listing.id) draftId = window.App.listing.id;
      else if (window.App && window.App.draft && window.App.draft.id) draftId = window.App.draft.id;
      else if (window.App && window.App.currentPostId) draftId = window.App.currentPostId;
      else if (window.App && window.App.post_id) draftId = window.App.post_id;
      else if (window.App && window.App.listing_id) draftId = window.App.listing_id;
      else if (window.App && window.App.draft_id) draftId = window.App.draft_id;
      
      // 2. Recursive scanner for window.App
      if (!draftId && window.App) {
        const candidates = [];
        const seen = new Set();
        const scan = (obj, pathArr = []) => {
          if (!obj || typeof obj !== 'object') return;
          if (seen.has(obj)) return;
          seen.add(obj);
          if (pathArr.length > 10) return; // Prevent too deep search
          
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
        scan(window.App);
        
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
              parentKeyLower === 'draft'
            ) {
              score += 90;
            } else {
              score += 40;
            }
          }
          
          return { ...c, score };
        });
        
        scored.sort((a, b) => b.score - a.score);
        if (scored.length > 0 && scored[0].score > 0) {
          console.log('[Elister Interceptor] Selected draft ID from window.App:', scored[0].id, 'path:', scored[0].path, 'score:', scored[0].score);
          draftId = scored[0].id;
        }
      }
      
      // 3. Regex check on __NEXT_DATA__
      if (!draftId) {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
          const text = nextDataEl.textContent;
          // Match keys with or without quotes, followed by : or =, followed by a 24-character hex ID in single/double quotes
          const regex = /(?:"?postId"?|"?post_id"?|"?listingId"?|"?listing_id"?|"?draftId"?|"?draft_id"?)\s*[:=]\s*['"]([a-f0-9]{24})['"]/gi;
          let match;
          while ((match = regex.exec(text)) !== null) {
            const id = match[1];
            if (id && !id.endsWith('8c10d97b4e1245005764')) {
              console.log('[Elister Interceptor] Found draft ID in __NEXT_DATA__ regex:', id);
              draftId = id;
              break;
            }
          }
        }
      }

      if (draftId) {
        window.dispatchEvent(new CustomEvent('ELISTER_DRAFT_ID_CAPTURED', {
          detail: { draftId }
        }));
        return true;
      }
    } catch(e) {}
    return false;
  };

  // Run extraction checks immediately and on key load events
  checkGlobalToken();
  checkGlobalDraftId();
  document.addEventListener('DOMContentLoaded', () => {
    checkGlobalToken();
    checkGlobalDraftId();
  });
  window.addEventListener('load', () => {
    checkGlobalToken();
    checkGlobalDraftId();
  });

  // Poll for 4 seconds in the background to catch late hydration
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const gotToken = checkGlobalToken();
    const gotDraftId = checkGlobalDraftId();
    if ((gotToken && gotDraftId) || attempts > 40) {
      clearInterval(interval);
    }
  }, 100);

  // -----------------------------------------------------------
  // Monkeypatch window.fetch to capture CSRF token & API responses
  // -----------------------------------------------------------
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const options = args[1] || {};
      let csrfToken = null;
      
      // Check if first argument is a Request object containing headers
      if (args[0] && typeof args[0] === 'object' && args[0].headers) {
        if (typeof args[0].headers.get === 'function') {
          csrfToken = args[0].headers.get('x-xsrf-token') || args[0].headers.get('x-csrf-token');
        }
      }
      
      // Check headers in options parameter
      if (!csrfToken && options.headers) {
        if (options.headers instanceof Headers || (typeof options.headers.get === 'function')) {
          csrfToken = options.headers.get('x-xsrf-token') || options.headers.get('x-csrf-token');
        } else if (Array.isArray(options.headers)) {
          const found = options.headers.find(h => h[0] && (h[0].toLowerCase() === 'x-xsrf-token' || h[0].toLowerCase() === 'x-csrf-token'));
          if (found) csrfToken = found[1];
        } else {
          for (const key in options.headers) {
            if (key.toLowerCase() === 'x-xsrf-token' || key.toLowerCase() === 'x-csrf-token') {
              csrfToken = options.headers[key];
              break;
            }
          }
        }
      }

      if (csrfToken && !csrfToken.includes('-')) {
        document.documentElement.setAttribute('data-elister-csrf-token', csrfToken);
        window.dispatchEvent(new CustomEvent('ELISTER_TOKEN_CAPTURED', {
          detail: { csrfToken }
        }));
      }
    } catch (e) {}

    const response = await originalFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const options = args[1] || {};
      const method = options.method || 'GET';
      
      const isPoshmarkApi = url.includes('/vm-rest/') || url.includes('/api/');
      
      if (isPoshmarkApi && (method === 'POST' || method === 'PUT' || url.includes('size') || url.includes('posts'))) {
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        
        window.dispatchEvent(new CustomEvent('ELISTER_API_CAPTURED', {
          detail: {
            url,
            method,
            headers: options.headers || {},
            body: options.body || null,
            response: responseText
          }
        }));

        // Extract draft ID from response if it is a POST/PUT to posts or create-listing related endpoints
        if (url.includes('posts')) {
          try {
            const resData = JSON.parse(responseText);
            // Search for draft ID recursively inside the response JSON
            const findId = (obj) => {
              if (!obj || typeof obj !== 'object') return null;
              if (obj.id && typeof obj.id === 'string' && /^[a-f0-9]{24}$/.test(obj.id)) {
                if (!obj.id.endsWith('8c10d97b4e1245005764')) return obj.id;
              }
              if (obj.postId && typeof obj.postId === 'string' && /^[a-f0-9]{24}$/.test(obj.postId)) return obj.postId;
              if (obj.post_id && typeof obj.post_id === 'string' && /^[a-f0-9]{24}$/.test(obj.post_id)) return obj.post_id;
              if (obj.listingId && typeof obj.listingId === 'string' && /^[a-f0-9]{24}$/.test(obj.listingId)) return obj.listingId;
              if (obj.listing_id && typeof obj.listing_id === 'string' && /^[a-f0-9]{24}$/.test(obj.listing_id)) return obj.listing_id;
              if (obj.draftId && typeof obj.draftId === 'string' && /^[a-f0-9]{24}$/.test(obj.draftId)) return obj.draftId;
              if (obj.draft_id && typeof obj.draft_id === 'string' && /^[a-f0-9]{24}$/.test(obj.draft_id)) return obj.draft_id;
              
              for (let key in obj) {
                const res = findId(obj[key]);
                if (res) return res;
              }
              return null;
            };
            const extractedId = findId(resData);
            if (extractedId) {
              console.log('[Elister Interceptor] Extracted draft ID from fetch response:', extractedId);
              window.dispatchEvent(new CustomEvent('ELISTER_DRAFT_ID_CAPTURED', {
                detail: { draftId: extractedId }
              }));
            }
          } catch(e) {}
        }
      }
    } catch (e) {}
    return response;
  };

  // -----------------------------------------------------------
  // Monkeypatch XMLHttpRequest to capture CSRF token & API responses
  // -----------------------------------------------------------
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    try {
      if ((name.toLowerCase() === 'x-xsrf-token' || name.toLowerCase() === 'x-csrf-token') && value && !value.includes('-')) {
        document.documentElement.setAttribute('data-elister-csrf-token', value);
        window.dispatchEvent(new CustomEvent('ELISTER_TOKEN_CAPTURED', {
          detail: { csrfToken: value }
        }));
      }
    } catch (e) {}
    return originalSetRequestHeader.apply(this, [name, value]);
  };

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(body, ...rest) {
    this.addEventListener('load', function() {
      try {
        const isPoshmarkApi = this._url.includes('/vm-rest/') || this._url.includes('/api/');
        
        if (isPoshmarkApi && (this._method === 'POST' || this._method === 'PUT' || this._url.includes('size') || this._url.includes('posts'))) {
          window.dispatchEvent(new CustomEvent('ELISTER_API_CAPTURED', {
            detail: {
              url: this._url,
              method: this._method,
              headers: {},
              body: body || null,
              response: this.responseText
            }
          }));

          if (this._url.includes('posts')) {
            try {
              const resData = JSON.parse(this.responseText);
              const findId = (obj) => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.id && typeof obj.id === 'string' && /^[a-f0-9]{24}$/.test(obj.id)) {
                  if (!obj.id.endsWith('8c10d97b4e1245005764')) return obj.id;
                }
                if (obj.postId && typeof obj.postId === 'string' && /^[a-f0-9]{24}$/.test(obj.postId)) return obj.postId;
                if (obj.post_id && typeof obj.post_id === 'string' && /^[a-f0-9]{24}$/.test(obj.post_id)) return obj.post_id;
                if (obj.listingId && typeof obj.listingId === 'string' && /^[a-f0-9]{24}$/.test(obj.listingId)) return obj.listingId;
                if (obj.listing_id && typeof obj.listing_id === 'string' && /^[a-f0-9]{24}$/.test(obj.listing_id)) return obj.listing_id;
                if (obj.draftId && typeof obj.draftId === 'string' && /^[a-f0-9]{24}$/.test(obj.draftId)) return obj.draftId;
                if (obj.draft_id && typeof obj.draft_id === 'string' && /^[a-f0-9]{24}$/.test(obj.draft_id)) return obj.draft_id;
                
                for (let key in obj) {
                  const res = findId(obj[key]);
                  if (res) return res;
                }
                return null;
              };
              const extractedId = findId(resData);
              if (extractedId) {
                console.log('[Elister Interceptor] Extracted draft ID from XHR response:', extractedId);
                window.dispatchEvent(new CustomEvent('ELISTER_DRAFT_ID_CAPTURED', {
                  detail: { draftId: extractedId }
                }));
              }
            } catch(e) {}
          }
        }
      } catch (e) {}
    });
    return originalSend.apply(this, [body, ...rest]);
  };
})();
