const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
  if (!authToken) {
    throw new Error('Depop access token is missing. Please connect your Depop account.');
  }

  console.log(`[Depop Publisher] Initializing publish for listing: "${listing.title}"`);
  
  // Step 1: Upload Images
  const pictureIds = [];
  const images = listing.images || [];
  
  for (let i = 0; i < images.length; i++) {
    try {
      const imgBuffer = await downloadImageBuffer(images[i]);
      
      // A. Initialize picture upload on Depop
      console.log(`[Depop Publisher] Step 1.A: Initializing image upload ${i + 1} of ${images.length} on Depop...`);
      const initConfig = getAxiosConfig({
        method: 'POST',
        url: 'https://webapi.depop.com/api/v4/pictures/',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': authToken
        },
        data: {
          type: "product",
          extension: "jpg",
          dimensions: { width: 1280, height: 1280 }
        }
      });
      
      const initRes = await axios(initConfig);
      const initData = initRes.data;
      
      const photoId = initData.id || initData.picture_id || initData.pictureId || initData.sid;
      const uploadUrl = initData.url || initData.upload_url || initData.uploadUrl;
      
      if (!photoId || !uploadUrl) {
        throw new Error(`Invalid response structure: ${JSON.stringify(initData)}`);
      }
      
      // B. Upload binary image buffer to S3
      console.log(`[Depop Publisher] Step 1.B: PUT binary buffer to S3 for image ${i + 1}...`);
      const putConfig = getAxiosConfig({
        method: 'PUT',
        url: uploadUrl,
        headers: {
          'Content-Type': 'image/jpeg'
        },
        data: imgBuffer
      });
      
      await axios(putConfig);
      pictureIds.push(photoId);
      console.log(`[Depop Publisher] Upload success for image ${i + 1}. ID: ${photoId}`);
    } catch (imgErr) {
      console.error(`[Depop Publisher] Failed to upload image ${i + 1}:`, imgErr.message);
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

  // Build listing creation payload
  const savePayload = {
    age: listing.age ? [listing.age.toLowerCase()] : ["modern"],
    address: "United States", // default
    attributes: {},
    brand: (listing.brand || '').toLowerCase(),
    colour: listing.color ? [listing.color.toLowerCase()] : [],
    condition: mapCondition(listing.selectedCondition || listing.conditionId),
    country: "US",
    description: listing.description || '',
    gender: getGender(listing.category),
    geo_position_lat: 37.09024,
    geo_position_lng: -95.712891,
    is_kids: String(listing.category).toLowerCase().includes('kids'),
    listing_lifecycle_id: require('crypto').randomUUID(),
    national_shipping_cost: parseFloat(listing.shippingPrice || 0).toFixed(2),
    picture_ids: pictureIds,
    price_amount: parseFloat(listing.price || 0).toFixed(2),
    price_currency: "USD",
    product_type: listing.categoryId || "shirts",
    shipping_methods: [],
    sku: listing.sku || `KL${Date.now()}`,
    source: listing.source ? [listing.source.toLowerCase()] : ["preloved"],
    style: listing.styleTag ? listing.styleTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ["casual"],
    variant_set: 54, // default
    variants: { "5": 1 }, // default
    persistent_id: require('crypto').randomUUID(),
    quantity: null
  };

  // Step 3: Send save request to Depop
  console.log('[Depop Publisher] Step 2: Creating listing on Depop...');
  try {
    const saveConfig = getAxiosConfig({
      method: 'POST',
      url: 'https://webapi.depop.com/presentation/api/v1/listing/products/',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': authToken
      },
      data: savePayload
    });

    const saveRes = await axios(saveConfig);
    const savedData = saveRes.data;
    
    console.log('[Depop Publisher] Listing saved successfully on Depop!');
    
    const depopId = savedData.id || '';
    const depopSlug = savedData.slug || '';
    const depopUrl = depopSlug ? `https://www.depop.com/products/${depopSlug}/` : `https://www.depop.com/products/${depopId}/`;

    return {
      success: true,
      id: String(depopId),
      url: depopUrl
    };
  } catch (saveErr) {
    console.error(`[Depop Publisher] Failed to save listing on Depop:`, saveErr.response?.data || saveErr.message);
    const details = saveErr.response?.data?.message || JSON.stringify(saveErr.response?.data || saveErr.message);
    throw new Error(`Depop Save Failed: ${details}`);
  }
}

// -------------------------------------------------------------
// Poshmark Backend Publisher
// -------------------------------------------------------------
function resolvePoshmarkCategory(path) {
  const defaultRes = {
    department: '01008c10d97b4e1245005764', // Men
    category: '07008c10d97b4e1245005764', // Shirts
    subcategories: []
  };

  if (!path || typeof path !== 'string') return defaultRes;

  const parts = path.split('>').map(p => p.trim());
  if (parts.length === 0) return defaultRes;

  const deptName = parts[0].toLowerCase();
  const DEPARTMENTS = {
    'men': '01008c10d97b4e1245005764',
    'women': '01008c10d97b4e1245005763',
    'kids': '01008c10d97b4e1245005765',
    'home': '5c464bf26e4757c3d221aa90',
    'pets': '60abfaa1a415ff1c2ee1df39',
    'electronics': '60abfa98bfd32f1465e902b7',
    'beauty': '5d1cb37951e70e1762c90bc7'
  };
  const deptId = DEPARTMENTS[deptName] || DEPARTMENTS['men'];

  if (parts.length < 2) {
    return { department: deptId, category: '', subcategories: [] };
  }

  const catName = parts[1];
  
  // Mapped fallsback categories
  const commonCategories = {
    'shirts': '07008c10d97b4e1245005764',
    'tops': '07008c10d97b4e1245005764',
    'shoes': '03008c10d97b4e1245005764',
    'bags': '02008c10d97b4e1245005764',
    'jeans': '04008c10d97b4e1245005764',
    'pants': '05008c10d97b4e1245005764',
    'shorts': '06008c10d97b4e1245005764',
    'jackets & coats': '08008c10d97b4e1245005764',
    'accessories': '09008c10d97b4e1245005764',
    'dresses': '0b008c10d97b4e1245005764',
    'skirts': '0c008c10d97b4e1245005764',
    'sweaters': '0d008c10d97b4e1245005764'
  };
  
  const mappedCatId = commonCategories[catName.toLowerCase()] || defaultRes.category;
  
  return {
    department: deptId,
    category: mappedCatId,
    subcategories: []
  };
}

async function publishToPoshmark(listing, poshmarkAccount) {
  const csrfToken = poshmarkAccount.csrfToken;
  const sessionCookie = poshmarkAccount.sessionCookie;

  if (!csrfToken || !sessionCookie) {
    throw new Error('Poshmark cookies are missing. Please connect your Poshmark account.');
  }

  console.log(`[Poshmark Publisher] Initializing publish for listing: "${listing.title}"`);
  
  // Step 1: Create Draft Session on Poshmark
  console.log('[Poshmark Publisher] Step 1: Generating draft session on Poshmark...');
  let draftId;
  try {
    const draftConfig = getAxiosConfig({
      method: 'POST',
      url: 'https://poshmark.com/vm-rest/posts?pm_version=2026.23.01',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': sessionCookie,
        'x-xsrf-token': csrfToken,
        'x-csrf-token': csrfToken
      },
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
    throw new Error(`Poshmark Draft Session Failed: ${draftErr.message}`);
  }

  // Step 2: Upload Images
  const mediaIds = [];
  const images = listing.images || [];

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

      const uploadConfig = getAxiosConfig({
        method: 'POST',
        url: `https://poshmark.com/api/posts/${draftId}/media/scratch?app_type=web`,
        headers: {
          ...form.getHeaders(),
          'accept': 'application/json',
          'cookie': sessionCookie,
          'x-xsrf-token': csrfToken,
          'x-csrf-token': csrfToken
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
      console.log(`[Poshmark Publisher] Image upload success. Media ID: ${mediaId}`);
    } catch (imgErr) {
      console.error(`[Poshmark Publisher] Image upload failed for index ${i}:`, imgErr.message);
      throw new Error(`Poshmark Image Upload Failed: ${imgErr.message}`);
    }
  }

  if (mediaIds.length === 0) {
    throw new Error('No images uploaded successfully to Poshmark.');
  }

  // Step 3: Save Listing Attributes
  console.log('[Poshmark Publisher] Step 3: Saving listing attributes...');
  
  const mapCondition = (cond) => {
    const c = String(cond || '').toLowerCase();
    if (c === 'nwt') return 'nwt';
    if (c === 'like_new' || c === 'like new' || c === 'uln' || c === 'nwot') return 'like_new';
    if (c === 'good' || c === 'euc' || c === 'vguc' || c === 'guc') return 'good';
    if (c === 'fair') return 'fair';
    return 'like_new';
  };

  const resolved = resolvePoshmarkCategory(listing.categoryId || listing.category);
  
  const savePayload = {
    post: {
      title: listing.title,
      description: listing.description,
      brand: listing.brand || "",
      condition: mapCondition(listing.selectedCondition || listing.conditionId),
      price_amount: {
        val: parseFloat(listing.price) || 0,
        currency_code: "USD",
        currency_symbol: "$"
      },
      original_price_amount: {
        val: parseFloat(listing.originalPrice || 0) || 0,
        currency_code: "USD",
        currency_symbol: "$"
      },
      catalog: {
        department: resolved.department,
        category: resolved.category,
        category_features: resolved.subcategories
      },
      colors: listing.color ? [listing.color.split(',')[0].trim()] : [],
      style_tags: listing.styleTag ? listing.styleTag.split(',').map(s => s.trim()) : [],
      pictures: mediaIds.slice(1).map(id => ({ id })),
      cover_shot: { id: mediaIds[0] },
      inventory: {
        status: "available",
        multi_item: false,
        size_quantity_revision: 0,
        size_quantities: [
          {
            size_id: listing.size || "OS",
            size_obj: {
              id: listing.size || "OS",
              short: listing.size || "OS",
              long: listing.size || "OS",
              display: listing.size || "OS",
              display_with_size_set: listing.size || "OS",
              display_with_size_system: `US ${listing.size || "OS"}`,
              display_with_system_and_set: `US ${listing.size || "OS"}`,
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

  try {
    const saveConfig = getAxiosConfig({
      method: 'POST',
      url: `https://poshmark.com/vm-rest/posts/${draftId}?pm_version=2026.23.01`,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': sessionCookie,
        'x-xsrf-token': csrfToken,
        'x-csrf-token': csrfToken
      },
      data: savePayload
    });

    const saveRes = await axios(saveConfig);
    if (saveRes.data?.error) {
      throw new Error(saveRes.data.error.errorMessage || 'Unknown save details error');
    }
    console.log('[Poshmark Publisher] Attributes saved successfully!');
  } catch (saveErr) {
    console.error('[Poshmark Publisher] Attributes save failed:', saveErr.response?.data || saveErr.message);
    throw new Error(`Poshmark Save Attributes Failed: ${saveErr.message}`);
  }

  // Step 4: Publish Draft
  console.log('[Poshmark Publisher] Step 4: Activating listing to Poshmark live feed...');
  try {
    const publishConfig = getAxiosConfig({
      method: 'PUT',
      url: `https://poshmark.com/vm-rest/posts/${draftId}/status/published?app_version=2.55&pm_version=2026.23.01`,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': sessionCookie,
        'x-xsrf-token': csrfToken,
        'x-csrf-token': csrfToken
      },
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
      url: `https://poshmark.com/listing/${draftId}`
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
