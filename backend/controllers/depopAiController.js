const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { DEPOP_TAXONOMY } = require('../constants/depopTaxonomy');
const { BANNED_HASHTAGS } = require('../constants/bannedWords');
const { wrapInTemplate } = require('../services/descriptionService');
const { logActivity } = require('../utils/activityUtils');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sanitizeTitle(titleStr) {
    if (!titleStr || typeof titleStr !== 'string') return '';
    let sanitized = titleStr;
    BANNED_HASHTAGS.forEach(word => {
        const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        sanitized = sanitized.replace(wordRegex, '');
    });
    return sanitized.replace(/\s+/g, ' ').trim();
}

function sanitizeDescription(descStr) {
    if (!descStr || typeof descStr !== 'string') return '';
    let sanitized = descStr;
    BANNED_HASHTAGS.forEach(word => {
        const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match hashtag #vape
        const hashtagRegex = new RegExp(`#${escapedWord}\\b`, 'gi');
        sanitized = sanitized.replace(hashtagRegex, '');
        // Match standalone word vape
        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        sanitized = sanitized.replace(wordRegex, '');
    });
    return sanitized.replace(/[ \t]+/g, ' ').trim();
}

function sanitizeStyleTags(styleTagsStr) {
    if (!styleTagsStr || typeof styleTagsStr !== 'string') return '';
    return styleTagsStr
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => {
            const cleanTag = tag.toLowerCase().replace(/^#/, '');
            return !BANNED_HASHTAGS.some(banned => banned.toLowerCase() === cleanTag);
        })
        .join(', ');
}

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

async function compressImageIfBase64(base64Str) {
    if (!base64Str || !base64Str.startsWith('data:')) {
        return base64Str;
    }

    try {
        const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return base64Str;
        }

        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const compressedBuffer = await sharp(buffer)
            .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Depop AI Image compression error:', error.message);
        return base64Str;
    }
}

function normalizeDepopCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    const defaultMatch = DEPOP_TAXONOMY.find(cat => cat.path === "Women > Tops > T-shirts") || DEPOP_TAXONOMY[0];
    if (!cleanAi) return defaultMatch;

    // Convert Unisex/Women/Men based on itemGender
    const isMenswear = ['men', 'male', 'menswear'].includes(itemGender.toLowerCase());
    const isWomenswear = ['women', 'female', 'womenswear'].includes(itemGender.toLowerCase());

    if (cleanAi.startsWith('unisex') || cleanAi.startsWith('women') || cleanAi.startsWith('men') || cleanAi.startsWith('womenswear') || cleanAi.startsWith('menswear')) {
        if (isMenswear) {
            cleanAi = cleanAi.replace('unisex', 'men').replace('womenswear', 'men').replace('women', 'men').replace('menswear', 'men');
        } else if (isWomenswear) {
            cleanAi = cleanAi.replace('unisex', 'women').replace('menswear', 'women').replace('men', 'women').replace('womenswear', 'women');
        } else {
            // If gender is Unisex or unspecified, preserve AI's detected category and only map 'unisex' to 'women'
            if (cleanAi.startsWith('unisex')) {
                cleanAi = cleanAi.replace('unisex', 'women');
            }
        }
    }

    // Direct match check
    let directMatch = DEPOP_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch;

    // Token overlap check
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = defaultMatch;
    let maxOverlap = 0;

    for (const cat of DEPOP_TAXONOMY) {
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

exports.depopAnalyzeListing = async (req, res) => {
    console.log(`\n--- [Depop AI] New Analysis Request Received ---`);
    try {
        const {
            images,
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            condition_name = 'Pre-owned',
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

        console.log(`[Depop AI] Analyzing product. description_prompt: "${description_prompt}", title_sequence: [${title_sequence.join(', ')}]`);

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        const appliedConditionNote = shouldApplyConditionNote(condition_name) ? condition_note : '';

        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided for analysis." });
        }

        // Check for duplicate listing by first image
        const { findDuplicateListing } = require('../utils/duplicateChecker');
        const duplicate = await findDuplicateListing(req.user.id, 'depop', images[0]);
        if (duplicate) {
            console.log(`[Depop AI] Duplicate listing found. ID: ${duplicate._id}, Title: "${duplicate.title}"`);
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                message: "This product has already been imported for Depop.",
                listingId: duplicate._id,
                title: duplicate.title
            });
        }

        console.log(`[Depop AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );
        console.log(`[Depop AI] Image compression complete.`);

        const imageContent = compressedImages.map(url => ({
            type: "image_url",
            image_url: { 
                url: url,
                detail: "auto"
            }
        }));

        const descriptionInstruction = description_prompt && description_prompt.trim() !== ''
            ? `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - STRICT: Replace placeholders like {Brand}, {Size}, etc.
   - Format with plain text newlines (Strictly NO HTML tags).`
            : `2. Description Construction - TRENDY & DESCRIPTIVE (Tailored for Depop):
   - Write a modern summary. Keep it clean and highly engaging.
   - Plain text ONLY (Strictly NO HTML tags like <b>, <br>, etc.). Use standard double newlines for spacing.
   - Include:
     - Aesthetic & Styling: {Aesthetic style keyword hook - e.g., retro, indie, street, Y2K}
     - Item Details: {Bullet points describing material, quality, fit}
     - Condition: ${condition_name}. ${appliedConditionNote ? `Note: ${appliedConditionNote}` : ''}`;

        const mainResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are a world-class Depop listing expert. You strictly follow instructions.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze images for a professional Depop listing.
                            
1. Visual Research & Title Construction:
   - Identify the exact retail name of the product.
   - Create a title following this structure sequence: [${effectiveStructure.join(', ')}]
   
   CRITICAL RULES:
   - GOAL: A descriptive title up to 80 characters.
   - Output as a JSON object inside 'title_parts'.

${descriptionInstruction}

3. Category Detection:
   - Determine the most accurate Depop category path (Department > Category > Subcategory).
   - Department (Root) MUST be Men, Women, or Kids for clothing, footwear/shoes, or fashion accessories. Use 'Everything else' ONLY for non-clothing/non-fashion items (like books, beauty, home, tech, toys, etc.).
   - Choose Men or Women based on the item design and styling.
   - Select the most precise subcategory path.

4. Pricing: Estimate a realistic 'selling_price' in USD and estimate 'original_price' in USD.
5. Attribute Extraction:
    - Identify 'color'.
    - Identify 'size'. STRICT RULES: Output standard abbreviations for clothing (e.g., XS, S, M, L, XL, XXL). For shoes/footwear, output numbers (e.g., 8, 9, 10, 42) or standard shoe sizes. NEVER output full words like 'Large', 'Medium', or 'Small'.
    - Extract up to 3 style tags or keywords as comma-separated values (e.g., 'vintage, retro, streetwear') in 'style_tag'.
    - Identify 'age' (e.g. 'Modern', '00s', '90s', '80s', '70s', '60s', '50s', 'Antique').
    - Identify 'source' (e.g. 'Vintage', 'Preloved', 'Reworked / Upcycled', 'Custom', 'Handmade', 'Deadstock', 'Designer', 'Repaired').
    - Identify 'material' (e.g. 'Cotton', 'Polyester', 'Denim', 'Wool', 'Silk', 'Leather', 'Nylon', 'Linen', 'Acrylic', 'Canvas', 'Cashmere', 'Corduroy', 'Fleece', 'Satin', 'Suede', 'Velvet', 'Viscose').
    - Identify 'body_fit' (e.g. 'Slim', 'Regular', 'Relaxed', 'Oversized', 'Loose', 'Fitted', 'Skinny', 'Straight', 'Cropped', 'Tight', 'Wide leg').
    - Identify 'occasion' (e.g. 'Casual', 'Party', 'Formal', 'Sports', 'Business', 'Wedding', 'Festival', 'Vacation').
    - Identify 'depop_type' (for footwear, bottoms, and beauty categories. E.g. 'Trainers', 'Boots', 'Sandals', 'Slides', 'Heels' for footwear; 'Jeans', 'Trousers', 'Joggers', 'Shorts', 'Leggings', 'Skirts' for bottoms; 'Cleanser', 'Moisturizer', 'Serum', 'Face mask' for skincare/beauty. Else empty string).
    - Identify 'fastening' (for footwear categories. E.g. 'Lace up', 'Slip on', 'Zip', 'Buckle', 'Hook and loop', 'Button', 'Strap', 'Pull on'. Else empty string).
    - Identify 'fit' (for bottoms/jeans categories. E.g. 'Straight leg', 'Slim', 'Skinny', 'Wide leg', 'Bootcut', 'Boyfriend', 'Flare', 'Loose', 'Relaxed', 'Tapered', 'Mom jeans', 'Cargo'. Else empty string).

Context: Gender: ${gender === 'Unisex' ? 'Unisex (Identify the correct Men/Women/Kids category root based on the item design/styling)' : gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A descriptive title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "Plain text description (NO HTML tags)",
  "category": "Depop category path (e.g. Women > Footwear > Trainers)",
  "selling_price": 0.00,
  "original_price": 0.00,
  "color": "Color",
  "style_tag": "style tags (comma-separated)",
  "size": "Size",
  "age": "Age",
  "source": "Source",
  "material": "Material",
  "body_fit": "Body Fit",
  "occasion": "Occasion",
  "depop_type": "Type",
  "fastening": "Fastening",
  "fit": "Fit"
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

        // DYNAMIC SKU GENERATION
        let skuCode = '';
        let isUnique = false;
        const productCount = await Listing.countDocuments();
        let currentNum = productCount + 1;
        while (!isUnique) {
            skuCode = `KL${currentNum}D`;
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

        const rawTitle = titleString || finalData.title || 'New Depop Listing';
        const finalTitle = sanitizeTitle(rawTitle);
        const rawDescription = finalData.description || '';
        const templatedDescription = sanitizeDescription(rawDescription);
        const cleanStyleTag = sanitizeStyleTags(finalData.style_tag || '');

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        const matchedCategory = normalizeDepopCategory(finalData.category, gender);

        return res.json({
            success: true,
            data: {
                brand: finalData.brand,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: matchedCategory.path,
                category_name: matchedCategory.path,
                categoryId: matchedCategory.id,
                attribute_ids: matchedCategory.attribute_ids || [],
                price: finalData.selling_price || finalData.price,
                originalPrice: finalData.original_price || '',
                color: finalData.color || '',
                styleTag: finalData.style_tag || '',
                size: finalData.size || '',
                age: finalData.age || '',
                source: finalData.source || '',
                material: finalData.material || '',
                bodyFit: finalData.body_fit || '',
                occasion: finalData.occasion || '',
                depopType: finalData.depop_type || '',
                fastening: finalData.fastening || '',
                fit: finalData.fit || '',
                sku: finalData.sku
            }
        });

    } catch (error) {
        console.error('❌ Final Depop AI Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchDepopCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const lowerQuery = String(query).toLowerCase().trim();
        const matches = DEPOP_TAXONOMY.filter(cat => cat.path.toLowerCase().includes(lowerQuery));

        const formatted = matches.slice(0, 20).map(cat => {
            const parts = cat.path.split(' > ');
            const name = parts[parts.length - 1];
            const path = parts.slice(0, -1).join(' > ');
            return {
                id: cat.id,
                name: name,
                path: path,
                fullName: cat.path,
                attribute_ids: cat.attribute_ids || []
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('❌ Depop Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getDepopCategoryDetails = async (req, res) => {
    try {
        const { path, id } = req.query;
        let match;
        if (id) {
            match = DEPOP_TAXONOMY.find(cat => cat.id === String(id));
        } else if (path) {
            match = DEPOP_TAXONOMY.find(cat => cat.path.toLowerCase() === String(path).toLowerCase().trim());
        }
        if (!match) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        return res.json({ success: true, data: match });
    } catch (error) {
        console.error('❌ Depop Category Details Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
