(function() {
  // Helper: Try to extract CSRF token from meta tags or cookies or global window objects
  const checkGlobalToken = () => {
    try {
      let token = null;
      
      const scriptCsrf = document.querySelector('script[data-name="csrf-token"]');
      if (scriptCsrf) {
        token = scriptCsrf.textContent.trim();
      }

      if (!token) {
        const metas = document.querySelectorAll('meta');
        for (let meta of metas) {
          const name = (meta.getAttribute('name') || meta.getAttribute('property') || '').toLowerCase();
          const content = meta.getAttribute('content');
          if ((name.includes('csrf') || name.includes('xsrf') || name.includes('token')) && content && content.length > 20) {
            token = content;
            break;
          }
        }
      }

      if (token) {
        window.dispatchEvent(new CustomEvent('ELISTER_TOKEN_CAPTURED', {
          detail: { csrfToken: token }
        }));
        return true;
      }
    } catch(e) {}
    return false;
  };

  // Run extraction checks immediately and on key load events
  checkGlobalToken();
  document.addEventListener('DOMContentLoaded', checkGlobalToken);
  window.addEventListener('load', checkGlobalToken);

  // Poll for 4 seconds in the background to catch late hydration
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const gotToken = checkGlobalToken();
    if (gotToken || attempts > 40) {
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
          csrfToken = args[0].headers.get('x-csrf-token') || args[0].headers.get('x-csrf-token');
        }
      }
      
      // Check headers in options parameter
      if (!csrfToken && options.headers) {
        if (options.headers instanceof Headers || (typeof options.headers.get === 'function')) {
          csrfToken = options.headers.get('x-csrf-token') || options.headers.get('x-csrf-token');
        } else if (Array.isArray(options.headers)) {
          const found = options.headers.find(h => h[0] && (h[0].toLowerCase() === 'x-csrf-token'));
          if (found) csrfToken = found[1];
        } else {
          for (const key in options.headers) {
            if (key.toLowerCase() === 'x-csrf-token') {
              csrfToken = options.headers[key];
              break;
            }
          }
        }
      }

      if (csrfToken) {
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
      
      const isVintedApi = url.includes('/api/v') || url.includes('/offline_verification/') || url.includes('/item_upload/');
      
      if (isVintedApi && (method === 'POST' || method === 'PUT' || url.includes('size') || url.includes('brands') || url.includes('colors'))) {
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
      if (name.toLowerCase() === 'x-csrf-token') {
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
        const isVintedApi = this._url.includes('/api/v') || this._url.includes('/offline_verification/') || this._url.includes('/item_upload/');
        
        if (isVintedApi && (this._method === 'POST' || this._method === 'PUT' || this._url.includes('size') || this._url.includes('brands') || this._url.includes('colors'))) {
          window.dispatchEvent(new CustomEvent('ELISTER_API_CAPTURED', {
            detail: {
              url: this._url,
              method: this._method,
              headers: {},
              body: body || null,
              response: this.responseText
            }
          }));
        }
      } catch (e) {}
    });
    return originalSend.apply(this, [body, ...rest]);
  };
})();
