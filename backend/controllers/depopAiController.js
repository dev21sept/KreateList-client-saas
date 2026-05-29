const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { DEPOP_TAXONOMY } = require('../constants/depopTaxonomy');
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
        console.error('Depop AI Image compression error:', error.message);
        return base64Str;
    }
}

function normalizeDepopCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    if (!cleanAi) return "Womenswear > Tops > T-shirts";

    // Convert Unisex to Menswear or Womenswear
    if (cleanAi.startsWith('unisex') || cleanAi.startsWith('women')) {
        if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male' || itemGender.toLowerCase() === 'menswear') {
            cleanAi = cleanAi.replace('unisex', 'menswear').replace('women', 'menswear');
        } else {
            cleanAi = cleanAi.replace('unisex', 'womenswear').replace('women', 'womenswear');
        }
    }

    // Direct match check
    let directMatch = DEPOP_TAXONOMY.find(cat => cat.toLowerCase() === cleanAi);
    if (directMatch) return directMatch;

    // Token overlap check
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = "Womenswear > Tops > T-shirts";
    let maxOverlap = 0;

    for (const cat of DEPOP_TAXONOMY) {
        const catTokens = cat.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
                if (catTokens[0] === token) {
                    overlap += 10; // Root match weight (e.g. Womenswear vs Menswear)
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

        console.log(`[Depop AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );
        console.log(`[Depop AI] Image compression complete.`);

        const imageContent = compressedImages.map(url => ({
            type: "image_url",
            image_url: { url: url }
        }));

        const descriptionInstruction = description_prompt && description_prompt.trim() !== ''
            ? `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - STRICT: Replace placeholders like {Brand}, {Size}, etc.
   - Format with HTML tags like <b> and <br> for spacing.`
            : `2. Description Construction - TRENDY & DESCRIPTIVE (Tailored for Depop):
   - Write a modern summary. Keep it clean and highly engaging.
   - Use HTML <b> for section headers and <br><br> for spacing.
   - Include:
     - <b>Aesthetic & Styling:</b> {Aesthetic style keyword hook - e.g., retro, indie, street, Y2K}.<br><br>
     - <b>Item Details:</b> {Bullet points describing material, quality, fit}.<br><br>
     - <b>Condition:</b> ${condition_name}. ${appliedConditionNote ? `Note: ${appliedConditionNote}` : ''}<br><br>`;

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
   - Department (Root) MUST be one of: Womenswear, Menswear, Kidswear.
   - Choose Menswear or Womenswear based on the item design.
   - Select the most precise subcategory path.

4. Pricing: Estimate a realistic 'selling_price' in USD and estimate 'original_price' in USD.
5. Attribute Extraction:
   - Identify primary 'color'.
   - Identify 'size'.
   - Extract up to 3 style tags or keywords as comma-separated values (e.g., 'vintage, retro, streetwear') in 'style_tag'.

Context: Gender: ${gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A descriptive title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "HTML content",
  "category": "Depop category path (e.g. Womenswear > Shoes > Sneakers)",
  "selling_price": 0.00,
  "original_price": 0.00,
  "color": "Color",
  "style_tag": "style tags (comma-separated)",
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

        const finalTitle = titleString || finalData.title || 'New Depop Listing';
        const templatedDescription = wrapInTemplate(finalData.description, finalTitle);

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        const normalizedCategory = normalizeDepopCategory(finalData.category, gender);

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
                styleTag: finalData.style_tag || '',
                size: finalData.size || '',
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
        const matches = DEPOP_TAXONOMY.filter(cat => cat.toLowerCase().includes(lowerQuery));

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
        console.error('❌ Depop Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
