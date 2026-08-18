const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { logActivity } = require('../utils/activityUtils');
const { MERCARI_FLAT_CATEGORIES: MERCARI_TAXONOMY } = require('../constants/mercariCategoryTaxonomy.json');
const mercariBrands = require('../constants/mercariBrands.json');
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

async function compressImageIfBase64(imageInput) {
    if (!imageInput) return imageInput;
    
    const fs = require('fs');
    const path = require('path');
    let buffer = null;
    
    if (imageInput.startsWith('data:')) {
        const commaIdx = imageInput.indexOf(',');
        if (commaIdx !== -1) {
            const base64Data = imageInput.substring(commaIdx + 1);
            buffer = Buffer.from(base64Data, 'base64');
        }
    } else if (imageInput.includes('/uploads/')) {
        try {
            const filename = imageInput.split('/uploads/').pop();
            const filepath = path.join(__dirname, '..', 'uploads', filename);
            if (fs.existsSync(filepath)) {
                buffer = fs.readFileSync(filepath);
            }
        } catch (err) {
            console.error(`[Mercari AI] Error reading local file:`, err.message);
        }
    }
    
    if (!buffer) {
        if (imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
            try {
                const axios = require('axios');
                const response = await axios.get(imageInput, { responseType: 'arraybuffer' });
                buffer = Buffer.from(response.data, 'binary');
            } catch (err) {
                console.error(`[Mercari AI] Failed to fetch localhost image via HTTP:`, err.message);
            }
        }
    }
    
    if (buffer) {
        try {
            const compressedBuffer = await sharp(buffer)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toBuffer();

            return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
        } catch (error) {
            console.error('Mercari AI Image compression error:', error.message);
            if (imageInput.startsWith('data:')) {
                return imageInput;
            }
            return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
    }
    
    return imageInput;
}

function normalizeMercariCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    const defaultMatch = MERCARI_TAXONOMY.find(cat => cat.path === "Women > Tops & blouses > Blouse") || MERCARI_TAXONOMY[0];
    if (!cleanAi) return defaultMatch;

    // Convert Unisex/Women/Men based on itemGender
    const isMenswear = ['men', 'male', 'menswear'].includes(itemGender.toLowerCase());
    const isWomenswear = ['women', 'female', 'womenswear'].includes(itemGender.toLowerCase());

    if (cleanAi.startsWith('unisex') || cleanAi.startsWith('women') || cleanAi.startsWith('men') || cleanAi.startsWith('womenswear') || cleanAi.startsWith('menswear')) {
        if (isMenswear) {
            cleanAi = cleanAi.replace('unisex', 'men').replace('womenswear', 'men').replace('women', 'men').replace('menswear', 'men');
        } else if (isWomenswear) {
            cleanAi = cleanAi.replace('unisex', 'women').replace('menswear', 'women').replace('men', 'women').replace('womenswear', 'women');
        }
    }

    // Direct match check
    let directMatch = MERCARI_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi || cat.name.toLowerCase() === cleanAi);
    if (directMatch) return directMatch;

    // Token overlap check
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = defaultMatch;
    let maxOverlap = 0;

    for (const cat of MERCARI_TAXONOMY) {
        const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
                if (catTokens[0] === token) {
                    overlap += 10; // Root match weight (e.g. Women vs Men)
                } else {
                    overlap += 1;
                }
            }
        }
        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = cat;
        }
    }
    return bestMatch;
}


function normalizeLevel1Category(rawCategory = '') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    
    // Find direct match in level 1 categories
    let directMatch = MERCARI_TAXONOMY.find(cat => cat.level === 1 && cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch.path;

    // Token overlap check among level 1 paths
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = MERCARI_TAXONOMY.find(cat => cat.level === 1 && cat.path.startsWith("Women > Tops")) || MERCARI_TAXONOMY.find(cat => cat.level === 1);
    let maxOverlap = 0;

    const level1Cats = MERCARI_TAXONOMY.filter(cat => cat.level === 1);
    for (const cat of level1Cats) {
        const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
                if (catTokens[0] === token) {
                    overlap += 10; // Root match weight
                } else {
                    overlap += 1;
                }
            }
        }
        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = cat;
        }
    }
    return bestMatch.path;
}

function getLevel2Categories(level1Path) {
    if (!level1Path) return [];
    const prefix = level1Path.toLowerCase().trim() + ' > ';
    return MERCARI_TAXONOMY
        .filter(cat => cat.level === 2 && cat.path.toLowerCase().startsWith(prefix))
        .map(cat => cat.path);
}



// Helper to retrieve official size labels for a given category path
function getSizeOptionsForCategory(categoryPath) {
    const cat = MERCARI_TAXONOMY.find(x => x.path === categoryPath);
    if (!cat || !cat.itemSizeGroupId || cat.itemSizeGroupId === 0) return [];
    try {
        const sizesMap = require('../constants/mercariSizes.json');
        return sizesMap[cat.itemSizeGroupId] || [];
    } catch (err) {
        console.error("Error loading sizes for category:", err);
        return [];
    }
}

exports.mercariAnalyzeListing = async (req, res) => {
    console.log(`\n--- [Mercari AI] New Analysis Request Received ---`);
    try {
        const {
            images,
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            description_template = '',
            condition_name = 'Good',
            gender = 'Unisex',
            condition_note = '',
            model = 'gpt-4o-mini'
        } = req.body;

        let aiClient = openai;
        let finalModel = model || 'gpt-4o-mini';

        if (finalModel.startsWith('gemini-')) {
            aiClient = new OpenAI({
                apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
                baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
            });
        }

        console.log(`[Mercari AI] Analyzing product. description_prompt: "${description_prompt}", title_sequence: [${title_sequence.join(', ')}]`);

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        const appliedConditionNote = shouldApplyConditionNote(condition_name) ? condition_note : '';

        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided for analysis." });
        }

        // Check duplicate by first image
        const { findDuplicateListing } = require('../utils/duplicateChecker');
        const duplicate = await findDuplicateListing(req.user.id, 'mercari', images[0]);
        if (duplicate) {
            console.log(`[Mercari AI] Duplicate listing found. ID: ${duplicate._id}, Title: "${duplicate.title}"`);
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                message: "This product has already been imported for Mercari.",
                listingId: duplicate._id,
                title: duplicate.title
            });
        }

        console.log(`[Mercari AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );

        const imageContent = compressedImages.map(url => ({
            type: "image_url",
            image_url: { 
                url: url,
                detail: "auto"
            }
        }));

        let descriptionInstruction = '';
        if (description_template && description_template.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM HTML TEMPLATE:
    "${description_template.trim()}"
    
    - You MUST fill in the placeholders (words inside curly braces like {Title}, {hook}, {brandInfo}, {features}, {stylingTips}, {conditionReport}, {Brand}, {Size}, etc.) by replacing them with the following actual analysis:
      * {Title}: The keyword-rich title of the product.
      * {hook}: An engaging summary and visual appeal hook of the item.
      * {brandInfo}: History, heritage, or quality details of the brand.
      * {features}: A bulleted list of key design details, visual accents, and specifications.
      * {stylingTips}: Styling tips, outfit matching suggestions, or use cases.
      * {conditionReport}: The product condition "${condition_name}" and details.
      * {Brand}: The brand name.
      * {Size}: The size of the item.
      * {Condition}: The condition level ("${condition_name}").
    - Make sure you fill in every placeholder present in the template. Do not output the literal placeholder names.
    - Keep all the surrounding HTML tags exactly as they are in the template.`;
        } else if (description_prompt && description_prompt.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
    "${description_prompt.trim()}"
    
    - Replace placeholders like {Brand}, {Size}, etc. with data from the images.
    - Do NOT use HTML tags. Format as clean plain text.`;
        } else {
            descriptionInstruction = `2. Description Construction:
    - Analyze the item to write a professional, engaging summary.
    - Format with bold headers by using UPPERCASE words, and separate sections with double newlines (\n\n).
    - Use bullet points (• or -) for key features and design details.
    - Include these sections:
      THE ULTIMATE LOOK / PERFECT UPGRADE: {Engaging hook about the item}
      
      ABOUT THE BRAND: {Quality/Heritage info about the brand}
      
      KEY FEATURES & DESIGN:
      - {Key feature 1}
      - {Key feature 2}
      - {Key feature 3}
      
      VERSATILITY / USAGE: {Styling tips or functional use cases}
      
      CONDITION REPORT: ${condition_name}. ${appliedConditionNote ? `Note: ${appliedConditionNote}` : ''}`;
        }

        // Get list of Level 1 category paths
        const officialPrefixes = MERCARI_TAXONOMY
            .filter(cat => cat.level === 1)
            .map(cat => cat.path);
        const prefixesText = officialPrefixes.join('\n');

        console.log(`[Mercari AI] Running Step 1: Vision Analysis...`);
        const visionResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are a visual analysis expert. Analyze the product images to extract listing details."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze the product images and output the following details as JSON:
                            
 1. Visual Research & Attribute Extraction:
    - Identify the 'brand'. Look closely at the product tag, label, or logo. If a brand name is clearly visible (e.g. Rockmount, Nike, Adidas, Carhartt), output that brand name. If the product is completely unbranded, handmade, or lacks any label/logo, return 'Other'.
    - Identify 'color'(s) (e.g. 'Green', 'White').
    - Identify 'size'. STRICT RULES: Output standard abbreviations for clothing (e.g., XS, S, M, L, XL, XXL). For shoes/footwear, output numbers (e.g., 8, 9, 10). NEVER output full words like 'Large', 'Medium', or 'Small'.
    - Suggest up to 3 style tags / keywords as comma-separated values in 'style_tag'.
    
 2. Level 1 Category Prefix:
    - Choose the single most relevant Category Prefix from this list:

${prefixesText}
    
 3. Pricing: Estimate a realistic 'selling_price' in USD and estimate the 'original_price' in USD.
 4. Visual features: 
    - Describe the item's key design, style, cuts, sleeve style/length, button front, neck/collar style, zippers, pockets, patterns, and any distinguishing characteristics in 'visual_description'.
 5. Title Attributes:
    - Extract these precise attributes for the Title Sequence: [${effectiveStructure.join(', ')}]
    - Output these as a key-value dictionary in 'title_parts'.

Response ONLY as JSON:
{
  "brand": "Brand Name",
  "color": "Color(s)",
  "size": "Size",
  "style_tag": "style tags",
  "level1_category": "Selected Category Prefix",
  "selling_price": 0.00,
  "original_price": 0.00,
  "visual_description": "Detailed visual description including sleeves, buttons, zippers, collar, pattern, etc.",
  "title_parts": { "AttributeName": "Value", ... }
}`
                        },
                        ...imageContent
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const visionData = JSON.parse(visionResponse.choices[0].message.content);
        console.log(`[Mercari AI] Step 1 complete. Predicted Level 1 category: "${visionData.level1_category}"`);
        console.log(`[Mercari AI] Visual Description: "${visionData.visual_description}"`);

        // Normalize L1 category path and retrieve Level 2 subcategories
        const normalizedL1 = normalizeLevel1Category(visionData.level1_category);
        const level2Options = getLevel2Categories(normalizedL1);
        const finalCategoryOptions = level2Options.length > 0 ? level2Options : [normalizedL1];

        console.log(`[Mercari AI] Running Step 2: Text Optimization & Template Filling with ${finalCategoryOptions.length} category options...`);
        
        // Build size options map for each allowed category
        const sizeOptionsStrings = [];
        finalCategoryOptions.forEach(optPath => {
            const sizes = getSizeOptionsForCategory(optPath);
            if (sizes.length > 0) {
                sizeOptionsStrings.push(`- Category "${optPath}": [${sizes.map(s => `"${s}"`).join(', ')}]`);
            } else {
                sizeOptionsStrings.push(`- Category "${optPath}": No size required (must output "" empty string)`);
            }
        });

        const textPrompt = `You are a world-class Mercari listing expert.

Given the following product details analyzed from images:
- Brand: ${visionData.brand}
- Color: ${visionData.color}
- Size (from tag/image): ${visionData.size}
- Visual Details/Features: substituteFeatures
- Title attributes extracted: substituteTitleParts

Perform the following tasks:

1. Category Classification:
   - You MUST select the single most relevant category path for this item from this list:
${finalCategoryOptions.join('\n')}
   - Output your selection in the "category" field.

2. Size Mapping:
   - Depending on the category you select, map the tag size ("${visionData.size}") to the closest official size label allowed for that category.
   - Here are the allowed sizes for each category option:
${sizeOptionsStrings.join('\n')}
   - Select the exact matching string option from the brackets. If the category does not require sizes, you MUST return an empty string "".
   - Output your selection in the "size" field.

${descriptionInstruction}

Response ONLY as JSON:
{
  "category": "Selected category path from the list",
  "size": "Selected official size label, or empty string",
  "description": "Clean formatted plain text description (NO HTML tags)"
}`;

        const completeTextPrompt = textPrompt
            .replace('\substituteFeatures', visionData.visual_description)
            .replace('\substituteTitleParts', JSON.stringify(visionData.title_parts));

        const textResponse = await aiClient.chat.completions.create({
            model: finalModel.startsWith('gemini') ? finalModel : 'gpt-4o-mini',
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are a professional listing optimizer who strictly follows formatting templates and category lists."
                },
                {
                    role: "user",
                    content: completeTextPrompt
                }
            ],
            response_format: { type: "json_object" }
        });

        const textData = JSON.parse(textResponse.choices[0].message.content);
        console.log(`[Mercari AI] Step 2 complete. Selected final category: "${textData.category}"`);

        const finalData = {
            brand: visionData.brand,
            title_parts: visionData.title_parts,
            selling_price: visionData.selling_price,
            original_price: visionData.original_price,
            color: visionData.color,
            style_tag: visionData.style_tag,
            size: textData.size || visionData.size || '',
            category: textData.category || normalizedL1,
            description: textData.description
        };

        // DYNAMIC SKU GENERATION
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
        
        let templatedDescription = finalData.description || '';
        templatedDescription = templatedDescription
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '');

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        const matchedCategory = normalizeMercariCategory(finalData.category, gender);

        // Resolve official Mercari Brand ID from offline brands lookup dictionary
        const predictedBrand = finalData.brand || 'Other';
        let resolvedBrandId = '';
        const normBrand = predictedBrand.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normBrand && mercariBrands[normBrand]) {
            resolvedBrandId = String(mercariBrands[normBrand].id);
        }

        return res.json({
            success: true,
            data: {
                brand: predictedBrand,
                brandId: resolvedBrandId,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: matchedCategory.name,
                category_id: matchedCategory.id,
                category_name: matchedCategory.path,
                price: finalData.selling_price || finalData.price,
                originalPrice: finalData.original_price || '',
                color: finalData.color || '',
                styleTag: finalData.style_tag || '',
                size: finalData.size || '',
                sku: finalData.sku
            }
        });

    } catch (error) {
        console.error('❌ Final Mercari AI Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchMercariCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const lowerQuery = String(query).toLowerCase().trim();
        const matches = MERCARI_TAXONOMY.filter(cat => cat.path.toLowerCase().includes(lowerQuery));

        const formatted = matches.slice(0, 20).map(cat => {
            const parts = cat.path.split(' > ');
            const name = parts[parts.length - 1];
            const path = parts.slice(0, -1).join(' > ');
            return {
                id: cat.id,
                name: name,
                path: path,
                fullName: cat.path,
                categoryId: cat.id,
                departmentId: cat.parentId
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('❌ Mercari Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
