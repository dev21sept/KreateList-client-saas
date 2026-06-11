(function() {
  // Helper: Try to extract auth details from sessionStorage/localStorage if available in DOM context
  const checkGlobalToken = () => {
    try {
      let token = null;
      // Scrape potential tokens from local/session storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth'))) {
          const val = localStorage.getItem(key);
          if (val && val.startsWith('Bearer ')) {
            token = val;
            break;
          } else if (val && val.length > 50 && val.includes('.')) { // potential JWT
            token = `Bearer ${val}`;
            break;
          }
        }
      }

      if (token) {
        sessionStorage.setItem('elister_captured_depop_token', token);
        window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_TOKEN_CAPTURED', {
          detail: { token }
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
  // Monkeypatch window.fetch to capture auth headers & API responses
  // -----------------------------------------------------------
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const options = args[1] || {};
      let authToken = null;
      
      const getAuthHeader = (headersObj) => {
        if (!headersObj) return null;
        if (headersObj instanceof Headers || (typeof headersObj.get === 'function')) {
          return headersObj.get('authorization') || headersObj.get('Authorization');
        } else if (Array.isArray(headersObj)) {
          const found = headersObj.find(h => h[0] && (h[0].toLowerCase() === 'authorization'));
          return found ? found[1] : null;
        } else {
          for (const key in headersObj) {
            if (key.toLowerCase() === 'authorization') {
              return headersObj[key];
            }
          }
        }
        return null;
      };

      // Check Request object
      if (args[0] && typeof args[0] === 'object' && args[0].headers) {
        authToken = getAuthHeader(args[0].headers);
      }
      
      // Check options headers
      if (!authToken && options.headers) {
        authToken = getAuthHeader(options.headers);
      }

      if (authToken) {
        sessionStorage.setItem('elister_captured_depop_token', authToken);
        window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_TOKEN_CAPTURED', {
          detail: { token: authToken }
        }));
      }
    } catch (e) {}

    const response = await originalFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const options = args[1] || {};
      const method = options.method || 'GET';
      
      const isDepopApi = url.includes('depop.com/api') || url.includes('api.depop.com');
      const isInteresting = url.includes('product') || url.includes('photo') || url.includes('image') || url.includes('upload') || url.includes('draft') || url.includes('create');
      
      if (isInteresting && (method === 'POST' || method === 'PUT')) {
        console.log(`%c[Elister Depop Intercepted API Request] ${method} ${url}`, 'background: #222; color: #ff2600; font-weight: bold; font-size: 12px; padding: 2px 5px;');
        if (options.body) {
          console.log('[Elister Intercepted Body keys/content]:', typeof options.body === 'string' ? options.body.substring(0, 300) : (options.body instanceof FormData ? Array.from(options.body.keys()) : options.body));
        }
        try {
          const responseClone = response.clone();
          const responseText = await responseClone.text();
          console.log('[Elister Intercepted Response Preview]:', responseText.substring(0, 300));
        } catch (err) {}
      }

      if (isDepopApi && (method === 'POST' || method === 'PUT' || url.includes('category') || url.includes('brand') || url.includes('color'))) {
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        
        let bodyText = null;
        if (options.body) {
          if (typeof options.body === 'string') {
            bodyText = options.body;
          } else if (options.body instanceof FormData) {
            try {
              const obj = {};
              options.body.forEach((value, key) => {
                obj[key] = typeof value === 'string' ? value : '[Binary/Blob]';
              });
              bodyText = JSON.stringify(obj);
            } catch (e) {
              bodyText = '[FormData]';
            }
          } else {
            bodyText = '[Complex Body]';
          }
        }

        window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_API_CAPTURED', {
          detail: {
            url: url,
            method: method,
            body: bodyText,
            response: responseText
          }
        }));
      }
    } catch (e) {}
    return response;
  };

  // -----------------------------------------------------------
  // Monkeypatch XMLHttpRequest to capture auth & API responses
  // -----------------------------------------------------------
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    try {
      if (name.toLowerCase() === 'authorization') {
        sessionStorage.setItem('elister_captured_depop_token', value);
        window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_TOKEN_CAPTURED', {
          detail: { token: value }
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
    const xhr = this;
    xhr.addEventListener('load', function() {
      try {
        const isDepopApi = xhr._url.includes('depop.com/api') || xhr._url.includes('api.depop.com');
        const isInteresting = xhr._url.includes('product') || xhr._url.includes('photo') || xhr._url.includes('image') || xhr._url.includes('upload') || xhr._url.includes('draft') || xhr._url.includes('create');
        
        if (isInteresting && (xhr._method === 'POST' || xhr._method === 'PUT')) {
          console.log(`%c[Elister Depop Intercepted API Request (XHR)] ${xhr._method} ${xhr._url}`, 'background: #222; color: #ff2600; font-weight: bold; font-size: 12px; padding: 2px 5px;');
          if (body) {
            console.log('[Elister Intercepted Body keys/content]:', typeof body === 'string' ? body.substring(0, 300) : (body instanceof FormData ? Array.from(body.keys()) : body));
          }
          if (xhr.responseText) {
            console.log('[Elister Intercepted Response Preview]:', xhr.responseText.substring(0, 300));
          }
        }

        if (isDepopApi && (xhr._method === 'POST' || xhr._method === 'PUT' || xhr._url.includes('category') || xhr._url.includes('brand') || xhr._url.includes('color'))) {
          let bodyText = null;
          if (body) {
            if (typeof body === 'string') {
              bodyText = body;
            } else if (body instanceof FormData) {
              try {
                const obj = {};
                body.forEach((value, key) => {
                  obj[key] = typeof value === 'string' ? value : '[Binary/Blob]';
                });
                bodyText = JSON.stringify(obj);
              } catch (e) {
                bodyText = '[FormData]';
              }
            } else {
              bodyText = '[Complex Body]';
            }
          }

          window.dispatchEvent(new CustomEvent('ELISTER_DEPOP_API_CAPTURED', {
            detail: {
              url: xhr._url,
              method: xhr._method,
              body: bodyText,
              response: xhr.responseText
            }
          }));
        }
      } catch (e) {}
    });
    return originalSend.apply(this, [body, ...rest]);
  };
})();
