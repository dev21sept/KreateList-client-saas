// Helper to get/set state variables from storage
function getStorageData(key, defaultValue) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] !== undefined ? result[key] : defaultValue);
    });
  });
}

function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Elister Depop Fast Automator Service Worker installed!');
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Depop Background received message:', message);
  
  if (message.action === 'START_DEPOP_CONNECT_FLOW') {
    const { token, backendUrl, frontendUrl } = message.data;
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.tabs.update(tabId, { url: 'https://www.depop.com/login/' }, (tab) => {
        const flow = {
          tabId: tab.id,
          token,
          backendUrl,
          frontendUrl
        };
        setStorageData('activeConnectFlow', flow).then(() => {
          console.log('Redirecting same tab for Depop Connect Flow:', tab.id);
          sendResponse({ success: true });
        });
      });
    } else {
      sendResponse({ success: false, message: 'No sender tab found' });
    }
    return true;
  }
  
  else if (message.action === 'GET_CONNECT_FLOW') {
    const tabId = sender.tab ? sender.tab.id : null;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (flow && flow.tabId === tabId) {
        sendResponse({ success: true, flow });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
  
  else if (message.action === 'COMPLETE_DEPOP_CONNECT') {
    const { username, accessToken } = message.data;
    getStorageData('activeConnectFlow', null).then((flow) => {
      if (!flow) {
        sendResponse({ success: false, message: 'No active connect flow found' });
        return;
      }
      const { token, backendUrl, frontendUrl } = flow;
      
      // Immediately clear the active flow to prevent duplicate triggers/refreshes
      setStorageData('activeConnectFlow', null);
      
      // Fetch all cookies for depop.com using chrome.cookies API
      chrome.cookies.getAll({ domain: 'depop.com' }, (cookiesList) => {
        const cookieString = (cookiesList || []).map(c => `${c.name}=${c.value}`).join('; ');
        console.log('[Background] Captured cookies string length:', cookieString.length);

        console.log('Submitting captured Depop credentials to backend:', backendUrl);
        fetch(`${backendUrl}/depop/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            platform: 'depop',
            username,
            accessToken,
            sessionCookie: cookieString
          })
        })
        .then(res => res.json())
        .then((data) => {
          console.log('Backend connect response:', data);
          if (data.success) {
            getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
              cachedDetails['depop'] = {
                username,
                accessToken,
                sessionCookie: cookieString
              };
              setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
                chrome.tabs.update(flow.tabId, { url: `${flow.frontendUrl}/ebay-accounts?success=depop` });
                sendResponse({ success: true });
              });
            });
          } else {
            sendResponse({ success: false, message: data.message || 'Backend connection failed' });
          }
        })
        .catch(err => {
          console.error('Error connecting Depop to backend:', err);
          sendResponse({ success: false, error: err.message });
        });
      });
    });
    return true;
  }
  
  else if (message.action === 'PING_BACKGROUND') {
    sendResponse({ success: true, message: 'Background worker is active' });
  }
  
  else if (message.action === 'CACHE_CSRF_TOKEN') {
    const { site, token } = message.data;
    if (site && token) {
      getStorageData('cachedCsrfTokens', {}).then((tokens) => {
        tokens[site] = token;
        setStorageData('cachedCsrfTokens', tokens).then(() => {
          console.log(`Cached CSRF Token for ${site}:`, token);
          sendResponse({ success: true });
        });
      });
    } else {
      sendResponse({ success: true });
    }
    return true;
  }
  
  else if (message.action === 'CACHE_CONNECTION_DETAILS') {
    const { platform, data } = message;
    if (platform && data) {
      getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
        cachedDetails[platform] = data;
        setStorageData('cachedConnectionDetails', cachedDetails).then(() => {
          console.log(`Cached Connection Details for ${platform}:`, data);
          sendResponse({ success: true });
        });
      });
      return true;
    }
    sendResponse({ success: true });
  }

  else if (message.action === 'GET_CONNECTION_DETAILS') {
    getStorageData('cachedConnectionDetails', {}).then((cachedDetails) => {
      sendResponse({ success: true, data: cachedDetails[message.platform] });
    });
    return true;
  }
  
  else if (message.action === 'GET_CACHED_CSRF_TOKEN') {
    getStorageData('cachedCsrfTokens', {}).then((tokens) => {
      sendResponse({ success: true, token: tokens[message.site] });
    });
    return true;
  }
  
  else if (message.action === 'START_DEPOP_LISTING') {
    const pendingData = message.data;
    setStorageData('pendingListingData', pendingData).then(() => {
      console.log('Stored pending Depop listing data in queue:', pendingData);
      
      // Open Depop create listing page in a new tab
      chrome.tabs.create({ url: 'https://www.depop.com/products/create/' }, (tab) => {
        console.log('Opened Depop tab, ID:', tab.id);
      });
      
      sendResponse({ success: true, message: 'Depop tab opened. Listing queued.' });
    });
    return true;
  }
  
  else if (message.action === 'GET_PENDING_LISTING') {
    getStorageData('pendingListingData', null).then((pendingData) => {
      if (pendingData) {
        sendResponse({ success: true, data: pendingData });
        setStorageData('pendingListingData', null).then(() => {});
      } else {
        sendResponse({ success: false, message: 'No pending listing queued.' });
      }
    });
    return true;
  }
  
  else if (message.action === 'LOG_CAPTURED_API') {
    // Broadcast captured API metrics to popup logs
    chrome.runtime.sendMessage(message).catch(() => {
      // Silently catch error if popup is closed
    });
  }

  else if (message.action === 'BACKGROUND_DEPOP_REQUEST') {
    const { url, method, headers, body, responseType } = message.data;
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {},
      credentials: 'include'
    };

    if (body) {
      if (typeof body === 'string') {
        fetchOptions.body = body;
      } else if (body.type === 'base64') {
        try {
          const binaryString = atob(body.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fetchOptions.body = bytes;
        } catch (e) {
          console.error("Failed to decode base64 body:", e);
        }
      }
    }

    fetch(url, fetchOptions)
      .then(async (res) => {
        const ok = res.ok;
        const status = res.status;
        let resData = null;

        if (responseType === 'json') {
          resData = await res.json().catch(() => null);
        } else if (responseType === 'blob' || responseType === 'base64') {
          const arrayBuffer = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          resData = btoa(binary);
        } else {
          resData = await res.text().catch(() => null);
        }

        sendResponse({ success: true, ok, status, data: resData });
      })
      .catch((err) => {
        console.error('Background fetch failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open
  }

  else if (message.action === 'RELOAD_ELISTER_TABS') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && (tab.url.includes('elister.ai') || tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
          console.log('Reloading tab:', tab.id, tab.url);
          chrome.tabs.reload(tab.id);
        }
      });
    });
    sendResponse({ success: true });
  }
  
  else if (message.action === 'PUBLISH_DEPOP_BACKGROUND') {
    const { listing, token } = message.data;
    
    console.log('[Background] Fetching active cookies for depop.com...');
    chrome.cookies.getAll({ domain: 'depop.com' }, (cookies) => {
      const cookieString = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');
      console.log('[Background] Injecting Cookie header dynamically (length:', cookieString.length, ')');

      const ruleId = 1;
      const rule = {
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Cookie', operation: 'set', value: cookieString }
          ]
        },
        condition: {
          urlFilter: '||webapi.depop.com',
          initiatorDomains: [chrome.runtime.id]
        }
      };

      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: [rule]
      }, () => {
        console.log('[Background] Session rules updated. Initiating direct publish...');
        publishDepopBackground(listing, token)
          .then((result) => {
            // Clean up rule
            chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
            sendResponse(result);
          })
          .catch((err) => {
            // Clean up rule
            chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
            sendResponse({ success: false, error: err.message });
          });
      });
    });
      
    return true;
  }
  
  return true; // Keep channel open
});

async function publishDepopBackground(listing, token) {
  try {
    console.log('[Background Publisher] Initializing publish for listing:', listing.title);

    // Step 1: Upload Images
    const pictureIds = [];
    const images = listing.images || [];

    for (let i = 0; i < images.length; i++) {
      try {
        console.log(`[Background Publisher] Downloading image ${i + 1} of ${images.length}...`);
        const cleanUrl = images[i].replace('//localhost:', '//127.0.0.1:');
        const imgRes = await fetch(cleanUrl);
        if (!imgRes.ok) throw new Error(`Failed to download image: Status ${imgRes.status}`);
        const imgBlob = await imgRes.blob();

        console.log(`[Background Publisher] Initializing image upload ${i + 1} on Depop...`);
        const initRes = await fetch('https://webapi.depop.com/api/v4/pictures/', {
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

        console.log(`[Background Publisher] Uploading image ${i + 1} to S3...`);
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg'
          },
          body: imgBlob
        });

        if (!putRes.ok) {
          throw new Error(`Failed to upload image to S3: Status ${putRes.status}`);
        }

        pictureIds.push(photoId);
        console.log(`[Background Publisher] Upload success for image ${i + 1}. ID: ${photoId}`);
      } catch (imgErr) {
        console.error(`[Background Publisher] Failed to upload image ${i + 1}:`, imgErr.message);
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
      console.log('[Background Publisher] Fetching seller addresses...');
      const addrRes = await fetch('https://webapi.depop.com/api/v1/shop/seller-addresses/', {
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

          console.log(`[Background Publisher] Fetching shipping providers for address: ${addressId}`);
          const providersRes = await fetch(`https://webapi.depop.com/api/v1/shop/seller-addresses/${addressId}/shipping-providers/`, {
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
              console.log('[Background Publisher] Dynamically resolved shipping method:', shippingMethods);
            }
          }
        }
      }
    } catch (shipErr) {
      console.error('[Background Publisher] Failed to resolve shipping details dynamically:', shipErr.message);
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
      listing_lifecycle_id: crypto.randomUUID(),
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
      persistent_id: crypto.randomUUID(),
      quantity: null
    };

    console.log('[Background Publisher] Step 2: Creating listing on Depop...');
    const saveRes = await fetch('https://webapi.depop.com/presentation/api/v1/listing/products/', {
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
      const errBody = await saveRes.json().catch(() => null);
      const details = errBody?.message || JSON.stringify(errBody);
      throw new Error(`Depop Save Failed: ${details}`);
    }

    const savedData = await saveRes.json();
    console.log('[Background Publisher] Listing saved successfully on Depop!');
    
    const depopId = savedData.id || '';
    const depopSlug = savedData.slug || '';
    const depopUrl = depopSlug ? `https://www.depop.com/products/${depopSlug}/` : `https://www.depop.com/products/${depopId}/`;

    return {
      success: true,
      id: String(depopId),
      url: depopUrl
    };
  } catch (err) {
    console.error('[Background Publisher] Failed to publish on Depop:', err.message);
    return { success: false, error: err.message };
  }
}
