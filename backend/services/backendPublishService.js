const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { POSHMARK_TAXONOMY } = require('../constants/poshmarkTaxonomy');

// Helper to construct axios config with HTTP Proxy support if configured
function getAxiosConfig(options) {
  const config = {
    method: options.method || 'GET',
    url: options.url,
    headers: options.headers || {},
    data: options.data || null,
    timeout: 30000
  };
  
  if (options.responseType) {
    config.responseType = options.responseType;
  }

  const proxyUrl = process.env.HTTP_PROXY_URL;
  if (proxyUrl) {
    console.log(`[Backend Publisher] Routing request to ${options.url} via proxy agent...`);
    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
  }
  
  return config;
}

// Helper to parse and merge set-cookie headers into a cookie string
function mergeSetCookies(currentCookieStr, setCookieHeader) {
  if (!setCookieHeader || !Array.isArray(setCookieHeader)) return currentCookieStr;
  
  const cookieMap = new Map();
  if (currentCookieStr) {
    currentCookieStr.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) {
        cookieMap.set(parts[0], parts.slice(1).join('='));
      }
    });
  }

  setCookieHeader.forEach(cookieStr => {
    const mainPart = cookieStr.split(';')[0];
    const parts = mainPart.trim().split('=');
    if (parts[0]) {
      cookieMap.set(parts[0], parts.slice(1).join('='));
    }
  });

  return Array.from(cookieMap.entries())
    .map(([name, val]) => `${name}=${val}`)
    .join('; ');
}

// Helper: Download image (URLs or local S3 uploads) and return it as a Buffer
async function downloadImageBuffer(imageUrl) {
  if (!imageUrl) {
    throw new Error('Image URL is empty');
  }

  // 1. Data URL (Base64)
  if (imageUrl.startsWith('data:')) {
    const commaIdx = imageUrl.indexOf(',');
    const base64Data = imageUrl.substring(commaIdx + 1);
    return Buffer.from(base64Data, 'base64');
  }

  // 2. Local relative upload path
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    // Clean relative slash
    const cleanPath = imageUrl.replace(/^\/+/, '');
    
    // Resolve absolute path in workspace
    // backend is at d:/Project/elister/backend
    const possiblePaths = [
      path.join(__dirname, '..', cleanPath),
      path.join(__dirname, '..', 'uploads', cleanPath.replace(/^uploads\//, ''))
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[Backend Publisher] Loading image from local file path: ${p}`);
        return fs.readFileSync(p);
      }
    }
  }

  // 3. Web URL
  console.log(`[Backend Publisher] Downloading image from web: ${imageUrl}`);
  const axiosConfig = getAxiosConfig({
    method: 'GET',
    url: imageUrl,
    responseType: 'arraybuffer'
  });
  
  const response = await axios(axiosConfig);
  return Buffer.from(response.data);
}

// -------------------------------------------------------------
// Depop Backend Publisher
// -------------------------------------------------------------
async function publishToDepop(listing, depopAccount) {
  const authToken = depopAccount.accessToken;
  const sessionCookie = depopAccount.sessionCookie;

  if (!authToken) {
    throw new Error('Depop access token is missing. Please connect your Depop account.');
  }

  // 1. Download images on the backend and convert them to Base64 (avoids mixed content issues in Puppeteer)
  const base64Images = [];
  for (const imgUrl of (listing.images || [])) {
    try {
      const cleanUrl = imgUrl.replace('//localhost:', '//127.0.0.1:');
      const imgBuffer = await downloadImageBuffer(cleanUrl);
      const base64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
      base64Images.push(base64);
    } catch (imgErr) {
      console.error('[Depop Publisher] Failed to convert image to base64 on backend:', imgErr.message);
    }
  }

  if (base64Images.length === 0) {
    throw new Error('Failed to prepare any listing images.');
  }

  // 2. Launch Puppeteer with Stealth Plugin
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  console.log('[Depop Publisher] Launching Puppeteer browser to publish listing...');
  
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  // Apply proxy if configured
  const proxyUrl = process.env.DEPOP_PROXY || undefined;
  if (proxyUrl) {
    const proxyHost = proxyUrl.replace(/https?:\/\//, '').split('@')[1] || proxyUrl.replace(/https?:\/\//, '');
    browserArgs.push(`--proxy-server=${proxyHost}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: browserArgs,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });

  const page = await browser.newPage();
  
  try {
    // Authenticate proxy if needed
    if (proxyUrl && proxyUrl.includes('@')) {
      const authPart = proxyUrl.split('@')[0].replace(/https?:\/\//, '');
      const [username, password] = authPart.split(':');
      await page.authenticate({ username, password });
    }

    // Set cookies of depop.com
    console.log('[Depop Publisher] Setting session cookies in Puppeteer...');
    const parsedCookies = [];
    if (sessionCookie) {
      const cookiePairs = sessionCookie.split(';');
      for (const pair of cookiePairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const name = trimmed.substring(0, index);
        const value = trimmed.substring(index + 1);
        parsedCookies.push({
          name,
          value,
          domain: '.depop.com',
          path: '/'
        });
      }
      await page.setCookie(...parsedCookies);
    }

    // Navigate to Depop to establish browser context origin
    console.log('[Depop Publisher] Navigating to Depop to initialize session...');
    await page.goto('https://www.depop.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Set authorization token in sessionStorage and localStorage
    await page.evaluate((token) => {
      window.sessionStorage.setItem('elister_captured_depop_token', token);
      window.localStorage.setItem('access_token', token.replace(/^Bearer\s+/i, ''));
    }, authToken);

    console.log('[Depop Publisher] Executing direct API upload inside Puppeteer page context...');
    
    // 3. Execute Direct API calls inside the browser context
    const publishResult = await page.evaluate(async (listingData, base64ImagesList, tokenString) => {
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

      try {
        const pictureIds = [];
        // Step A: Upload Images to Depop S3
        for (let i = 0; i < base64ImagesList.length; i++) {
          const imgBlob = base64ToBlob(base64ImagesList[i]);

          const initRes = await window.fetch('https://webapi.depop.com/api/v4/pictures/', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': tokenString
            },
            body: JSON.stringify({
              type: "product",
              extension: "jpg",
              dimensions: { width: 1280, height: 1280 }
            })
          });

          if (!initRes.ok) {
            const errBody = await initRes.text().catch(() => '');
            throw new Error(`Failed to initialize picture upload: Status ${initRes.status}. Details: ${errBody}`);
          }

          const initData = await initRes.json();
          const photoId = initData.id || initData.picture_id || initData.pictureId;
          const uploadUrl = initData.url || initData.upload_url || initData.uploadUrl;

          const putRes = await window.fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: imgBlob
          });

          if (!putRes.ok) {
            throw new Error(`Failed to upload image to S3: Status ${putRes.status}`);
          }

          pictureIds.push(photoId);
        }

        // Resolve attributes and build payload
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
          const addrRes = await window.fetch('https://webapi.depop.com/api/v1/shop/seller-addresses/', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': tokenString
            }
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

              const providersRes = await window.fetch(`https://webapi.depop.com/api/v1/shop/seller-addresses/${addressId}/shipping-providers/`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Authorization': tokenString
                }
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
                    price: parseFloat(listingData.shippingPrice || 0).toFixed(2)
                  }];
                }
              }
            }
          }
        } catch (shipErr) {
          console.error('[Page Context] Failed to resolve shipping details:', shipErr.message);
        }

        const savePayload = {
          age: listingData.age ? [listingData.age.toLowerCase()] : ["modern"],
          address: sellerAddress,
          attributes: {},
          brand: (listingData.brand || '').toLowerCase(),
          colour: listingData.color ? [listingData.color.toLowerCase()] : [],
          condition: mapCondition(listingData.selectedCondition || listingData.conditionId),
          country: sellerCountry,
          description: listingData.description || '',
          gender: getGender(listingData.category),
          geo_position_lat: sellerGeo.lat,
          geo_position_lng: sellerGeo.lng,
          is_kids: String(listingData.category).toLowerCase().includes('kids'),
          listing_lifecycle_id: window.crypto.randomUUID(),
          national_shipping_cost: parseFloat(listingData.shippingPrice || 0).toFixed(2),
          picture_ids: pictureIds,
          price_amount: parseFloat(listingData.price || 0).toFixed(2),
          price_currency: "USD",
          product_type: listingData.categoryId || "shirts",
          shipping_methods: shippingMethods,
          sku: listingData.sku || `KL${Date.now()}`,
          source: listingData.source ? [listingData.source.toLowerCase()] : ["preloved"],
          style: listingData.styleTag ? listingData.styleTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ["casual"],
          variant_set: 54, // default
          variants: (() => {
            const qty = parseInt(listingData.quantity) || 1;
            return { "4": qty }; // Default M
          })(),
          persistent_id: window.crypto.randomUUID(),
          quantity: null
        };

        const saveRes = await window.fetch('https://webapi.depop.com/presentation/api/v1/listing/products/', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': tokenString
          },
          body: JSON.stringify(savePayload)
        });

        if (!saveRes.ok) {
          const errBody = await saveRes.json().catch(() => null);
          const details = errBody?.message || JSON.stringify(errBody);
          throw new Error(`Depop Save Failed: ${details}`);
        }

        const savedData = await saveRes.json();
        return {
          success: true,
          id: String(savedData.id),
          slug: savedData.slug
        };

      } catch (err) {
        return { success: false, error: err.message };
      }
    }, listing, base64Images, authToken);

    if (!publishResult.success) {
      throw new Error(publishResult.error || 'Failed to publish to Depop inside browser context.');
    }

    console.log('[Depop Publisher] Listing published successfully via Puppeteer!');
    const depopId = publishResult.id;
    const depopSlug = publishResult.slug;
    const depopUrl = depopSlug ? `https://www.depop.com/products/${depopSlug}/` : `https://www.depop.com/products/${depopId}/`;

    return {
      success: true,
      id: depopId,
      url: depopUrl
    };

  } finally {
    await browser.close();
    console.log('[Depop Publisher] Puppeteer browser closed.');
  }
}


// -------------------------------------------------------------
// Poshmark Backend Publisher
// -------------------------------------------------------------
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

function resolvePoshmarkCategory(path) {
  const defaultRes = {
    department: '01008c10d97b4e1245005764', // Men
    category: '07008c10d97b4e1245005764', // Shirts
    subcategories: []
  };

  if (!path || typeof path !== 'string') return defaultRes;

  // Try to find matching taxonomy entry in POSHMARK_TAXONOMY
  const cleanPath = path.toLowerCase().replace(/\s+/g, ' ');
  const matched = POSHMARK_TAXONOMY.find(c => c.path.toLowerCase().replace(/\s+/g, ' ') === cleanPath);
  if (matched) {
    return {
      department: matched.departmentId,
      category: matched.categoryId,
      subcategories: matched.id !== matched.categoryId ? [matched.id] : []
    };
  }

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
  
  // Hardcoded fallback list for standard categories
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

function getDomainFromCookie(sessionCookie) {
  if (sessionCookie) {
    const match = sessionCookie.match(/elister_domain=([^;]+)/);
    if (match) {
      const domain = match[1].trim();
      return domain.replace(/^www\./i, '');
    }
  }
  return 'poshmark.com';
}

function getUserIdFromSessionCookie(sessionCookie) {
  if (sessionCookie) {
    // 1. Try parsing from jwt cookie
    const jwtMatch = sessionCookie.match(/jwt=([^;]+)/);
    if (jwtMatch) {
      try {
        const payloadBase64 = jwtMatch[1].split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        if (payload.user_id) {
          return payload.user_id;
        }
      } catch (e) {
        console.error('[Poshmark Publisher] Error parsing user ID from jwt:', e);
      }
    }
    
    // 2. Try parsing from ui cookie
    const uiMatch = sessionCookie.match(/ui=([^;]+)/);
    if (uiMatch) {
      try {
        const decoded = decodeURIComponent(uiMatch[1]);
        const uiObj = JSON.parse(decoded);
        if (uiObj && uiObj.uid) {
          return uiObj.uid;
        }
      } catch (e) {
        console.error('[Poshmark Publisher] Error parsing user ID from ui cookie:', e);
      }
    }
  }
  return null;
}

function cleanCookieHeader(sessionCookie) {
  if (!sessionCookie) return '';
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

function getPoshmarkHeaders(sessionCookie, csrfToken) {
  const domain = getDomainFromCookie(sessionCookie);
  const cleanCookie = cleanCookieHeader(sessionCookie);
  return {
    'accept': 'application/json',
    'content-type': 'application/json',
    'cookie': cleanCookie,
    'x-xsrf-token': csrfToken,
    'x-csrf-token': csrfToken,
    'origin': `https://${domain}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': `https://${domain}/create-listing`
  };
}

async function publishToPoshmark(listing, poshmarkAccount) {
  let sessionCookie = poshmarkAccount.sessionCookie;
  const csrfToken = poshmarkAccount.csrfToken;

  if (!csrfToken || !sessionCookie) {
    throw new Error('Poshmark cookies are missing. Please connect your Poshmark account.');
  }

  if (!sessionCookie.includes('_poshmark_session=') && !sessionCookie.includes('jwt=')) {
    throw new Error('Your Poshmark session has expired or is invalid. Please open Poshmark.com in a new tab, ensure you are logged in, and then visit the integrations/accounts page on eLister to re-connect your account.');
  }

  const domain = getDomainFromCookie(sessionCookie);

  // If _poshmark_session is missing but jwt is present, try to establish the session cookie dynamically
  if (!sessionCookie.includes('_poshmark_session=') && sessionCookie.includes('jwt=')) {
    console.log(`[Poshmark Publisher] _poshmark_session is missing from user cookies. Establishing it on-the-fly...`);
    try {
      const cleanCookie = cleanCookieHeader(sessionCookie);
      const resConfig = getAxiosConfig({
        method: 'GET',
        url: `https://${domain}/create-listing`,
        headers: {
          'cookie': cleanCookie,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const res = await axios(resConfig);
      
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const mergedCookie = mergeSetCookies(sessionCookie, setCookies);
        if (mergedCookie.includes('_poshmark_session=')) {
          sessionCookie = mergedCookie;
          poshmarkAccount.sessionCookie = mergedCookie; // Update in reference so controller can save it
          console.log(`[Poshmark Publisher] Successfully established and merged _poshmark_session cookie.`);
        }
      }
    } catch (sessionErr) {
      console.error(`[Poshmark Publisher] Failed to establish session on-the-fly:`, sessionErr.message);
    }
  }

  console.log(`[Poshmark Publisher] Initializing publish for listing: "${listing.title}" on domain: ${domain}`);
  
  // Step 1: Create Draft Session on Poshmark
  console.log('[Poshmark Publisher] Step 1: Generating draft session on Poshmark...');
  let draftId;
  try {
    const userId = getUserIdFromSessionCookie(sessionCookie);
    if (!userId) {
      throw new Error('Poshmark User ID not found in session cookies. Please reconnect your account.');
    }

    const draftConfig = getAxiosConfig({
      method: 'POST',
      url: `https://${domain}/vm-rest/users/${userId}/posts?pm_version=2026.26.01`,
      headers: getPoshmarkHeaders(sessionCookie, csrfToken),
      data: { post: { autolist_draft: false } }
    });

    const draftRes = await axios(draftConfig);
    const draftData = draftRes.data;
    
    draftId = draftData.post?.id || draftData.id;
    if (!draftId) {
      throw new Error(`Failed to generate draft. Response: ${JSON.stringify(draftData)}`);
    }
    console.log(`[Poshmark Publisher] Draft session created. Draft ID: ${draftId}`);
  } catch (draftErr) {
    console.error('[Poshmark Publisher] Draft session failed:', draftErr.response?.data || draftErr.message);
    throw new Error(`Draft Creation Failed: ${draftErr.response?.data?.error?.errorMessage || draftErr.message}`);
  }

  // Step 2: Upload Images to Poshmark Draft
  const images = listing.images || [];
  if (images.length === 0) {
    throw new Error('At least one image is required to publish to Poshmark.');
  }

  const mediaIds = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const imgBuffer = await downloadImageBuffer(images[i]);
      
      console.log(`[Poshmark Publisher] Step 2: Uploading image ${i + 1} of ${images.length} on Poshmark...`);
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', imgBuffer, {
        filename: `file${i}.jpg`,
        contentType: 'image/jpeg'
      });

      const uploadHeaders = getPoshmarkHeaders(sessionCookie, csrfToken);
      delete uploadHeaders['content-type']; // Let form-data boundary work
      const uploadConfig = getAxiosConfig({
        method: 'POST',
        url: `https://${domain}/api/posts/${draftId}/media/scratch?app_type=web`,
        headers: {
          ...uploadHeaders,
          ...form.getHeaders()
        },
        data: form
      });

      const uploadRes = await axios(uploadConfig);
      const uploadData = uploadRes.data;
      
      const mediaId = uploadData.id || uploadData.media?.id;
      if (!mediaId) {
        throw new Error(`No media ID returned: ${JSON.stringify(uploadData)}`);
      }
      mediaIds.push(mediaId);
      console.log(`[Poshmark Publisher] Image ${i + 1} uploaded successfully. Media ID: ${mediaId}`);
    } catch (imgErr) {
      console.error(`[Poshmark Publisher] Image ${i + 1} upload failed:`, imgErr.response?.data || imgErr.message);
      throw new Error(`Image Upload Failed: ${imgErr.message}`);
    }
  }

  // Step 3: Populate and Save Listing Attributes
  console.log('[Poshmark Publisher] Step 3: Synchronizing draft attributes and categories...');
  const size = listing.size || 'OS';
  const brand = listing.brand || 'Original';
  const price = parseFloat(listing.price || '0');
  const originalPrice = parseFloat(listing.originalPrice || '0') || 0;

  // Resolve category features (subcategories) to flat string IDs
  const resolvedSubcats = Array.isArray(listing.subcategoryIds) 
    ? listing.subcategoryIds.map(id => typeof id === 'object' && id ? (id.id || id._id || String(id)) : String(id))
    : [];

  // Parse colors
  let postColors = [];
  if (listing.colors) {
    postColors = Array.isArray(listing.colors) ? listing.colors : [listing.colors];
  } else if (listing.color) {
    postColors = [listing.color];
  }

  // Parse style tags
  let postStyleTags = [];
  if (Array.isArray(listing.styleTags)) {
    postStyleTags = listing.styleTags;
  } else if (listing.styleTag) {
    postStyleTags = listing.styleTag.split(',').map(t => t.trim()).filter(Boolean);
  }

  // Map Poshmark condition
  const mapPoshmarkCondition = (cond) => {
    const c = String(cond || '').toLowerCase();
    if (c === 'nwt' || c === 'new with tags') return 'nwt';
    if (c === 'like_new' || c === 'like new' || c === 'uln' || c === 'nwot' || c === 'new without tags') return 'uln';
    if (c === 'good' || c === 'euc' || c === 'vguc' || c === 'guc' || c === 'ug') return 'ug';
    if (c === 'fair' || c === 'uf') return 'uf';
    return 'uln';
  };

  const savePayload = {
    post: {
      title: listing.title,
      description: listing.description,
      brand: brand,
      condition: mapPoshmarkCondition(listing.selectedCondition || listing.conditionId || listing.condition),
      price_amount: { val: price, currency_code: 'USD', currency_symbol: '$' },
      original_price_amount: { val: originalPrice, currency_code: 'USD', currency_symbol: '$' },
      catalog: {
        department: listing.departmentId || null,
        category: listing.categoryId || null,
        category_features: resolvedSubcats
      },
      colors: postColors,
      style_tags: postStyleTags,
      pictures: mediaIds.slice(1).map(id => ({ id })),
      cover_shot: mediaIds.length > 0 ? { id: mediaIds[0] } : null,
      inventory: {
        status: "available",
        multi_item: false,
        size_quantity_revision: 0,
        size_quantities: [
          {
            size_id: size,
            size_obj: {
              id: size,
              short: size,
              long: size,
              display: size,
              display_with_size_set: size,
              display_with_size_system: `US ${size}`,
              display_with_system_and_set: `US ${size}`,
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

  // TWO-STEP SAVE PREPARATION:
  // Update category and department first to avoid race condition where subcategories are validated against the old category.
  if (resolvedSubcats && resolvedSubcats.length > 0) {
    console.log('[Poshmark Publisher] Performing preliminary category update to sync Poshmark draft category...');
    try {
      const prePayload = JSON.parse(JSON.stringify(savePayload));
      prePayload.post.catalog.category_features = [];

      const preConfig = getAxiosConfig({
        method: 'POST',
        url: `https://${domain}/vm-rest/posts/${draftId}?pm_version=2026.23.01`,
        headers: getPoshmarkHeaders(sessionCookie, csrfToken),
        data: prePayload
      });
      const preRes = await axios(preConfig);
      if (preRes.status === 200) {
        console.log('[Poshmark Publisher] Preliminary category update succeeded. Waiting 3s for database propagation...');
        await new Promise(res => setTimeout(res, 3000));
      } else {
        console.warn('[Poshmark Publisher] Preliminary category update returned status:', preRes.status);
      }
    } catch (preErr) {
      console.warn('[Poshmark Publisher] Preliminary category update failed:', preErr.response?.data || preErr.message);
    }
  }

  let useCondition = true;
  const maxRetries = 5;
  let saveSuccess = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Poshmark Publisher] Save attributes attempt ${attempt} of ${maxRetries}...`);
    
    const currentPayload = JSON.parse(JSON.stringify(savePayload));
    if (!useCondition) {
      delete currentPayload.post.condition;
    }

    try {
      const saveConfig = getAxiosConfig({
        method: 'POST',
        url: `https://${domain}/vm-rest/posts/${draftId}?pm_version=2026.23.01`,
        headers: getPoshmarkHeaders(sessionCookie, csrfToken),
        data: currentPayload
      });

      const saveRes = await axios(saveConfig);
      
      const responseData = saveRes.data;
      if (responseData && responseData.error) {
        const errMsg = responseData.error.errorMessage || responseData.error.userMessage || responseData.error.errorType || "";
        if (errMsg.includes("Error processing image") && attempt < maxRetries) {
          console.warn(`[Poshmark Publisher] Poshmark server still processing images. Retrying in 2.5 seconds...`);
          await new Promise(res => setTimeout(res, 2500));
          continue;
        }
        if (errMsg.includes("condition") && useCondition) {
          console.warn(`[Poshmark Publisher] Condition attribute rejected by Poshmark taxonomy. Disabling and retrying...`);
          useCondition = false;
          attempt--; // Retry immediately without consuming attempt
          continue;
        }
        throw new Error(errMsg);
      }
      
      saveSuccess = true;
      console.log(`[Poshmark Publisher] Attributes successfully saved.`);
      break;
    } catch (saveErr) {
      console.error(`[Poshmark Publisher] Attribute save attempt ${attempt} failed:`, saveErr.response?.data || saveErr.message);
      if (attempt === maxRetries) {
        throw new Error(`Attribute Save Failed: ${saveErr.response?.data?.error?.errorMessage || saveErr.message}`);
      }
      // Delay before retrying
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  
  if (!saveSuccess) {
    throw new Error('Poshmark Save Attributes Failed after maximum retries');
  }

  // Step 4: Publish Draft
  console.log('[Poshmark Publisher] Step 4: Activating listing to Poshmark live feed...');
  try {
    const publishConfig = getAxiosConfig({
      method: 'PUT',
      url: `https://${domain}/vm-rest/posts/${draftId}/status/published?app_version=2.55&pm_version=2026.23.01`,
      headers: getPoshmarkHeaders(sessionCookie, csrfToken),
      data: {}
    });

    const publishRes = await axios(publishConfig);
    const publishData = publishRes.data;
    
    if (publishData?.error) {
      throw new Error(publishData.error.errorMessage || 'Unknown publish status activation error');
    }

    const finalStatus = publishData.status || publishData.post?.status;
    if (finalStatus && finalStatus !== 'published') {
      throw new Error(`Status remains ${finalStatus}. Expected published.`);
    }

    console.log('[Poshmark Publisher] Listing published successfully!');
    return {
      success: true,
      id: draftId,
      url: `https://${domain.replace('www.', '')}/listing/${draftId}`
    };
  } catch (pubErr) {
    console.error('[Poshmark Publisher] Publication failed:', pubErr.response?.data || pubErr.message);
    throw new Error(`Poshmark Activation Failed: ${pubErr.message}`);
  }
}

module.exports = {
  publishToDepop,
  publishToPoshmark
};
