const OpenAI = require('openai');
const sharp = require('sharp');
const { bulkSaveDrafts, bulkPublishListings } = require('../services/bulkListingEbayService');
const ebayService = require('../services/ebayService');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { wrapInTemplate } = require('../services/descriptionService');
const { logActivity } = require('../utils/activityUtils');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEFAULT_TITLE_SEQUENCE = ['Brand', 'Product Type', 'Model / Series', 'Material', 'Key Features', 'Size'];

async function compressImageIfBase64(base64Str) {
  if (!base64Str || !base64Str.startsWith('data:')) {
    return base64Str;
  }
  try {
    const commaIdx = base64Str.indexOf(',');
    if (commaIdx === -1) return base64Str;
    
    const prefix = base64Str.substring(0, commaIdx);
    if (!prefix.includes(';base64')) {
      return base64Str;
    }

    const base64Data = base64Str.substring(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');
    const compressedBuffer = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Image compression error:', error.message);
    return base64Str;
  }
}
async function callOpenAiWithRetry(aiClient, params, maxRetries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await aiClient.chat.completions.create(params);
    } catch (error) {
      const isRateLimit = error.status === 429 || 
                          error.code === 'rate_limit_exceeded' || 
                          (error.message && error.message.toLowerCase().includes('rate limit'));
      if (isRateLimit && attempt < maxRetries) {
        let retryAfterMs = delayMs * attempt;
        if (error.headers) {
          // Headers object might support headers.get or just key access
          const getHeader = (name) => {
            if (typeof error.headers.get === 'function') return error.headers.get(name);
            return error.headers[name] || error.headers[name.toLowerCase()];
          };
          const retryHeader = getHeader('retry-after-ms') || getHeader('retry-after');
          if (retryHeader) {
            const parsed = parseInt(retryHeader, 10);
            if (!isNaN(parsed)) {
              retryAfterMs = parsed * (String(retryHeader).includes('ms') ? 1 : 1000);
            }
          }
        }
        console.warn(`[AI] Rate limit hit. Retrying attempt ${attempt}/${maxRetries} after ${retryAfterMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
      } else {
        throw error;
      }
    }
  }
}



// @desc    Bulk save listings as drafts
// @route   POST /api/bulklistingebay/save-drafts
// @access  Private
exports.saveDrafts = async (req, res) => {
  try {
    const { listings } = req.body;
    if (!listings || !Array.isArray(listings)) {
      return res.status(400).json({ success: false, message: 'Listings array is required.' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    console.log(`[BULK CONTROLLER] Bulk saving ${listings.length} drafts for user ${req.user.id}`);
    const results = await bulkSaveDrafts(req.user.id, listings, baseUrl);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error('[BULK CONTROLLER SAVE ERROR]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Bulk publish listings directly to eBay
// @route   POST /api/bulklistingebay/publish
// @access  Private
exports.publishListings = async (req, res) => {
  try {
    const { listings } = req.body;
    if (!listings || !Array.isArray(listings)) {
      return res.status(400).json({ success: false, message: 'Listings array is required.' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    console.log(`[BULK CONTROLLER] Bulk publishing ${listings.length} listings for user ${req.user.id}`);
    const results = await bulkPublishListings(req.user.id, listings, baseUrl);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error('[BULK CONTROLLER PUBLISH ERROR]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Analyze multiple images, group matching items, and generate eBay listings
// @route   POST /api/bulklistingebay/analyze
// @access  Private
exports.analyzeBulk = async (req, res) => {
  console.log(`\n--- [BULK AI] Grouping & Analysis Request Received ---`);
  try {
    const {
      images,
      title_sequence = DEFAULT_TITLE_SEQUENCE,
      description_prompt = '',
      description_template = '',
      condition_name = 'Pre-owned',
      condition_note = '',
      model = 'gpt-4o-mini',
      existing_skus = []
    } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'Images array is required.' });
    }

    // AI model client init
    let aiClient = openai;
    let finalModel = model || 'gpt-4o-mini';
    if (finalModel.startsWith('gemini-')) {
      aiClient = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
      });
    }

    // User subscription checks
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    
    const plan = user.subscription?.plan || 'free';
    const status = user.subscription?.status;
    if (plan !== 'free' && status !== 'active') {
      return res.status(403).json({ success: false, message: "Your subscription plan is inactive. Please activate your subscription." });
    }

    // Compress images
    console.log(`[BULK AI] Compressing ${images.length} images...`);
    const compressedImages = await Promise.all(images.map(img => compressImageIfBase64(img)));

    // --- STEP 1: GROUPING & CATEGORY IDENTIFICATION ---
    console.log(`[BULK AI] Step 1: Grouping images by product and identifying categories...`);
    
    const imageContent = [];
    compressedImages.forEach((url, idx) => {
      imageContent.push({
        type: "text",
        text: `Image Index ${idx}:`
      });
      imageContent.push({
        type: "image_url",
        image_url: { url: url, detail: "low" }
      });
    });

    const groupingPrompt = `You are a world-class eBay inventory and product grouping expert.
We have uploaded a list of product images. Some images represent different angles, details, views, or tags of the SAME product, while other images represent DIFFERENT products.

Your tasks:
1. Group the Image Indices that represent the same physical product together (e.g. if Image Index 0, 1, and 4 are front, back, and label views of the same t-shirt, group them as [0, 1, 4]).
2. For each unique product identified:
   - Provide a HIGHLY SPECIFIC eBay search query (3-6 words) that targets the leaf category on eBay.
   - CRITICAL: If the product is clothing, footwear/shoes, or a fashion accessory, you MUST explicitly identify the target department/gender (e.g., Men's, Women's, Unisex, Kids', Boys', Girls') from the tags, labels, or styling, and you MUST prefix or include this department/gender explicitly in your 'category_query' (e.g., 'Mens Casual Button-Down Shirts' or 'Womens Athletic Running Shoes' instead of a generic 'Casual Button-Down Shirts' or 'Athletic Running Shoes').

Response format: Return ONLY a JSON object matching this structure:
{
  "products": [
    {
      "image_indices": [0, 1, 4],
      "category_query": "Mens Casual Button-Down Shirts"
    }
  ]
}`;

    const groupingRes = await callOpenAiWithRetry(aiClient, {
      model: finalModel,
      temperature: 0,
      max_tokens: 1000,
      messages: [
        { role: "system", content: "You are a precise eBay grouping assistant. You return valid JSON." },
        { role: "user", content: [{ type: "text", text: groupingPrompt }, ...imageContent] }
      ],
      response_format: { type: "json_object" }
    });

    const groupResult = JSON.parse(groupingRes.choices[0].message.content);
    if (!groupResult || !groupResult.products || !Array.isArray(groupResult.products)) {
      throw new Error("AI failed to group images.");
    }

    console.log(`[BULK AI] Grouping completed. Found ${groupResult.products.length} unique products.`);

    const resolvedProducts = [];
    const appToken = await ebayService.getAppToken();
    const productCount = await Listing.countDocuments();

    // Map global condition name to conditionId
    const EBAY_CONDITIONS = [
      { id: "1000", label: "New" },
      { id: "3000", label: "Used" },
      { id: "1000_c", label: "Pre-owned - Excellent" },
      { id: "1000_g", label: "Pre-owned - Good" },
      { id: "1000_f", label: "Pre-owned - Fair" },
      { id: "1000_nwt", label: "New with tags" },
      { id: "1000_nwot", label: "New without tags" },
      { id: "1500", label: "New other (see details)" },
      { id: "2000", label: "Certified - Refurbished" }
    ];
    
    const matchedOption = EBAY_CONDITIONS.find(c => c.label.toLowerCase() === condition_name.toLowerCase()) || 
                          EBAY_CONDITIONS.find(c => c.label.toLowerCase().includes(condition_name.toLowerCase())) ||
                          EBAY_CONDITIONS[1];
    const resolvedConditionId = matchedOption ? matchedOption.id : '3000';

    // --- STEP 2: RESOLVE CATEGORY, FETCH ASPECTS & GENERATE DETAILED LISTING FOR EACH GROUP IN PARALLEL ---
    console.log(`[BULK AI] Starting parallel processing for ${groupResult.products.length} products...`);
    
    const analysisPromises = groupResult.products.map(async (group, i) => {
      const prodImages = (group.image_indices || []).map(idx => images[idx]).filter(Boolean);
      const prodCompressedImages = (group.image_indices || []).map(idx => compressedImages[idx]).filter(Boolean);

      if (prodImages.length === 0) return null;

      let categoryId = '';
      let categoryPath = group.category_query || 'General';

      // 2a. Resolve category suggestions tree
      try {
        const suggestions = await ebayService.getCategorySuggestions(appToken, group.category_query || 'General');
        if (suggestions && suggestions.length > 0) {
          const bestSuggest = suggestions[0];
          categoryId = bestSuggest.category.categoryId;
          let ancestors = bestSuggest.categoryTreeNodeAncestors || [];
          ancestors.sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
          categoryPath = ancestors.map(a => a.categoryName).concat(bestSuggest.category.categoryName).join(' > ');
        }
      } catch (catErr) {
        console.warn(`[BULK AI] Category suggestions failed for "${group.category_query}":`, catErr.message);
      }

      // 2b. Fetch official aspects
      let officialAspects = [];
      let aspectNamesList = [];
      if (categoryId) {
        try {
          const aspectsData = await ebayService.getItemAspectsForCategory(appToken, categoryId);
          if (aspectsData && aspectsData.aspects) {
            officialAspects = aspectsData.aspects.map(aspect => ({
              localizedAspectName: aspect.localizedAspectName,
              aspectConstraint: {
                aspectRequired: aspect.aspectConstraint?.aspectRequired || false,
                aspectUsage: aspect.aspectConstraint?.aspectUsage || 'OPTIONAL'
              },
              aspectValues: aspect.aspectValues ? aspect.aspectValues.map(v => ({ localizedValue: v.localizedValue })) : []
            }));
            officialAspects.sort((a, b) => {
              if (a.aspectConstraint.aspectRequired && !b.aspectConstraint.aspectRequired) return -1;
              if (!a.aspectConstraint.aspectRequired && b.aspectConstraint.aspectRequired) return 1;
              return 0;
            });
            aspectNamesList = officialAspects.map(a => a.localizedAspectName);
          }
        } catch (aspErr) {
          console.warn(`[BULK AI] Fetch aspects failed for category ${categoryId}:`, aspErr.message);
        }
      }

      if (aspectNamesList.length === 0) {
        aspectNamesList = ['Brand', 'Type', 'Size', 'Color', 'Material', 'Condition', 'Style', 'Department'];
      }

      // 2c. Detailed AI analysis
      console.log(`[BULK AI] Scanning Product ${i + 1}/${groupResult.products.length} with resolved aspects...`);

      const prodImageContent = prodCompressedImages.map(url => ({
        type: "image_url",
        image_url: { url: url }
      }));

      let descriptionInstruction = '';
      if (description_template && description_template.trim() !== '') {
        descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM HTML TEMPLATE:
   "${description_template.trim()}"
   
   - Fill in the HTML template by replacing any placeholders (like {hook}, {brandInfo}, {features}, {Brand}, {Size}, etc.) or descriptive placeholders inside curly braces/brackets with actual analysis from the product images.
   - Do NOT modify the HTML tags (like <b>, <br>, <li>, etc.) or the general structure of the template. Keep them exactly as they are.
   - Make sure all placeholders are replaced, and output the final populated HTML string.`;

        if (description_prompt && description_prompt.trim() !== '') {
          descriptionInstruction += `\n   - ADDITIONAL USER INSTRUCTION/TONE GUIDANCE: "${description_prompt.trim()}". Follow this guidance when generating the contents for the placeholders.`;
        }
      } else if (description_prompt && description_prompt.trim() !== '') {
        descriptionInstruction = `2. Description Construction - STRICTLY follow this custom template: "${description_prompt.trim()}". Replace placeholders with data from images.`;
      } else {
        descriptionInstruction = `2. Description Construction - HTML format with key features, brand heritage, utility report, and condition report. Use <b> for headings and <br><br> for spacing.`;
      }

      const promptDetails = `Analyze these product images to generate a professional eBay listing.
      
1. Title Construction:
   - Extract attributes for Title Sequence: [${title_sequence.join(', ')}]
   - Combine them to create a professional 70-80 character title.
   - Output attributes in 'title_parts'.

${descriptionInstruction}

3. Item Specifics - FILL EVERY FIELD: ${aspectNamesList.join(', ')}.

4. Pricing: Estimate a realistic 'selling_price' in USD.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "eBay Product Title...",
  "title_parts": { "Brand": "Company", ... },
  "description": "HTML description...",
  "item_specifics": { "FieldName": "Value", ... },
  "selling_price": 0.00
}`;

      const detailRes = await callOpenAiWithRetry(aiClient, {
        model: finalModel,
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: "system", content: "You are a precise eBay listing analyzer. You strictly output JSON." },
          { role: "user", content: [{ type: "text", text: promptDetails }, ...prodImageContent] }
        ],
        response_format: { type: "json_object" }
      });

      const prodData = JSON.parse(detailRes.choices[0].message.content);

      return {
        index: i,
        prodImages,
        prodData,
        categoryId,
        categoryPath,
        officialAspects
      };
    });

    const analysisResults = await Promise.all(analysisPromises);

    // --- STEP 3: POST-PROCESS RESULTS AND GENERATE SKUS SEQUENTIALLY ---
    for (let i = 0; i < analysisResults.length; i++) {
      const resData = analysisResults[i];
      if (!resData) continue;

      const { index, prodImages, prodData, categoryId, categoryPath, officialAspects } = resData;

      // Re-construct structured title
      let finalTitle = prodData.title || '';
      if (prodData.title_parts) {
        const parts = [];
        title_sequence.forEach(key => {
          const foundKey = Object.keys(prodData.title_parts).find(k => k.toLowerCase() === key.toLowerCase());
          if (foundKey && prodData.title_parts[foundKey]) {
            let val = String(prodData.title_parts[foundKey]).replace(/,/g, '');
            if (key.toLowerCase().includes('size') && !val.toLowerCase().startsWith('size')) {
              val = `Size ${val}`;
            }
            parts.push(val);
          }
        });
        if (parts.length > 0) {
          finalTitle = parts.join(' ').substring(0, 80).trim();
        }
      }

      const templatedDescription = wrapInTemplate(prodData.description, finalTitle);

      // Structuring itemSpecifics (selectedAspects) as Map of arrays of string values
      const initialAspects = {};
      if (prodData.item_specifics) {
        for (const [key, value] of Object.entries(prodData.item_specifics)) {
          if (value) {
            initialAspects[key] = Array.isArray(value) ? value : [String(value)];
          }
        }
      }

      if (officialAspects) {
        officialAspects.forEach(aspect => {
          const name = aspect.localizedAspectName;
          if (prodData.item_specifics && prodData.item_specifics[name]) {
            initialAspects[name] = Array.isArray(prodData.item_specifics[name])
              ? prodData.item_specifics[name]
              : [String(prodData.item_specifics[name])];
          } else if (prodData.title_parts && prodData.title_parts[name]) {
            initialAspects[name] = Array.isArray(prodData.title_parts[name])
              ? prodData.title_parts[name]
              : [String(prodData.title_parts[name])];
          }
        });
      }

      // Generate SKU code sequentially
      let skuCode = '';
      let isUnique = false;
      let currentNum = productCount + 1 + resolvedProducts.length;
      while (!isUnique) {
        skuCode = `KL${currentNum}A`;
        const existingListing = await Listing.findOne({ sku: skuCode });
        const isAssignedInMemory = resolvedProducts.some(p => p.sku === skuCode);
        const isAlreadyInTable = (existing_skus || []).includes(skuCode);
        if (!existingListing && !isAssignedInMemory && !isAlreadyInTable) {
          isUnique = true;
        } else {
          currentNum++;
        }
      }

      resolvedProducts.push({
        id: `item-${Date.now()}-${index}`,
        images: prodImages,
        brand: prodData.brand || '',
        title: finalTitle,
        price: prodData.selling_price || prodData.price || '',
        description: templatedDescription,
        category: categoryPath,
        categoryId: categoryId,
        category_name: categoryPath,
        sku: skuCode,
        selectedAspects: initialAspects,
        aspects: officialAspects,
        selectedCondition: condition_name,
        conditionId: resolvedConditionId,
        conditionNote: condition_note || '',
        status: 'analyzed'
      });
    }

    if (req.user) {
      await logActivity({
        action: 'ai_fetch',
        userId: req.user.id,
        status: 'success'
      });
    }

    res.status(200).json({
      success: true,
      data: resolvedProducts
    });

  } catch (error) {
    console.error('❌ Bulk AI Analysis Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
