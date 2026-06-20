const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { POSHMARK_TAXONOMY } = require('../constants/poshmarkTaxonomy');
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
        const commaIdx = base64Str.indexOf(',');
        if (commaIdx === -1) return base64Str;
        
        const prefix = base64Str.substring(0, commaIdx);
        if (!prefix.includes(';base64')) {
            return base64Str;
        }

        const base64Data = base64Str.substring(commaIdx + 1);
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
        console.error('Poshmark AI Image compression error:', error.message);
        return base64Str;
    }
}

function normalizePoshmarkCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    if (!cleanAi) return "Women > Tops > Other";

    // 1. Convert Unisex to Men or Women
    if (cleanAi.startsWith('unisex')) {
        if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male') {
            cleanAi = cleanAi.replace('unisex', 'men');
        } else {
            cleanAi = cleanAi.replace('unisex', 'women');
        }
    }

    // 2. Direct exact match check
    let directMatch = POSHMARK_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch.path;

    // 3. Token overlap check to find the closest official taxonomy path
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = "Women > Tops > Other";
    let maxOverlap = 0;

    for (const cat of POSHMARK_TAXONOMY) {
        const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
                // High weight for matching root category to ensure correct department
                if (catTokens[0] === token) {
                    overlap += 10;
                } else {
                    overlap += 1;
                }
            }
        }

        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = cat.path;
        }
    }

    return bestMatch;
}

exports.poshmarkAnalyzeListing = async (req, res) => {
    console.log(`\n--- [Poshmark AI] New Analysis Request Received ---`);
    try {
        const {
            images,
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            description_template = '',
            condition_name = 'Pre-owned',
            gender = 'Unisex',
            condition_note = '',
            model = 'gpt-4o-mini'
        } = req.body;

        // Instantiate the appropriate AI client based on model
        let aiClient = openai;
        let finalModel = model || 'gpt-4o-mini';

        if (finalModel.startsWith('gemini-')) {
            aiClient = new OpenAI({
                apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
                baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
            });
        }

        console.log(`[Poshmark AI] Analyzing product. description_prompt: "${description_prompt}", title_sequence: [${title_sequence.join(', ')}]`);

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
        const duplicate = await findDuplicateListing(req.user.id, 'poshmark', images[0]);
        if (duplicate) {
            console.log(`[Poshmark AI] Duplicate listing found. ID: ${duplicate._id}, Title: "${duplicate.title}"`);
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                message: "This product has already been imported for Poshmark.",
                listingId: duplicate._id,
                title: duplicate.title
            });
        }

        console.log(`[Poshmark AI] Resizing and compressing ${images.length} images...`);
        const compressedImages = await Promise.all(
            images.map(img => compressImageIfBase64(img))
        );
        console.log(`[Poshmark AI] Image compression complete.`);

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
   
   - Fill in the HTML template by replacing any placeholders (like {hook}, {brandInfo}, {features}, {Brand}, {Size}, etc.) or descriptive placeholders inside curly braces/brackets with actual analysis from the product images.
   - Output the filled template as HTML (do NOT strip tags now; we will strip them in post-processing).`;

            if (description_prompt && description_prompt.trim() !== '') {
                descriptionInstruction += `\n   - ADDITIONAL USER INSTRUCTION/TONE GUIDANCE: "${description_prompt.trim()}". Follow this guidance when generating the contents for the placeholders.`;
            }
        } else if (description_prompt && description_prompt.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - STRICT: If the instruction contains placeholders like {Brand}, {Size}, {Material}, {Type}, etc., replace them with data from the images. 
   - SMART ADAPTATION: If the user provides a fixed template but the image clearly shows something else, adapt the template intelligently to match the physical product while maintaining the user's requested tone and structure. 
   - If it is a general prompt like "Summarize in 2 sentences" or "only two line", follow it EXACTLY. 
   - Do NOT use HTML tags (like <b>, <br>). Format the output as clean, beautifully structured plain text using newlines for paragraph spacing.`;
        } else {
            descriptionInstruction = `2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Detailed & Lengthy, Plain Text Only):
   - Analyze the item to write a professional, engaging summary.
   - Do NOT use HTML tags (like <b>, <br>).
   - Format with bold headers by using UPPERCASE words, and separate sections with double newlines (\\n\\n) for clear, readable spacing.
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

        const mainResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are a world-class Poshmark listing expert. You strictly follow instructions.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze images for a professional Poshmark listing.
                            
1. Visual Research & Title Construction:
   - Identify the EXACT retail name of this product.
   - Extract these precise attributes for the Title Sequence: [${effectiveStructure.join(', ')}]
   
   CRITICAL RULES:
   - GOAL: A professional, keyword-rich title between 70-80 characters.
   - NO BLANKS: Fill every requested attribute.
   - Output as a JSON object inside 'title_parts'.
 
${descriptionInstruction}
 
# Optimized Poshmark Category Prompt (Production Ready)
 
3. Category Detection
 
Determine the MOST accurate Poshmark category for the item shown in the images.
 
Rules:
 
* Output category format exactly as:
  Root > Subcategory > Type
 
* Root category MUST be one of:
  Women
  Men
  Kids
  Home
  Pets
  Electronics
  Beauty
 
* Never use:
  Unisex
 
* Choose Men or Women based on the item's visual design and styling.
 
* Focus on the ACTUAL product type visible in the images:
 
  * T-Shirts
  * Polo Shirts
  * Button Down Shirts
  * Hoodies
  * Jackets
  * Dresses
  * Jeans
  * Sneakers
  * Handbags
  * Makeup
  * Electronics
    etc.
 
IMPORTANT MEN'S SHIRT RULES:
 
* Never output:
  Men > Tops
  Men > Shirts > T-Shirts
 
* Men's regular t-shirts MUST map to:
  Men > Shirts > Tees - Short Sleeve
  or
  Men > Shirts > Tees - Long Sleeve
 
* Polo shirts MUST map to:
  Men > Shirts > Polos
 
* Hoodies and sweatshirts MUST map to:
  Men > Shirts > Sweatshirts & Hoodies
 
* Tank tops MUST map to:
  Men > Shirts > Tank Tops
 
* Jerseys MUST map to:
  Men > Shirts > Jerseys
 
* Button-down shirts MUST map to:
  Men > Shirts > Casual Button Down Shirts
  or
  Men > Shirts > Dress Shirts
 
Examples:
 
* Women > Tops > Blouses
* Women > Shoes > Sneakers
* Men > Shirts > Tees - Short Sleeve
* Men > Shirts > Polos
* Men > Jackets & Coats > Bomber Jackets
* Beauty > Makeup > Lips
* Home > Kitchen > Cookware
 
4. Pricing: Estimate a realistic 'selling_price' in USD and estimate the 'original_price' (MSRP / original retail price when brand new) in USD.
5. Attribute Extraction:
   - Identify the primary 'color'(s) of the item. Use ONLY colors from this allowed Poshmark color list: Red, Pink, Orange, Yellow, Green, Blue, Purple, Gold, Silver, Black, Gray, White, Cream, Brown, Tan. You can select at most 2 colors. Return them as a comma-separated string (e.g., 'Red, Pink').
   - Extract up to 3 style tags or keywords as comma-separated values. You MUST choose ONLY from this allowed Poshmark style tags list: 70s, 80s, 90s, Activewear, Animal Print, Athleisure, Avant Garde, Baggy, Balletcore, Beach, Beaded, Bikercore, Blokecore, Bodycon, Bohemian, Bow, Bridal, Bridesmaid, Business Casual, Cable Knit, Cashmere, Casual, Chunky, Collegiate, Colorblock, Colorful, Contemporary, Coord Sets, Coquette Girl, Corduroy, Cottagecore, Cozy, Crochet, Cropped, Cruelty-Free, Cut Out, Denim, Distressed, DIY, Drop Waist, Eclectic Grandpa, Embroidered, Fall, Faux Fur, Feminine, Festival, Festive, Flannel, Flare, Floral, Formal, Fringe, Gingham, Girlhoodcore, Gorpcore, Goth, Grunge, Hand Knit, Handmade, Herringbone, Houndstooth, Indie Sleeze, Knit, Lace, Leather, Leopard Print, Lightweight, Linen, Luxury, Maximalism, Mesh, Metallic, Minimalist, Monochrome, Monogram, Moto, Neon, Neutral, Nylon, Office, Oversized, Paisley, Party, Pastel, Patchwork, Peplum, Plaid, Platform, Pleated, Polka Dot, Preppy, Punk, Quiet Luxury, Quilted, Relaxed Fit, Resortwear, Retro, Rosette, Ruffle, Satin, Sequins, Sheer, Sherpa, Silk, Sporty, Strapless, Streetwear, Stripes, Suede, Tailored, Tennis Prep, Travel, Tropical, Tweed, Two-Tone, Unisex, Upcycled, Utility, Vacation, Vegan, Velour, Vintage, Waterproof, Wedding, Western, Whimsigoth, Winter, Wool, Woven, Y2K. Return them as a comma-separated string (e.g. 'Vintage, Streetwear, Y2K') in 'style_tag'.
   - Identify the 'size' of the item if visible in the images or estimate it if not.
 
Context: Gender: ${gender === 'Unisex' ? 'Unisex (Identify the correct Men/Women/Kids category root based on the item design/styling)' : gender}.
 
Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A long, descriptive, 80-character marketplace title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "Clean formatted plain text description (NO HTML tags)",
  "category": "Poshmark category path (e.g. Women > Shoes > Heels)",
  "selling_price": 0.00,
  "original_price": 0.00,
  "color": "Primary color(s) (comma-separated, max 2 from allowed list)",
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
        
        let templatedDescription = finalData.description || '';
        // In case the AI still generated HTML tags, clean them up for Poshmark
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

        const normalizedCategory = normalizePoshmarkCategory(finalData.category, gender);
        const matchedTaxonomy = POSHMARK_TAXONOMY.find(c => c.path.toLowerCase() === normalizedCategory.toLowerCase()) || {};

        return res.json({
            success: true,
            data: {
                brand: finalData.brand,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: normalizedCategory,
                category_name: normalizedCategory,
                categoryId: matchedTaxonomy.categoryId || '',
                departmentId: matchedTaxonomy.departmentId || '',
                subcategoryIds: matchedTaxonomy.id && matchedTaxonomy.id !== matchedTaxonomy.categoryId ? [matchedTaxonomy.id] : [],
                price: finalData.selling_price || finalData.price,
                originalPrice: finalData.original_price || '',
                color: (() => {
                    const allowedColors = ['Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold', 'Silver', 'Black', 'Gray', 'White', 'Cream', 'Brown', 'Tan'];
                    const matchedColors = [];
                    if (finalData.color) {
                        const rawColors = String(finalData.color).split(/[\s,]+/);
                        for (const rc of rawColors) {
                            const clean = rc.trim().toLowerCase();
                            const matched = allowedColors.find(ac => ac.toLowerCase() === clean);
                            if (matched && !matchedColors.includes(matched)) {
                                matchedColors.push(matched);
                            }
                        }
                    }
                    return matchedColors.slice(0, 2).join(', ');
                })(),
                styleTag: (() => {
                    const allowedTags = [
                        "70s", "80s", "90s", "Activewear", "Animal Print", "Athleisure", "Avant Garde", "Baggy", 
                        "Balletcore", "Beach", "Beaded", "Bikercore", "Blokecore", "Bodycon", "Bohemian", "Bow", 
                        "Bridal", "Bridesmaid", "Business Casual", "Cable Knit", "Cashmere", "Casual", "Chunky", 
                        "Collegiate", "Colorblock", "Colorful", "Contemporary", "Coord Sets", "Coquette Girl", 
                        "Corduroy", "Cottagecore", "Cozy", "Crochet", "Cropped", "Cruelty-Free", "Cut Out", 
                        "Denim", "Distressed", "DIY", "Drop Waist", "Eclectic Grandpa", "Embroidered", "Fall", 
                        "Faux Fur", "Feminine", "Festival", "Festive", "Flannel", "Flare", "Floral", "Formal", 
                        "Fringe", "Gingham", "Girlhoodcore", "Gorpcore", "Goth", "Grunge", "Hand Knit", 
                        "Handmade", "Herringbone", "Houndstooth", "Indie Sleeze", "Knit", "Lace", "Leather", 
                        "Leopard Print", "Lightweight", "Linen", "Luxury", "Maximalism", "Mesh", "Metallic", 
                        "Minimalist", "Monochrome", "Monogram", "Moto", "Neon", "Neutral", "Nylon", "Office", 
                        "Oversized", "Paisley", "Party", "Pastel", "Patchwork", "Peplum", "Plaid", "Platform", 
                        "Pleated", "Polka Dot", "Preppy", "Punk", "Quiet Luxury", "Quilted", "Relaxed Fit", 
                        "Resortwear", "Retro", "Rosette", "Ruffle", "Satin", "Sequins", "Sheer", "Sherpa", 
                        "Silk", "Sporty", "Strapless", "Streetwear", "Stripes", "Suede", "Tailored", 
                        "Tennis Prep", "Travel", "Tropical", "Tweed", "Two-Tone", "Unisex", "Upcycled", 
                        "Utility", "Vacation", "Vegan", "Velour", "Vintage", "Waterproof", "Wedding", 
                        "Western", "Whimsigoth", "Winter", "Wool", "Woven", "Y2K"
                    ];
                    const matchedTags = [];
                    if (finalData.style_tag) {
                        const rawTags = String(finalData.style_tag).split(/[\s,]+/);
                        for (const rt of rawTags) {
                            const clean = rt.trim().toLowerCase();
                            const matched = allowedTags.find(at => at.toLowerCase() === clean);
                            if (matched && !matchedTags.includes(matched)) {
                                matchedTags.push(matched);
                            }
                        }
                    }
                    return matchedTags.slice(0, 3).join(', ');
                })(),
                size: finalData.size || '',
                sku: finalData.sku
            }
        });

    } catch (error) {
        console.error('❌ Final Poshmark AI Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchPoshmarkCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        const lowerQuery = String(query).toLowerCase().trim();
        const matches = POSHMARK_TAXONOMY.filter(cat => cat.path.toLowerCase().includes(lowerQuery));

        const formatted = matches.slice(0, 20).map(cat => {
            const parts = cat.path.split(' > ');
            const name = parts[parts.length - 1];
            const path = parts.slice(0, -1).join(' > ');
            return {
                id: cat.id,
                name: name,
                path: path,
                fullName: cat.path,
                categoryId: cat.categoryId,
                departmentId: cat.departmentId,
                subcategoryIds: cat.id !== cat.categoryId ? [cat.id] : []
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('❌ Poshmark Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
