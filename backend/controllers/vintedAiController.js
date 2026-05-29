const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { VINTED_TAXONOMY } = require('../constants/vintedTaxonomy');
const { wrapInTemplate } = require('../services/descriptionService');
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
        console.error('Vinted AI Image compression error:', error.message);
        return base64Str;
    }
}

function normalizeVintedCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    if (!cleanAi) return "Women > Clothes > Tops & T-shirts > Other";

    // Convert Unisex to Men or Women
    if (cleanAi.startsWith('unisex')) {
        if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male') {
            cleanAi = cleanAi.replace('unisex', 'men');
        } else {
            cleanAi = cleanAi.replace('unisex', 'women');
        }
    }

    // Direct match check
    let directMatch = VINTED_TAXONOMY.find(cat => cat.toLowerCase() === cleanAi);
    if (directMatch) return directMatch;

    // Token overlap check
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = "Women > Clothes > Tops & T-shirts > Other";
    let maxOverlap = 0;

    for (const cat of VINTED_TAXONOMY) {
        const catTokens = cat.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
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

    return bestMatch;
}

exports.vintedAnalyzeListing = async (req, res) => {
    console.log(`\n--- [Vinted AI] New Analysis Request Received ---`);
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

        console.log(`[Vinted AI] Analyzing product. description_prompt: "${description_prompt}", title_sequence: [${title_sequence.join(', ')}]`);

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        const appliedConditionNote = shouldApplyConditionNote(condition_name) ? condition_note : '';

        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided for analysis." });
        }

        console.log(`[Vinted AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );
        console.log(`[Vinted AI] Image compression complete.`);

        const imageContent = compressedImages.map(url => ({
            type: "image_url",
            image_url: { url: url }
        }));

        const descriptionInstruction = description_prompt && description_prompt.trim() !== ''
            ? `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - STRICT: Replace placeholders like {Brand}, {Size}, etc., with actual data.
   - If it is a short/general instruction, follow it exactly. Format with HTML tags like <b> and <br> for spacing.`
            : `2. Description Construction - HIGH-CONVERSION & PERSUASIVE:
   - Write a detailed and professional summary of the item shown.
   - Use HTML <b> for section headers and <br><br> for spacing.
   - Include these sections:
     - <b>The Ultimate Look / Perfect Upgrade:</b> {Engaging hook about the item}.<br><br>
     - <b>Key Features & Design:</b> {Detailed bullet points for material, durability, and standout design elements}.<br><br>
     - <b>Condition Report:</b> ${condition_name}. ${appliedConditionNote ? `Note: ${appliedConditionNote}` : ''}<br><br>`;

        const mainResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are a world-class Vinted listing expert. You strictly follow instructions.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze images for a professional Vinted listing.
                            
1. Visual Research & Title Construction:
   - Identify the exact retail name of the product.
   - Create a title following this structure sequence: [${effectiveStructure.join(', ')}]
   
   CRITICAL RULES:
   - GOAL: A professional title up to 80 characters.
   - Output as a JSON object inside 'title_parts'.

${descriptionInstruction}

3. Category Detection:
   - Determine the most accurate Vinted category path (Root > Subcategory > Type).
   - Root category MUST be one of: Women, Men, Kids, Home, Entertainment.
   - Never use "Unisex". Choose Men or Women.
   - Select the most precise subcategory path.

4. Pricing: Estimate a realistic 'selling_price' in USD and estimate 'original_price' in USD.
5. Attribute Extraction:
   - Identify primary 'color'.
   - Identify 'size'.

Context: Gender: ${gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A descriptive title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "HTML content",
  "category": "Vinted category path (e.g. Women > Clothes > Tops & T-shirts > T-shirts)",
  "selling_price": 0.00,
  "original_price": 0.00,
  "color": "Color",
  "size": "Size"
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
            skuCode = `KL${currentNum}V`;
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

        const finalTitle = titleString || finalData.title || 'New Vinted Listing';
        const templatedDescription = wrapInTemplate(finalData.description, finalTitle);

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        const normalizedCategory = normalizeVintedCategory(finalData.category, gender);

        return res.json({
            success: true,
            data: {
                brand: finalData.brand,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: normalizedCategory,
                category_name: normalizedCategory,
                price: finalData.selling_price || finalData.price,
                originalPrice: finalData.original_price || '',
                color: finalData.color || '',
                size: finalData.size || '',
                sku: finalData.sku
            }
        });

    } catch (error) {
        console.error('❌ Final Vinted AI Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchVintedCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const lowerQuery = String(query).toLowerCase().trim();
        const matches = VINTED_TAXONOMY.filter(cat => cat.toLowerCase().includes(lowerQuery));

        const formatted = matches.slice(0, 20).map(cat => {
            const parts = cat.split(' > ');
            const name = parts[parts.length - 1];
            const path = parts.slice(0, -1).join(' > ');
            return {
                id: cat,
                name: name,
                path: path,
                fullName: cat
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('❌ Vinted Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
