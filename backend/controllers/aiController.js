const OpenAI = require('openai');
const sharp = require('sharp');
const ebayService = require('../services/ebayService');
const Listing = require('../models/Listing');
const { wrapInTemplate } = require('../services/descriptionService');
const { normalizeProductImages } = require('../utils/imageProcessor');
const { logActivity } = require('../utils/activityUtils');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_TITLE_SEQUENCE = ['Brand', 'Product Type', 'Model / Series', 'Material', 'Key Features', 'Size'];

const normalizeStringList = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const dedupeOrdered = (items) => [...new Set(items)];

const shouldApplyConditionNote = (conditionName = '') => {
    const normalized = String(conditionName || '').trim().toLowerCase();
    if (!normalized) return true;
    return !normalized.includes('new');
};

// Helper to compress and resize base64 images to improve network latency and prevent 413 errors
async function compressImageIfBase64(base64Str) {
    if (!base64Str || !base64Str.startsWith('data:')) {
        return base64Str; // Keep URLs as they are
    }

    try {
        const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return base64Str;
        }

        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Resize to maximum 800px on the longest side and compress to JPEG (quality 80)
        const compressedBuffer = await sharp(buffer)
            .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Image compression error:', error.message);
        return base64Str; // Fallback to original image if compression fails
    }
}

exports.analyzeListing = async (req, res) => {
    console.log(`\n--- [AI] New Analysis Request Received ---`);
    try {
        const {
            images,
            platform = 'ebay',
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            condition_name = 'Pre-owned',
            gender = 'Unisex',
            condition_note = ''
        } = req.body;

        console.log(`[AI] Analyzing product. description_prompt: "${description_prompt}", title_sequence: [${title_sequence.join(', ')}]`);

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        const appliedConditionNote = shouldApplyConditionNote(condition_name) ? condition_note : '';

        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided for analysis." });
        }

        // Compress and resize base64 images before sending to OpenAI
        console.log(`[AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );
        console.log(`[AI] Image compression complete.`);

        const imageContent = compressedImages.map(url => ({
            type: "image_url",
            image_url: { url: url }
        }));

        // --- PHASE 1: CATEGORY IDENTIFICATION ---
        console.log(`--- Phase 1: Identifying ${platform} Category ---`);
        const categoryResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are an expert in marketplace categorization for ${platform}. Your goal is to identify the deepest, most accurate leaf-category for ANY type of product.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `1. Analyze ALL provided images thoroughly.
2. Carefully read ALL visible tags, brand logos, model numbers, and text on the product/box.
3. Use this deep visual and textual evidence to determine the exact product identity.
4. Provide a HIGHLY SPECIFIC search query (3-6 words) that targets the ABSOLUTE LEAF CATEGORY (the deepest possible level). (e.g., instead of 'Clothing', use 'Mens Graphic T-Shirts' or 'NFL Fan Apparel T-Shirts').
5. Return your response ONLY as a JSON object with 'category_query'. You MUST be as detailed as possible to avoid broad parent categories like 'Clothing' (ID 206).`
                        },
                        ...imageContent
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const categoryResult = JSON.parse(categoryResponse.choices[0].message.content);

        let categoryId = '';
        let categoryPath = 'General';

        if (platform === 'ebay') {
            const query = categoryResult?.category_query || 'General';
            try {
                const appToken = await ebayService.getAppToken();
                const suggestions = await ebayService.getCategorySuggestions(appToken, query);
                if (suggestions && suggestions.length > 0) {
                    const bestSuggest = suggestions[0];
                    categoryId = bestSuggest.category.categoryId;

                    let ancestors = bestSuggest.categoryTreeNodeAncestors || [];
                    ancestors.sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
                    categoryPath = ancestors.map(a => a.categoryName).concat(bestSuggest.category.categoryName).join(' > ');
                    
                    console.log(`[AI] Suggestion: ${categoryPath} (Leaf ID: ${categoryId})`);
                } else {
                    categoryPath = query;
                }
            } catch (err) {
                console.error("Failed to fetch official category suggestions:", err.message);
                categoryPath = query;
            }
        }

        console.log(`✅ Phase 1: ${categoryPath} (ID: ${categoryId})`);

        // --- PHASE 2: FETCH OFFICIAL ASPECTS (EBAY ONLY) ---
        let officialAspects = [];
        let aspectNamesList = [];
        if (platform === 'ebay' && categoryId) {
            try {
                console.log(`--- Fetching official eBay aspects for Category: ${categoryId} ---`);
                const appToken = await ebayService.getAppToken();
                const aspectsData = await ebayService.getItemAspectsForCategory(appToken, categoryId);

                if (aspectsData && aspectsData.aspects) {
                    officialAspects = aspectsData.aspects.map(aspect => ({
                        localizedAspectName: aspect.localizedAspectName,
                        required: aspect.aspectConstraint?.aspectRequired || false,
                        usage: aspect.aspectConstraint?.aspectUsage || 'OPTIONAL',
                        values: aspect.aspectValues ? aspect.aspectValues.map(v => v.localizedValue) : []
                    }));

                    officialAspects.sort((a, b) => {
                        if (a.required && !b.required) return -1;
                        if (!a.required && b.required) return 1;
                        if (a.usage === 'RECOMMENDED' && b.usage !== 'RECOMMENDED') return -1;
                        if (a.usage !== 'RECOMMENDED' && b.usage === 'RECOMMENDED') return 1;
                        return 0;
                    });

                    aspectNamesList = officialAspects.map(a => a.localizedAspectName);
                    console.log(`✅ Phase 2: Successfully fetched ${officialAspects.length} official eBay aspects.`);
                } else {
                    console.log(`⚠️ Phase 2: No aspects returned in response for Category ${categoryId}.`);
                }
            } catch (e) {
                console.error('⚠️ eBay API Error in Phase 2:', e.message);
            }
        }

        if (aspectNamesList.length === 0) {
            console.log(`ℹ️ Phase 2: Using fallback default aspects list (length: 8).`);
            aspectNamesList = ['Brand', 'Type', 'Size', 'Color', 'Material', 'Condition', 'Style', 'Department'];
        }

        // --- PHASE 3: FULL ANALYSIS & DATA FILLING ---
        console.log(`--- Phase 3: Detailed AI Analysis ---`);

        const descriptionInstruction = description_prompt && description_prompt.trim() !== ''
            ? `2. Description Construction (STRICTLY follow this custom instruction):
   - You MUST construct the description strictly according to this custom instruction: "${description_prompt.trim()}"
   - Do not include the default sections (The Ultimate Look, About the Brand, Key Features, Versatility, Condition Report) unless they match the user's custom instruction.
   - Use HTML formatting (such as <b> and <br>) where appropriate.`
            : `2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Detailed & Lengthy):
   - Analyze the item to write a professional summary.
   - Use HTML <b> for section headers and <br><br> for spacing.
   - Include these sections:
     - <b>The Ultimate Look / Perfect Upgrade:</b> {Engaging hook about the item}.<br><br>
     - <b>About the Brand:</b> {Quality/Heritage info about the brand}.<br><br>
     - <b>Key Features & Design:</b> {Detailed bullet points for material, durability, and standout design elements}.<br><br>
     - <b>Versatility / Usage:</b> {Styling tips or functional use cases}.<br><br>
     - <b>Condition Report:</b> ${condition_name}. ${appliedConditionNote ? `Note: ${appliedConditionNote}` : ''}<br><br>`;

        const mainResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are a world-class ${platform} listing expert. You strictly follow instructions.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze images for a professional ${platform} listing.
                            
1. Visual Research & Title Construction:
   - Identify the EXACT retail name of this product.
   - Look for keywords like "Vintage", "Rare", "Authentic".
   - Extract these precise attributes for the Title Sequence: [${effectiveStructure.join(', ')}]
   
   CRITICAL RULES:
   - GOAL: A professional, keyword-rich title between 70-80 characters.
   - NO BLANKS: Fill every requested attribute.
   - Output as a JSON object inside 'title_parts'.
   
${descriptionInstruction}
   
3. Item Specifics - FILL EVERY FIELD: ${aspectNamesList.join(', ')}.
    
4. Pricing: Estimate a realistic 'selling_price' in USD.

Context: Gender: ${gender}, Category: ${categoryPath}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A long, descriptive, 80-character marketplace title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "HTML content",
  "item_specifics": { "FieldName": "Value", ... },
  "selling_price": 0.00
}`
                        },
                        ...imageContent
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const finalData = JSON.parse(mainResponse.choices[0].message.content);

        if (!finalData) {
            throw new Error("OpenAI returned an empty or invalid JSON response.");
        }

        // --- DYNAMIC SKU GENERATION ---
        let skuCode = '';
        let isUnique = false;
        const productCount = await Listing.countDocuments();
        let currentNum = productCount + 1;
        while (!isUnique) {
            skuCode = `KL${currentNum}A`;
            const existingListing = await Listing.findOne({ sku: skuCode });
            if (!existingListing) {
                isUnique = true;
            } else {
                currentNum++;
            }
        }
        finalData.sku = skuCode;

        const aiResponseParts = finalData.title_parts || {};
        const standardizedParts = {};

        effectiveStructure.forEach(key => {
            const foundKey = Object.keys(aiResponseParts).find(k => k.toLowerCase() === key.toLowerCase());
            standardizedParts[key] = foundKey ? aiResponseParts[foundKey] : '';
        });

        const titleString = effectiveStructure
            .map(key => {
                let val = standardizedParts[key] || '';
                val = String(val).replace(/,/g, '');
                if (key.toLowerCase().includes('size') && val && !val.toLowerCase().startsWith('size')) {
                    return `Size ${val}`;
                }
                return val;
            })
            .filter(val => val && val.toString().trim() !== '')
            .join(' ')
            .substring(0, 80)
            .trim();

        const finalTitle = titleString || finalData.title || 'New Listing';
        const templatedDescription = (description_prompt && description_prompt.trim() !== '')
            ? finalData.description
            : wrapInTemplate(finalData.description, finalTitle);

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        return res.json({
            success: true,
            data: {
                ...finalData,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: categoryPath.split(' > ').pop(),
                category_id: categoryId,
                category_name: categoryPath,
                aspects: officialAspects,
                price: finalData.selling_price || finalData.price
            }
        });

    } catch (error) {
        console.error('❌ Final Analysis Error:', error);
        try {
            const fs = require('fs');
            fs.writeFileSync('error_log.txt', `${new Date().toISOString()}\nError Message: ${error.message}\nStack Trace:\n${error.stack}\n\n`, { flag: 'a' });
        } catch (fsErr) {
            console.error('Failed to write error to error_log.txt:', fsErr.message);
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveAiListing = async (req, res) => {
    try {
        const data = req.body;
        const normalizedImages = await normalizeProductImages(data.images || []);

        if (normalizedImages.length > 0) {
            const existingListing = await Listing.findOne({
                images: { $in: normalizedImages }
            });

            if (existingListing) {
                return res.status(400).json({ success: false, message: 'DUPLICATE: A listing with these images already exists.' });
            }
        }

        const newListing = new Listing({
            ...data,
            user: req.user.id,
            images: normalizedImages
        });

        await newListing.save();
        res.json({ success: true, listingId: newListing._id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const appToken = await ebayService.getAppToken();
        const suggestions = await ebayService.getCategorySuggestions(appToken, query);

        const formatted = suggestions.map(s => {
            let ancestors = s.categoryTreeNodeAncestors || [];
            ancestors.sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
            const path = ancestors.map(a => a.categoryName).join(' > ');
            const name = s.category.categoryName;
            return {
                id: s.category.categoryId,
                name: name,
                path: path,
                fullName: path ? `${path} > ${name}` : name
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};