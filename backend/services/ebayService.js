const axios = require('axios');
const qs = require('qs');
const sharp = require('sharp');
const FormData = require('form-data');

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;

const API_BASE_URL = 'https://api.ebay.com';

const MEDIA_API_BASE_URL = 'https://apim.ebay.com';

const TRADING_API_URL = 'https://api.ebay.com/ws/api.dll';

const AUTH_BASE_URL = 'https://auth.ebay.com';

let cachedAppToken = null;
let appTokenExpiry = null;

/**
 * Gets an App-Only Access Token (Client Credentials Grant)
 * Uses caching to prevent rate-limiting and 'invalid_client' errors on high frequency calls.
 */
async function getAppToken() {
    if (cachedAppToken && appTokenExpiry && Date.now() < appTokenExpiry) {
        return cachedAppToken;
    }

    const authHeader = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/identity/v1/oauth2/token`, 
            qs.stringify({
                grant_type: 'client_credentials',
                scope: 'https://api.ebay.com/oauth/api_scope'
            }), 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${authHeader}`
                }
            }
        );
        
        cachedAppToken = response.data.access_token;
        // eBay tokens are usually valid for 7200 seconds (2 hours), cache for 1 hour (3600000 ms) to be safe
        appTokenExpiry = Date.now() + 3600000; 
        
        return cachedAppToken;
    } catch (error) {
        console.error('Error getting eBay App Token:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Generates the User Consent URL
 */
function getUserConsentUrl(ruName, state = 'dashboard') {
    const scope = [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
    ].join(' ');

    return `${AUTH_BASE_URL}/oauth2/authorize?client_id=${EBAY_APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(ruName)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
}

/**
 * Exchanges Auth Code for User Access Token
 */
async function getUserToken(code, ruName) {
    const authHeader = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

    try {
        const response = await axios.post(`${API_BASE_URL}/identity/v1/oauth2/token`,
            qs.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: ruName
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${authHeader}`
                }
            }
        );
        return response.data; // Includes access_token and refresh_token
    } catch (error) {
        console.error('Error getting User Token:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Refreshes an expired User Access Token
 */
async function refreshUserToken(refreshToken) {
    const authHeader = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

    const scope = [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
    ].join(' ');

    try {
        const response = await axios.post(`${API_BASE_URL}/identity/v1/oauth2/token`,
            qs.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                scope: scope
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${authHeader}`
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        throw error;
    }
}
/**
 * Step 1: Create or Replace Inventory Item
 */
async function createOrReplaceInventoryItem(token, sku, productData) {
    try {
        const response = await axios.put(`${API_BASE_URL}/sell/inventory/v1/inventory_item/${sku}`, productData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error creating inventory item ${sku}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Step 2: Create Offer
 */
async function createOffer(token, offerData) {
    try {
        const response = await axios.post(`${API_BASE_URL}/sell/inventory/v1/offer`, offerData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US',
                'Content-Type': 'application/json'
            }
        });
        return response.data; // Includes offerId
    } catch (error) {
        // Return the error data so the controller can handle "Offer already exists"
        throw error;
    }
}

/**
 * Gets all offers for a specific SKU
 */
async function getOffers(token, sku) {
    try {
        const response = await axios.get(`${API_BASE_URL}/sell/inventory/v1/offer?sku=${sku}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US'
            }
        });
        return response.data.offers || [];
    } catch (error) {
        console.error(`Error fetching offers for SKU ${sku}:`, error.response?.data || error.message);
        return [];
    }
}

/**
 * Step 3: Publish Offer
 */
async function publishOffer(token, offerId) {
    try {
        const response = await axios.post(`${API_BASE_URL}/sell/inventory/v1/offer/${offerId}/publish`, {}, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data; // Includes listingId
    } catch (error) {
        console.error(`Error publishing offer ${offerId}:`, error.response?.data || error.message);
        throw error;
    }
}

async function deleteOffer(token, offerId) {
    try {
        const response = await axios.delete(`${API_BASE_URL}/sell/inventory/v1/offer/${offerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting offer ${offerId}:`, error.response?.data || error.message);
        throw error;
    }
}

async function deleteInventoryItem(token, sku) {
    try {
        const response = await axios.delete(`${API_BASE_URL}/sell/inventory/v1/inventory_item/${sku}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting inventory item ${sku}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Step 4: Create or Update Location
 */
async function createOrUpdateLocation(token, locationKey, locationData) {
    try {
        const response = await axios.post(`${API_BASE_URL}/sell/inventory/v1/location/${locationKey}`, locationData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Language': 'en-US'
            }
        });
        return response.data;
    } catch (error) {
        const ebayError = error.response?.data?.errors?.[0];
        const errorMsg = ebayError?.message || error.message || "";
        // Error 25002 or message contains "already exists"
        if (ebayError?.errorId === 25002 || errorMsg.toLowerCase().includes("already exists")) {
            console.log(`Location ${locationKey} already exists, skipping creation.`);
            return { message: 'Location already exists' };
        }
        console.error(`Error with location ${locationKey}:`, error.response?.data || error.message);
        throw error;
    }
}

async function getLocations(token) {
    try {
        const response = await axios.get(`${API_BASE_URL}/sell/inventory/v1/location`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Language': 'en-US'
            }
        });
        return response.data.locations || [];
    } catch (error) {
        console.error('Error fetching eBay locations:', error.response?.data || error.message);
        return [];
    }
}

/**
 * Get Business Policies (Needed for Offers)
 */
async function getFulfillmentPolicies(token, marketplaceId = 'EBAY_US') {
    const response = await axios.get(`${API_BASE_URL}/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Language': 'en-US'
        }
    });
    return response.data.fulfillmentPolicies || [];
}

async function getPaymentPolicies(token, marketplaceId = 'EBAY_US') {
    const response = await axios.get(`${API_BASE_URL}/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Language': 'en-US'
        }
    });
    return response.data.paymentPolicies || [];
}

async function getReturnPolicies(token, marketplaceId = 'EBAY_US') {
    const response = await axios.get(`${API_BASE_URL}/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Language': 'en-US'
        }
    });
    return response.data.returnPolicies || [];
}

async function initDefaultFulfillmentPolicy(token) {
    const policy = {
        name: 'Automation_Ship_' + Date.now(),
        description: 'Automated shipping policy for US production',
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        handlingTime: { value: 1, unit: 'DAY' },
        shippingOptions: [{
            optionType: 'DOMESTIC',
            costType: 'FLAT_RATE',
            shippingServices: [{
                shippingServiceCode: 'USPSPriority',
                shippingCost: { value: '0.00', currency: 'USD' }
            }]
        }],
        shipToLocations: {
            regionIncluded: [{ regionName: 'US' }]
        }
    };
    const res = await axios.post(`${API_BASE_URL}/sell/account/v1/fulfillment_policy`, policy, {
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'Content-Language': 'en-US'
        }
    });
    return res.data;
}

async function initDefaultPaymentPolicy(token) {
    const policy = {
        name: 'Automation_Pay_' + Date.now(),
        description: 'Automated payment policy',
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        paymentMethods: [{ paymentMethodType: 'INTEGRATED_MERCHANT_PAYMENTS' }]
    };
    const res = await axios.post(`${API_BASE_URL}/sell/account/v1/payment_policy`, policy, {
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'Content-Language': 'en-US'
        }
    });
    return res.data;
}

async function initDefaultReturnPolicy(token) {
    const policy = {
        name: 'Automation_Ret_' + Date.now(),
        description: 'Automated return policy',
        marketplaceId: 'EBAY_US',
        categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
        returnsAccepted: true,
        returnPeriod: { value: 30, unit: 'DAY' },
        returnShippingCostPayer: 'BUYER'
    };
    const res = await axios.post(`${API_BASE_URL}/sell/account/v1/return_policy`, policy, {
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'Content-Language': 'en-US'
        }
    });
    return res.data;
}

/**
 * Gets Item Aspects for a specific Category from Taxonomy API
 */
/**
 * Gets category suggestions for a keyword from Taxonomy API
 */
async function getCategorySuggestions(token, query, categoryTreeId = '0') {
    try {
        const response = await axios.get(`${API_BASE_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data.categorySuggestions || [];
    } catch (error) {
        console.error(`Error getting category suggestions for ${query}:`, error.response?.data || error.message);
        return [];
    }
}

async function getItemAspectsForCategory(token, categoryId, categoryTreeId = '0') {
    try {
        const response = await axios.get(`${API_BASE_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_item_aspects_for_category?category_id=${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error getting item aspects for category ${categoryId}:`, error.response?.data || error.message);
        // Return null or empty instead of throwing to prevent breaking the flow
        return null;
    }
}

/**
 * Gets valid Item Conditions for a specific Category from Taxonomy API
 */
async function getItemConditions(token, categoryId, categoryTreeId = '0') {
    try {
        const response = await axios.get(`${API_BASE_URL}/commerce/taxonomy/v1/category_tree/${categoryTreeId}/get_item_conditions?category_id=${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data.itemConditions || [];
    } catch (error) {
        console.error(`Error getting item conditions for category ${categoryId}:`, error.response?.data || error.message);
        return [];
    }
}

/**
 * Uploads a picture to eBay Picture Services (EPS)
 * This allows using local Base64 images with the REST Inventory API.
 */
function parseEpsError(xmlResponse = '') {
    const shortMatch = xmlResponse.match(/<ShortMessage>([\s\S]*?)<\/ShortMessage>/);
    const longMatch = xmlResponse.match(/<LongMessage>([\s\S]*?)<\/LongMessage>/);
    const codeMatch = xmlResponse.match(/<ErrorCode>([\s\S]*?)<\/ErrorCode>/);
    const shortMsg = shortMatch ? shortMatch[1] : '';
    const longMsg = longMatch ? longMatch[1] : '';
    const code = codeMatch ? codeMatch[1] : '';
    const message = longMsg || shortMsg || `Unknown eBay Error. Raw: ${xmlResponse.substring(0, 200)}`;
    return { code, message };
}

async function uploadPictureFromUrl(userToken, externalPictureUrl) {
    try {
        if (typeof externalPictureUrl !== 'string' || !/^https?:\/\//i.test(externalPictureUrl.trim())) {
            throw new Error('Invalid ExternalPictureURL');
        }

        const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ExternalPictureURL>${externalPictureUrl.trim()}</ExternalPictureURL>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>`;

        const response = await axios.post(TRADING_API_URL, xmlPayload, {
            headers: {
                'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
                'X-EBAY-API-SITEID': '0',
                'X-EBAY-API-APP-NAME': EBAY_APP_ID,
                'X-EBAY-API-DEV-NAME': EBAY_DEV_ID,
                'X-EBAY-API-CERT-NAME': EBAY_CERT_ID,
                'X-EBAY-API-COMPATIBILITY-LEVEL': '1113',
                'X-EBAY-API-IAF-TOKEN': userToken,
                'Content-Type': 'text/xml; charset=utf-8'
            }
        });

        if (response.data.includes('<Ack>Failure</Ack>') || response.data.includes('<Ack>Error</Ack>')) {
            const { code, message } = parseEpsError(response.data);
            throw new Error("eBay EPS Error" + (code ? " (" + code + ")" : "") + ": " + message);
        }

        const match = response.data.match(/<SiteHostedPictureDetails>[\s\S]*?<FullURL>(.*?)<\/FullURL>/);
        if (match && match[1]) return match[1];
        throw new Error(`Failed to extract image URL. Response start: ${response.data.substring(0, 150)}`);
    } catch (error) {
        console.error('Error uploading URL to eBay EPS:', error.message);
        throw error;
    }
}

async function createImageFromUrl(userToken, imageUrl) {
    try {
        if (typeof imageUrl !== 'string' || !/^https:\/\//i.test(imageUrl.trim())) {
            throw new Error('Media API requires a public HTTPS image URL');
        }

        const response = await axios.post(
            `${MEDIA_API_BASE_URL}/commerce/media/v1_beta/image/create_image_from_url`,
            { imageUrl: imageUrl.trim() },
            {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const uploadedUrl = response.data?.imageUrl;
        if (!uploadedUrl || !/^https?:\/\//i.test(uploadedUrl)) {
            throw new Error(`Media API response missing imageUrl: ${JSON.stringify(response.data || {})}`);
        }
        return uploadedUrl;
    } catch (error) {
        const mediaError =
            error.response?.data?.errors?.[0]?.message ||
            error.response?.data?.errors?.[0]?.longMessage ||
            error.message;
        console.error('Error uploading image URL via eBay Media API:', mediaError);
        throw new Error(`eBay Media API Error: ${mediaError}`);
    }
}

async function createImageFromFile(userToken, imageBuffer, filename = `upload-${Date.now()}.jpg`, contentType = 'image/jpeg') {
    try {
        if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
            throw new Error('Media API file upload requires a non-empty image buffer');
        }

        const form = new FormData();
        form.append('image', imageBuffer, { filename, contentType });

        const response = await axios.post(
            `${MEDIA_API_BASE_URL}/commerce/media/v1_beta/image/create_image_from_file`,
            form,
            {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    ...form.getHeaders()
                },
                maxBodyLength: Infinity
            }
        );

        const uploadedUrl = response.data?.imageUrl;
        if (!uploadedUrl || !/^https?:\/\//i.test(uploadedUrl)) {
            throw new Error(`Media API file response missing imageUrl: ${JSON.stringify(response.data || {})}`);
        }
        return uploadedUrl;
    } catch (error) {
        const mediaError =
            error.response?.data?.errors?.[0]?.message ||
            error.response?.data?.errors?.[0]?.longMessage ||
            error.message;
        console.error('Error uploading image file via eBay Media API:', mediaError);
        throw new Error(`eBay Media API File Error: ${mediaError}`);
    }
}

async function uploadPicture(userToken, base64Data) {
    try {
        if (typeof base64Data !== 'string' || !base64Data.trim()) {
            throw new Error('Invalid image payload for EPS upload');
        }
        if (/^https?:\/\//i.test(base64Data.trim())) {
            throw new Error('EPS upload received URL instead of Base64 data');
        }

        const trimmed = base64Data.trim();
        const dataUriMatch = trimmed.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
        let rawBase64 = dataUriMatch ? dataUriMatch[2] : trimmed;

        // Remove whitespace/newlines that may be introduced by transport/logging.
        rawBase64 = rawBase64.replace(/[\r\n\t\s]+/g, '');
        if (!/^[a-z0-9+/=]+$/i.test(rawBase64)) {
            throw new Error('Image data is not valid Base64');
        }

        const sourceBuffer = Buffer.from(rawBase64, 'base64');
        if (!sourceBuffer.length) {
            throw new Error('Decoded image buffer is empty');
        }

        const basePipeline = sharp(sourceBuffer)
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });

        // Retry strategy:
        // 1) Media API createImageFromFile (preferred)
        // 2) EPS UploadSiteHostedPictures fallback
        const candidates = [];
        try {
            const jpegBuffer = await basePipeline.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
            candidates.push({ ext: 'jpg', contentType: 'image/jpeg', buffer: jpegBuffer, base64: jpegBuffer.toString('base64') });
        } catch (jpegErr) {
            console.warn(`[EPS] JPEG normalization failed: ${jpegErr.message}`);
        }
        try {
            const pngBuffer = await basePipeline.clone().png({ compressionLevel: 9 }).toBuffer();
            candidates.push({ ext: 'png', contentType: 'image/png', buffer: pngBuffer, base64: pngBuffer.toString('base64') });
        } catch (pngErr) {
            console.warn(`[EPS] PNG normalization failed: ${pngErr.message}`);
        }

        if (!candidates.length) {
            throw new Error('Image normalization failed: no valid raster output generated');
        }

        let lastError = null;

        // Preferred path: upload normalized file to Media API.
        for (const [idx, candidate] of candidates.entries()) {
            try {
                console.log(`[MEDIA] Attempt ${idx + 1}/${candidates.length}: createImageFromFile (${candidate.ext.toUpperCase()})`);
                const mediaUrl = await createImageFromFile(
                    userToken,
                    candidate.buffer,
                    `upload-${Date.now()}.${candidate.ext}`,
                    candidate.contentType
                );
                return mediaUrl;
            } catch (mediaErr) {
                lastError = mediaErr;
                console.warn(`[MEDIA] createImageFromFile failed (${candidate.ext.toUpperCase()}): ${mediaErr.message}`);
            }
        }

        // Fallback: legacy EPS XML upload.
        for (const [idx, candidate] of candidates.entries()) {
            console.log(`[EPS] Attempt ${idx + 1}/${candidates.length}: ${candidate.ext.toUpperCase()} payload size ${candidate.base64.length} chars`);
            const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <PictureName>upload-${Date.now()}.${candidate.ext}</PictureName>
  <PictureData>${candidate.base64}</PictureData>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>`;

            const response = await axios.post(TRADING_API_URL, xmlPayload, {
                headers: {
                    'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
                    'X-EBAY-API-SITEID': '0',
                    'X-EBAY-API-APP-NAME': EBAY_APP_ID,
                    'X-EBAY-API-DEV-NAME': EBAY_DEV_ID,
                    'X-EBAY-API-CERT-NAME': EBAY_CERT_ID,
                    'X-EBAY-API-COMPATIBILITY-LEVEL': '1113',
                    'X-EBAY-API-IAF-TOKEN': userToken,
                    'Content-Type': 'text/xml; charset=utf-8'
                }
            });

            if (response.data.includes('<Ack>Failure</Ack>') || response.data.includes('<Ack>Error</Ack>')) {
                const { code, message } = parseEpsError(response.data);
                lastError = new Error("eBay EPS Error" + (code ? " (" + code + ")" : "") + ": " + message);
                continue;
            }

            const match = response.data.match(/<SiteHostedPictureDetails>[\s\S]*?<FullURL>(.*?)<\/FullURL>/);
            if (match && match[1]) {
                return match[1];
            }
            lastError = new Error(`Failed to extract image URL. Response start: ${response.data.substring(0, 150)}`);
        }

        throw lastError || new Error('Unknown EPS upload failure');
    } catch (error) {
        console.error('Error uploading to eBay EPS:', error.message);
        throw error;
    }
}

/**
 * Gets orders for the authenticated user from Fulfillment API
 * Filters: default is last 30 days, PAID status
 */
async function getOrders(token) {
    try {
        const response = await axios.get(`${API_BASE_URL}/sell/fulfillment/v1/order`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data; // { orders: [], total: X, ... }
    } catch (error) {
        console.error('Error fetching eBay orders:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Updates an order with tracking information
 * trackingData: { trackingNumber: string, shippingCarrierCode: string, lineItems: [{ lineItemId: string, quantity: number }] }
 */
async function updateShippingFulfillment(token, orderId, trackingData) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/sell/fulfillment/v1/order/${orderId}/shipping_fulfillment`,
            trackingData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error(`Error updating tracking for order ${orderId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Gets inventory items for the authenticated user
 * Supports pagination via limit and offset
 */
async function getInventoryItems(token, limit = 100, offset = 0) {
    try {
        const response = await axios.get(`${API_BASE_URL}/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data; // { inventoryItems: [], total: X, ... }
    } catch (error) {
        console.error('Error fetching eBay inventory items:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Gets the Authenticated User's Profile (Username/ID)
 */
async function getUserProfile(token) {
    try {
        const response = await axios.get(`https://apiz.ebay.com/commerce/identity/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching User Profile:', error.response?.data || error.message);
        // Fallback or re-throw
        return null;
    }
}

/**
 * Fetches valid conditions for a specific eBay category
 */
async function getCategoryConditions(token, categoryId) {
    try {
        console.log(`[EBAY API] Fetching conditions via Taxonomy API for category: ${categoryId}`);
        
        // 1. First try the dedicated Taxonomy Conditions endpoint (Deepak's preference)
        const conditions = await getItemConditions(token, categoryId);
        
        if (conditions && conditions.length > 0) {
            console.log(`[EBAY] Found ${conditions.length} conditions via Taxonomy Conditions API.`);
            return conditions.map(c => ({
                condition_id: c.conditionId,
                condition_name: c.conditionDisplayName,
                label: c.conditionDisplayName,
                id: c.conditionId, // Use the real eBay ConditionID
                name: c.conditionDisplayName
            }));
        }

        // 2. Fallback to Aspects if the direct endpoint returns nothing (unlikely for leaf categories)
        console.log(`[EBAY] No conditions from primary endpoint, falling back to Aspects for: ${categoryId}`);
        const aspectsData = await getItemAspectsForCategory(token, categoryId);
        
        if (aspectsData && aspectsData.aspects) {
            const conditionAspect = aspectsData.aspects.find(a => 
                a.localizedAspectName.toLowerCase().includes('condition')
            );

            if (conditionAspect && conditionAspect.aspectValues) {
                console.log(`[EBAY] Extracted ${conditionAspect.aspectValues.length} condition values from Aspects.`);
                return conditionAspect.aspectValues.map(v => ({
                    condition_id: v.localizedValue, // Fallback ID if real ID isn't found
                    condition_name: v.localizedValue,
                    label: v.localizedValue,
                    id: v.localizedValue, 
                    name: v.localizedValue
                }));
            }
        }
        
        console.warn(`[EBAY] No condition information found for category ${categoryId}`);
        return [];
    } catch (error) {
        console.error('Error fetching category conditions:', error.response?.data || error.message);
        return [];
    }
}

module.exports = {
    getAppToken,
    getUserConsentUrl,
    getUserToken,
    refreshUserToken,
    createImageFromUrl,
    createImageFromFile,
    uploadPicture,
    uploadPictureFromUrl,
    createOrReplaceInventoryItem,
    createOffer,
    deleteOffer,
    publishOffer,
    deleteInventoryItem,
    createOrUpdateLocation,
    getFulfillmentPolicies,
    getPaymentPolicies,
    getReturnPolicies,
    initDefaultFulfillmentPolicy,
    initDefaultPaymentPolicy,
    initDefaultReturnPolicy,
    getItemAspectsForCategory,
    getItemConditions,
    getCategorySuggestions,
    getOffers,
    getOrders,
    getInventoryItems,
    getCategoryConditions,
    updateShippingFulfillment,
    getUserProfile,
    getLocations
};
