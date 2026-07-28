const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { scrapeEtsyListing } = require('../services/etsyScraperService');
const { wrapInTemplate } = require('../services/descriptionService');
const { logActivity } = require('../utils/activityUtils');
const { POSHMARK_TAXONOMY } = require('../constants/poshmarkTaxonomy');
const { DEPOP_TAXONOMY } = require('../constants/depopTaxonomy');
const {
  DEPOP_KIDS_APPAREL_SIZES,
  DEPOP_KIDS_SHOE_SIZES,
  DEPOP_WOMENS_TOPS_SIZES,
  DEPOP_WOMENS_DRESSES_SIZES,
  DEPOP_WOMENS_BOTTOMS_SIZES,
  DEPOP_WOMENS_OUTERWEAR_SIZES,
  DEPOP_WOMENS_SHOE_SIZES,
  DEPOP_MENS_TOPS_SIZES,
  DEPOP_MENS_BOTTOMS_SIZES,
  DEPOP_MENS_OUTERWEAR_SIZES,
  DEPOP_MENS_SHOE_SIZES
} = require('../constants/depopSizes');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_TITLE_SEQUENCE = ['Brand', 'Product Type', 'Model / Series', 'Material', 'Key Features', 'Size'];

const normalizeStringList = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const dedupeOrdered = (items) => [...new Set(items)];

function isAspectValueInvalid(val) {
    if (typeof val !== 'string') return true;
    const clean = val.trim().toLowerCase();
    if (!clean || clean === '' || clean === '-' || clean === 'none' || clean === 'n/a' || clean === 'not applicable') {
        return true;
    }
    return false;
}

// Poshmark category normalization helper
function normalizePoshmarkCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    if (!cleanAi) return "Women > Tops > Other";

    if (cleanAi.startsWith('unisex')) {
        if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male') {
            cleanAi = cleanAi.replace('unisex', 'men');
        } else {
            cleanAi = cleanAi.replace('unisex', 'women');
        }
    }

    let directMatch = POSHMARK_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch.path;

    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = "Women > Tops > Other";
    let maxOverlap = 0;

    for (const cat of POSHMARK_TAXONOMY) {
        const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
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

// Depop category normalization helper
function normalizeDepopCategory(rawCategory = '', itemGender = 'Unisex') {
    let cleanAi = String(rawCategory).toLowerCase().trim();
    const defaultMatch = DEPOP_TAXONOMY.find(cat => cat.path === "Women > Tops > T-shirts") || DEPOP_TAXONOMY[0];
    if (!cleanAi) return defaultMatch;

    const isMenswear = ['men', 'male', 'menswear'].includes(itemGender.toLowerCase());
    const isWomenswear = ['women', 'female', 'womenswear'].includes(itemGender.toLowerCase());

    if (cleanAi.startsWith('unisex') || cleanAi.startsWith('women') || cleanAi.startsWith('men') || cleanAi.startsWith('womenswear') || cleanAi.startsWith('menswear')) {
        if (isMenswear) {
            cleanAi = cleanAi.replace('unisex', 'men').replace('womenswear', 'men').replace('women', 'men').replace('menswear', 'men');
        } else if (isWomenswear) {
            cleanAi = cleanAi.replace('unisex', 'women').replace('menswear', 'women').replace('men', 'women').replace('womenswear', 'women');
        } else {
            if (cleanAi.startsWith('unisex')) {
                cleanAi = cleanAi.replace('unisex', 'women');
            }
        }
    }

    let directMatch = DEPOP_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch;

    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let bestMatch = defaultMatch;
    let maxOverlap = 0;

    for (const cat of DEPOP_TAXONOMY) {
        const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let overlap = 0;
        
        for (const token of aiTokens) {
            if (catTokens.includes(token)) {
                if (catTokens[0] === token) {
                    overlap += 10;
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

// Depop composite size resolver helper
function resolveCompositeSize(categoryPath, sizeName) {
    if (!categoryPath || !sizeName) return sizeName || '';
    
    const cat = String(categoryPath).toLowerCase();
    const size = String(sizeName).trim().toUpperCase();
    
    let dataset = null;
    if (cat.startsWith('kids >')) {
        const isShoe = cat.includes('footwear');
        dataset = isShoe ? DEPOP_KIDS_SHOE_SIZES : DEPOP_KIDS_APPAREL_SIZES;
    } else if (cat.startsWith('women >')) {
        const isShoe = cat.includes('footwear');
        if (isShoe) {
            dataset = DEPOP_WOMENS_SHOE_SIZES;
        } else {
            const isBottom = cat.includes('bottoms') || cat.includes('jeans') || cat.includes('skirts');
            if (isBottom) {
                dataset = DEPOP_WOMENS_BOTTOMS_SIZES;
            } else {
                const isOuterwear = cat.includes('outerwear') || cat.includes('coats') || cat.includes('jackets');
                if (isOuterwear) {
                    dataset = DEPOP_WOMENS_OUTERWEAR_SIZES;
                } else {
                    const isDress = cat.includes('dresses');
                    dataset = isDress ? DEPOP_WOMENS_DRESSES_SIZES : DEPOP_WOMENS_TOPS_SIZES;
                }
            }
        }
    } else if (cat.startsWith('men >')) {
        const isShoe = cat.includes('footwear');
        if (isShoe) {
            dataset = DEPOP_MENS_SHOE_SIZES;
        } else {
            const isBottom = cat.includes('bottoms') || cat.includes('jeans') || cat.includes('trousers') || cat.includes('shorts');
            if (isBottom) {
                dataset = DEPOP_MENS_BOTTOMS_SIZES;
            } else {
                const isOuterwear = cat.includes('outerwear') || cat.includes('coats') || cat.includes('jackets');
                dataset = isOuterwear ? DEPOP_MENS_OUTERWEAR_SIZES : DEPOP_MENS_TOPS_SIZES;
            }
        }
    }
    
    if (dataset) {
        const scales = ['US', 'UK', 'EUR', 'AU'];
        for (const scale of scales) {
            const list = dataset[scale] || [];
            let found = list.find(s => s.name.toUpperCase() === size);
            if (!found) {
                const cleanSize = size.replace(/[^0-9.]/g, '');
                if (cleanSize) {
                    found = list.find(s => s.name.replace(/[^0-9.]/g, '') === cleanSize);
                }
            }
            if (found) {
                return found.composite_id;
            }
        }
    }
    
    return sizeName;
}

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
            console.error(`[Etsy AI] Error reading local file:`, err.message);
        }
    }
    
    if (!buffer) {
        if (imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
            try {
                const axios = require('axios');
                const response = await axios.get(imageInput, { responseType: 'arraybuffer' });
                buffer = Buffer.from(response.data, 'binary');
            } catch (err) {
                console.error(`[Etsy AI] Failed to fetch localhost image via HTTP:`, err.message);
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
            console.error('Etsy AI Image compression error:', error.message);
            if (imageInput.startsWith('data:')) {
                return imageInput;
            }
            return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
    }

    return imageInput;
}

exports.etsyFetchListing = async (req, res) => {
    console.log(`\n--- [Etsy AI Fetch] New Fetch Request Received ---`);
    try {
        const {
            url,
            platform = 'ebay', // ebay, poshmark, depop, etsy
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            description_template = '',
            condition_name = 'Pre-owned',
            gender = 'Unisex',
            model = 'gpt-4o-mini'
        } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'Etsy URL is required.' });
        }

        // Validate subscription usage limit
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        const plan = user.subscription?.plan || 'free';
        const status = user.subscription?.status;

        if (plan !== 'free' && status !== 'active') {
            return res.status(403).json({ error: "Your subscription plan is inactive. Please activate your subscription." });
        }

        const limits = {
            free: 10,
            basic: 50,
            pro: 500,
            enterprise: 99999
        };
        const limit = limits[plan] || 10;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const currentUsage = await Listing.countDocuments({
            user: req.user.id,
            createdAt: { $gte: startOfMonth }
        });

        if (currentUsage >= limit) {
            return res.status(403).json({ 
                error: `Usage limit exceeded. You have used all ${limit} listings available in your ${plan.toUpperCase()} plan. Please upgrade to continue.`
            });
        }

        // Scrape Etsy listing URL
        console.log(`[Etsy AI Fetch] Scraping Etsy listing URL: ${url}`);
        const scrapedDetails = await scrapeEtsyListing(url);

        if (!scrapedDetails || !scrapedDetails.text) {
            return res.status(400).json({ success: false, error: 'Failed to scrape listing details text from Etsy. Check that URL is correct and active.' });
        }

        // Setup AI Client
        let aiClient = openai;
        let finalModel = model || 'gpt-4o-mini';

        if (finalModel.startsWith('gemini-')) {
            aiClient = new OpenAI({
                apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
                baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
            });
        }

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        // Limit vision analysis to top 3 images to save tokens and speed up API response
        const topImages = (scrapedDetails.images || []).slice(0, 3);
        const imageContent = topImages.map(imgUrl => ({
            type: "image_url",
            image_url: { 
                url: imgUrl,
                detail: "auto"
            }
        }));

        let descriptionInstruction = '';
        if (description_template && description_template.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM HTML TEMPLATE:
   "${description_template.trim()}"
   
   - Fill in the HTML template by replacing placeholders (like {hook}, {brandInfo}, {features}, {Brand}, {Size}, etc.) or descriptive placeholders inside curly braces/brackets with actual analysis from the product details and images.
   - For eBay: keep the HTML tags exactly as they are.
   - For Etsy/Poshmark/Depop: output the final populated description as plain text (STRICTLY NO HTML TAGS).`;

            if (description_prompt && description_prompt.trim() !== '') {
                descriptionInstruction += `\n   - ADDITIONAL USER INSTRUCTION/TONE GUIDANCE: "${description_prompt.trim()}". Follow this guidance when generating the contents for the placeholders.`;
            }
        } else if (description_prompt && description_prompt.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - Replace any placeholders like {Brand}, {Size}, {Material}, {Type}, etc. with data from the product details.
   - For eBay: format with HTML tags like <b> and <br> for spacing.
   - For Etsy/Poshmark/Depop: format as clean plain text (STRICTLY NO HTML tags).`;
        } else {
            if (platform === 'poshmark' || platform === 'depop' || platform === 'etsy') {
                descriptionInstruction = `2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Plain Text Only):
   - Do NOT use HTML tags (like <b>, <br>).
   - Format with uppercase headers and standard newlines.
   - Include these sections:
     THE ULTIMATE LOOK: {Engaging hook about the item}
     
     ABOUT THE BRAND: {Brand heritage info}
     
     KEY FEATURES:
     - {Material, durability and design details}
     
     CONDITION: ${condition_name}.`;
            } else {
                descriptionInstruction = `2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Detailed & Lengthy):
   - Use HTML <b> for section headers and <br><br> for spacing.
   - Include these sections:
     - <b>The Ultimate Look / Perfect Upgrade:</b> {Engaging hook about the item}.<br><br>
     - <b>About the Brand:</b> {Quality/Heritage info about the brand}.<br><br>
     - <b>Key Features & Design:</b> {Detailed bullet points for material, durability, and standout design elements}.<br><br>
     - <b>Versatility / Usage:</b> {Styling tips or functional use cases}.<br><br>
     - <b>Condition Report:</b> ${condition_name}.<br><br>`;
            }
        }

        // Tailor constraints based on target platform
        let platformSpecificRules = '';
        if (platform === 'poshmark') {
            platformSpecificRules = `
COLOR CONSTRAINT: Select at most 2 colors. Use ONLY from this allowed Poshmark color list: Red, Pink, Orange, Yellow, Green, Blue, Purple, Gold, Silver, Black, Gray, White, Cream, Brown, Tan. Return them as a comma-separated string.
STYLE TAGS CONSTRAINT: Select up to 3 style tags/keywords. Use ONLY from this allowed Poshmark style tags list: 70s, 80s, 90s, Activewear, Animal Print, Athleisure, Avant Garde, Baggy, Balletcore, Beach, Beaded, Bikercore, Blokecore, Bodycon, Bohemian, Bow, Bridal, Bridesmaid, Business Casual, Cable Knit, Cashmere, Casual, Chunky, Collegiate, Colorblock, Colorful, Contemporary, Coord Sets, Coquette Girl, Corduroy, Cottagecore, Cozy, Crochet, Cropped, Cruelty-Free, Cut Out, Denim, Distressed, DIY, Drop Waist, Eclectic Grandpa, Embroidered, Fall, Faux Fur, Feminine, Festival, Festive, Flannel, Flare, Floral, Formal, Fringe, Gingham, Girlhoodcore, Gorpcore, Goth, Grunge, Hand Knit, Handmade, Herringbone, Houndstooth, Indie Sleeze, Knit, Lace, Leather, Leopard Print, Lightweight, Linen, Luxury, Maximalism, Mesh, Metallic, Minimalist, Monochrome, Monogram, Moto, Neon, Neutral, Nylon, Office, Oversized, Paisley, Party, Pastel, Patchwork, Peplum, Plaid, Platform, Pleated, Polka Dot, Preppy, Punk, Quiet Luxury, Quilted, Relaxed Fit, Resortwear, Retro, Rosette, Ruffle, Satin, Sequins, Sheer, Sherpa, Silk, Sporty, Strapless, Streetwear, Stripes, Suede, Tailored, Tennis Prep, Travel, Tropical, Tweed, Two-Tone, Unisex, Upcycled, Utility, Vacation, Vegan, Velour, Vintage, Waterproof, Wedding, Western, Whimsigoth, Winter, Wool, Woven, Y2K. Return them as a comma-separated string.
CATEGORY ROOT: Root category MUST be one of: Women, Men, Kids, Home, Pets, Electronics, Beauty. Never use Unisex. Choose Men or Women based on the item styling. Output format: Root > Subcategory > Type (e.g. Women > Shoes > Sneakers).`;
        } else if (platform === 'depop') {
            platformSpecificRules = `
BRAND CONSTRAINT: The brand name MUST be a valid and standard fashion brand. If the product is unbranded, handmade, custom, or from an unknown brand, you MUST return 'Other'.
SIZE CONSTRAINT: Output standard abbreviations for clothing (e.g., XS, S, M, L, XL, XXL). For shoes/footwear, output numbers (e.g., 8, 9, 10, 42).
CATEGORY PATH: Suggested Depop category path (e.g. Women > Footwear > Trainers). Root category MUST be Men, Women, or Kids for fashion items, or 'Everything else' for others.
EXTRA DEPOP ATTRIBUTES: Extract 'age' (Modern, 00s, 90s, 80s, etc.), 'source' (Vintage, Preloved, Custom, Handmade, Deadstock, etc.), 'body_fit', 'occasion', 'depop_type', 'fastening', 'fit'.`;
        } else if (platform === 'etsy') {
            platformSpecificRules = `
CATEGORY CONSTRAINT: Suggested Etsy category path (e.g., 'Clothing > Men\'s Clothing > Jackets & Coats' or 'Clothing > Women\'s Clothing > Tops' or 'Accessories > Bags & Purses'). Root category MUST be one of: Accessories, Art & Collectibles, Books, Movies & Music, Clothing, Craft Supplies & Tools, Electronics & Accessories, Home & Living, Jewelry, Paper & Party Supplies, Pet Supplies, Shoes, Toys & Games, Wedding & Party. Never use Unisex. Use Men's Clothing or Women's Clothing instead.`;
        }

        console.log(`[Etsy AI Fetch] Calling AI to clean and extract product data for platform: ${platform}...`);
        const mainResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are an expert product listing assistant. Your goal is to analyze scraped text details and product images, extract standard attributes accurately, and return them in a structured JSON format.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze the following raw scraped product page text content and the attached listing images:

Scraped Page Content:
${scrapedDetails.text}

1. Visual Research & Title Construction:
   - Identify the EXACT retail name of this product from the scraped text.
   - Generate a long, descriptive, keyword-rich title for Etsy (up to 140 characters). It should be detailed and include keywords like Brand, Material, Type, Style, etc. (e.g., 'Nike Sportswear Nylon Vintage Green Windbreaker Jacket Size Large').
   - Output the long title in the "title" property. Also extract individual parts for the title sequence: [${effectiveStructure.join(', ')}] inside 'title_parts'.

${descriptionInstruction}

3. Sizing, Color & Material Extraction:
   - Identify the 'brand' (clean name, e.g. "Nike", "Levi's", "Vintage").
   - Extract the 'size'. IMPORTANT: If the tag/label size is in French/Spanish/other abbreviation (like 'G' for Grande/Large, 'CH' for Chico/Small, 'P' for Petit/Small, 'EG' for Extra Grande/XL), you MUST translate it to the standard English equivalent (e.g., 'L' or 'Large' for G, 'S' or 'Small' for CH/P, 'XL' for EG). Always output standard English abbreviations (XS, S, M, L, XL, XXL) or standard numeric sizing.
   - Extract the primary 'color' (dominant color name, e.g. "Black", "Navy Blue").
   - Extract the 'material' (e.g. "100% Cotton", "Leather", "Denim").
   - Categorize the product and suggest a taxonomy/category path. Root category MUST be one of: Accessories, Art & Collectibles, Books, Movies & Music, Clothing, Craft Supplies & Tools, Electronics & Accessories, Home & Living, Jewelry, Paper & Party Supplies, Pet Supplies, Shoes, Toys & Games, Wedding & Party. Never use Unisex. Use Men's Clothing or Women's Clothing instead (e.g. 'Clothing > Men\'s Clothing > Jackets & Coats' or 'Clothing > Women\'s Clothing > Tops' or 'Accessories > Bags & Purses').
${platformSpecificRules}

4. Pricing:
   - Extract the clean numerical price value (in USD, e.g., 29.99). Estimate original MSRP retail price in 'original_price'.

5. Etsy Classification Attributes:
   - Extract 'who_made': Who made the product? Choose exactly one of:
     * 'i_did' (if made by the seller/handmade)
     * 'collective' (if made by a collective/shop member)
     * 'someone_else' (if commercial/vintage/made by another company or person)
   - Extract 'when_made': When was it made? Choose exactly one of:
     * '2020_2026'
     * '2010_2019'
     * '2007_2009'
      * '2000_2006'
     * '1990s' (Vintage - if 20+ years old)
     * '1980s' (Vintage - if 20+ years old)
     * '1970s'
      * '1960s'
      * '1950s'
      * 'before_1950' (Vintage)
   - Extract 'is_supply': Is it a supply or tool to make things? (boolean: true/false).
   - Extract 'renewal': Choose exactly 'automatic' or 'manual' (default 'manual').
   - Extract 'style_tag': Comma-separated list of keywords/tags. Choose up to 13 relevant style tags or keywords.

Context: Gender: ${gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A long, descriptive marketplace title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "Clean formatted description",
  "price": 0.00,
  "original_price": 0.00,
  "size": "Size",
  "color": "Color",
  "material": "Material",
  "category": "Category Path",
  "style_tag": "style tags (comma-separated, if applicable)",
  "who_made": "i_did",
  "when_made": "2020_2026",
  "is_supply": false,
  "renewal": "manual",
  "age": "age (if depop)",
  "source": "source (if depop)",
  "body_fit": "body_fit (if depop)",
  "occasion": "occasion (if depop)",
  "depop_type": "depop_type (if depop)",
  "fastening": "fastening (if depop)",
  "fit": "fit (if depop)"
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
            throw new Error("AI returned empty or invalid JSON response.");
        }

        // Generate Unique SKU
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

        // Standardize Title Parts
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
            .trim();

        const finalTitle = (finalData.title || titleString || 'New Etsy Fetched Listing').substring(0, 140);
        
        let formattedDescription = finalData.description || '';
        if (platform === 'poshmark' || platform === 'depop' || platform === 'etsy') {
            formattedDescription = formattedDescription
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '');
        } else {
            formattedDescription = wrapInTemplate(formattedDescription, finalTitle);
        }

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        // Platform specific formatting on return data
        let returnData = {
            title: finalTitle,
            description: formattedDescription,
            price: finalData.price || '0.00',
            originalPrice: finalData.original_price || '',
            brand: finalData.brand || 'Unbranded',
            size: finalData.size || '',
            color: finalData.color || '',
            material: finalData.material || '',
            category: finalData.category || 'Clothing',
            sku: finalData.sku,
            images: scrapedDetails.images || [],
            thumbnail: scrapedDetails.images?.[0] || '',
            title_parts: standardizedParts,
            platform: platform,
            selectedCondition: condition_name,
            conditionId: condition_name.toLowerCase().includes('new') ? 'new' : 'used',
            
            // Etsy Classification parameters:
            who_made: finalData.who_made || 'i_did',
            when_made: finalData.when_made || '2020_2026',
            is_supply: finalData.is_supply === true || finalData.is_supply === 'true',
            renewal: finalData.renewal || 'manual',
            styleTag: finalData.style_tag || ''
        };

        if (platform === 'poshmark') {
            const normalizedCategory = normalizePoshmarkCategory(finalData.category, gender);
            const matchedTaxonomy = POSHMARK_TAXONOMY.find(c => c.path.toLowerCase() === normalizedCategory.toLowerCase()) || {};
            
            returnData.category = normalizedCategory;
            returnData.category_name = normalizedCategory;
            returnData.categoryId = matchedTaxonomy.categoryId || '';
            returnData.departmentId = matchedTaxonomy.departmentId || '';
            returnData.subcategoryIds = matchedTaxonomy.id && matchedTaxonomy.id !== matchedTaxonomy.categoryId ? [matchedTaxonomy.id] : [];
            
            // Limit Poshmark colors to allowed list
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
            returnData.color = matchedColors.slice(0, 2).join(', ');

            // Limit Poshmark style tags to allowed list
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
            returnData.styleTag = matchedTags.slice(0, 3).join(', ');
        } else if (platform === 'depop') {
            const matchedCategory = normalizeDepopCategory(finalData.category, gender);
            returnData.category = matchedCategory.path;
            returnData.category_name = matchedCategory.path;
            returnData.categoryId = matchedCategory.id;
            returnData.attribute_ids = matchedCategory.attribute_ids || [];
            returnData.size = resolveCompositeSize(matchedCategory.path, finalData.size);
            
            returnData.age = finalData.age || '';
            returnData.source = finalData.source || '';
            returnData.material = finalData.material || '';
            returnData.bodyFit = finalData.body_fit || '';
            returnData.occasion = finalData.occasion || '';
            returnData.depopType = finalData.depop_type || '';
            returnData.fastening = finalData.fastening || '';
            returnData.fit = finalData.fit || '';
            returnData.styleTag = finalData.style_tag || '';
        }

        return res.json({
            success: true,
            data: returnData
        });

    } catch (error) {
        console.error('❌ Etsy AI Fetch Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.etsyAnalyzeListing = async (req, res) => {
    console.log(`\n--- [Etsy AI Scan] New Image Scan Request Received ---`);
    try {
        const {
            images,
            title_sequence = DEFAULT_TITLE_SEQUENCE,
            description_prompt = '',
            description_template = '',
            condition_name = 'Pre-owned',
            gender = 'Unisex',
            model = 'gpt-4o-mini'
        } = req.body;

        if (!images || images.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one image is required.' });
        }

        // Validate subscription usage limit
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        const plan = user.subscription?.plan || 'free';
        const status = user.subscription?.status;

        if (plan !== 'free' && status !== 'active') {
            return res.status(403).json({ error: "Your subscription plan is inactive. Please activate your subscription." });
        }

        const limits = {
            free: 10,
            basic: 50,
            pro: 500,
            enterprise: 99999
        };
        const limit = limits[plan] || 10;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const currentUsage = await Listing.countDocuments({
            user: req.user.id,
            createdAt: { $gte: startOfMonth }
        });

        if (currentUsage >= limit) {
            return res.status(403).json({ 
                error: `Usage limit exceeded. You have used all ${limit} listings available in your ${plan.toUpperCase()} plan. Please upgrade to continue.`
            });
        }

        // Setup AI Client
        let aiClient = openai;
        let finalModel = model || 'gpt-4o-mini';

        if (finalModel.startsWith('gemini-')) {
            aiClient = new OpenAI({
                apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
                baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
            });
        }

        const effectiveStructure = dedupeOrdered(
            normalizeStringList(title_sequence).length > 0
                ? normalizeStringList(title_sequence)
                : DEFAULT_TITLE_SEQUENCE
        );

        // Limit vision analysis to top 3 images to save tokens and speed up API response
        console.log(`[Etsy AI Scan] Resizing and compressing ${images.length} images...`);
        const topImages = images.slice(0, 3);
        const compressedImages = await Promise.all(
            topImages.map(img => compressImageIfBase64(img))
        );
        console.log(`[Etsy AI Scan] Image compression complete.`);

        const imageContent = compressedImages.map(imgUrl => ({
            type: "image_url",
            image_url: { 
                url: imgUrl,
                detail: "auto"
            }
        }));

        let descriptionInstruction = '';
        if (description_template && description_template.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM HTML TEMPLATE:
   "${description_template.trim()}"
   
   - Fill in the HTML template by replacing placeholders (like {hook}, {brandInfo}, {features}, {Brand}, {Size}, etc.) or descriptive placeholders inside curly braces/brackets with actual analysis from the product details and images.
   - For Etsy: output the final populated description as plain text (STRICTLY NO HTML TAGS).`;

            if (description_prompt && description_prompt.trim() !== '') {
                descriptionInstruction += `\n   - ADDITIONAL USER INSTRUCTION/TONE GUIDANCE: "${description_prompt.trim()}". Follow this guidance when generating the contents for the placeholders.`;
            }
        } else if (description_prompt && description_prompt.trim() !== '') {
            descriptionInstruction = `2. Description Construction - STRICTLY FOLLOW THE USER'S CUSTOM INSTRUCTION/TEMPLATE:
   "${description_prompt.trim()}"
   
   - Replace any placeholders like {Brand}, {Size}, {Material}, {Type}, etc. with data from the product details.
   - For Etsy: format as clean plain text (STRICTLY NO HTML tags).`;
        } else {
            descriptionInstruction = `2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Plain Text Only):
   - Do NOT use HTML tags (like <b>, <br>).
   - Format with uppercase headers and standard newlines.
   - Include these sections:
     THE ULTIMATE LOOK: {Engaging hook about the item}
     
     ABOUT THE BRAND: {Brand heritage info}
     
     KEY FEATURES:
     - {Material, durability and design details}
     
     CONDITION: ${condition_name}.`;
        }

        console.log(`[Etsy AI Scan] Calling AI vision model to analyze product images...`);
        const mainResponse = await aiClient.chat.completions.create({
            model: finalModel,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are an expert product listing assistant. Your goal is to analyze product images, extract standard attributes accurately, and return them in a structured JSON format.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze the attached listing images:

1. Visual Research & Title Construction:
   - Identify the product and extract the exact brand and retail model name.
   - Generate a long, descriptive, keyword-rich title for Etsy (up to 140 characters). It should be detailed and include keywords like Brand, Material, Type, Style, etc. (e.g., 'Nike Sportswear Nylon Vintage Green Windbreaker Jacket Size Large').
   - Output the long title in the "title" property. Also extract individual parts for the title sequence: [${effectiveStructure.join(', ')}] inside 'title_parts'.

${descriptionInstruction}

3. Sizing, Color & Material Extraction:
   - Identify the 'brand' (clean name, e.g. "Nike", "Levi's", "Vintage").
   - Extract the 'size'. IMPORTANT: If the tag/label size is in French/Spanish/other abbreviation (like 'G' for Grande/Large, 'CH' for Chico/Small, 'P' for Petit/Small, 'EG' for Extra Grande/XL), you MUST translate it to the standard English equivalent (e.g., 'L' or 'Large' for G, 'S' or 'Small' for CH/P, 'XL' for EG). Always output standard English abbreviations (XS, S, M, L, XL, XXL) or standard numeric sizing.
   - Extract the primary 'color' (dominant color name, e.g. "Black", "Navy Blue").
   - Extract the 'material' (e.g. "100% Cotton", "Leather", "Denim").
   - Categorize the product and suggest a taxonomy/category path. Root category MUST be one of: Accessories, Art & Collectibles, Books, Movies & Music, Clothing, Craft Supplies & Tools, Electronics & Accessories, Home & Living, Jewelry, Paper & Party Supplies, Pet Supplies, Shoes, Toys & Games, Wedding & Party. Never use Unisex. Use Men's Clothing or Women's Clothing instead (e.g. 'Clothing > Men\'s Clothing > Jackets & Coats' or 'Clothing > Women\'s Clothing > Tops' or 'Accessories > Bags & Purses').

4. Pricing:
   - Estimate a reasonable pricing value (in USD, e.g., 29.99). Estimate original MSRP retail price in 'original_price'.

5. Etsy Classification Attributes:
   - Extract 'who_made': Who made the product? Choose exactly one of:
     * 'i_did' (if made by the seller/handmade)
     * 'collective' (if made by a collective/shop member)
     * 'someone_else' (if commercial/vintage/made by another company or person)
   - Extract 'when_made': When was it made? Choose exactly one of:
     * '2020_2026'
     * '2010_2019'
     * '2007_2009'
      * '2000_2006'
     * '1990s' (Vintage - if 20+ years old)
     * '1980s' (Vintage - if 20+ years old)
     * '1970s'
      * '1960s'
      * '1950s'
      * 'before_1950' (Vintage)
   - Extract 'is_supply': Is it a supply or tool to make things? (boolean: true/false).
   - Extract 'renewal': Choose exactly 'automatic' or 'manual' (default 'manual').
   - Extract 'style_tag': Comma-separated list of keywords/tags. Choose up to 13 relevant style tags or keywords.

Context: Gender: ${gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A long, descriptive marketplace title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "Clean formatted description",
  "price": 0.00,
  "original_price": 0.00,
  "size": "Size",
  "color": "Color",
  "material": "Material",
  "category": "Category Path",
  "style_tag": "style tags (comma-separated, if applicable)",
  "who_made": "i_did",
  "when_made": "2020_2026",
  "is_supply": false,
  "renewal": "manual"
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
            throw new Error("AI returned empty or invalid JSON response.");
        }

        // Generate Unique SKU
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

        // Standardize Title Parts
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
            .trim();

        const finalTitle = (finalData.title || titleString || 'New Etsy Scanned Listing').substring(0, 140);
        
        let formattedDescription = finalData.description || '';
        formattedDescription = formattedDescription
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '');

        if (req.user) {
            await logActivity({
                action: 'ai_fetch',
                userId: req.user.id,
                status: 'success'
            });
        }

        let resolvedCategoryId = '';
        let resolvedCategoryName = finalData.category || 'Clothing';
        try {
            const taxonomy = await getEtsyTaxonomy();
            let matchedCat = taxonomy.find(cat => cat.fullName.toLowerCase() === resolvedCategoryName.toLowerCase().trim());
            if (!matchedCat) {
                matchedCat = taxonomy.find(cat => cat.fullName.toLowerCase().includes(resolvedCategoryName.toLowerCase().trim()));
            }
            if (!matchedCat) {
                let bestScore = 0;
                taxonomy.forEach(cat => {
                    if (resolvedCategoryName.toLowerCase().includes(cat.name.toLowerCase())) {
                        let score = cat.name.length;
                        if (score > bestScore) {
                            bestScore = score;
                            matchedCat = cat;
                        }
                    }
                });
            }
            if (matchedCat) {
                resolvedCategoryId = matchedCat.id;
                resolvedCategoryName = matchedCat.fullName;
                console.log(`[Etsy AI Scan] Category resolved successfully: ${resolvedCategoryName} (ID: ${resolvedCategoryId})`);
            }
        } catch (catErr) {
            console.error('[Etsy AI Scan] Failed to resolve category ID:', catErr.message);
        }

        let returnData = {
            title: finalTitle,
            description: formattedDescription,
            price: finalData.price || '0.00',
            originalPrice: finalData.original_price || '',
            brand: finalData.brand || 'Unbranded',
            size: finalData.size || '',
            color: finalData.color || '',
            material: finalData.material || '',
            category: resolvedCategoryName,
            categoryId: resolvedCategoryId,
            sku: finalData.sku,
            images: images,
            thumbnail: images[0] || '',
            title_parts: standardizedParts,
            platform: 'etsy',
            selectedCondition: condition_name,
            conditionId: condition_name.toLowerCase().includes('new') ? 'new' : 'used',
            
            // Etsy fields:
            who_made: finalData.who_made || 'i_did',
            when_made: finalData.when_made || '2020_2026',
            is_supply: finalData.is_supply === true || finalData.is_supply === 'true',
            renewal: finalData.renewal || 'manual',
            styleTag: finalData.style_tag || ''
        };

        return res.json({
            success: true,
            data: returnData
        });

    } catch (error) {
        console.error('❌ Etsy AI Scan Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

let cachedEtsyTaxonomy = null;
async function getEtsyTaxonomy() {
  if (cachedEtsyTaxonomy) return cachedEtsyTaxonomy;
  const axios = require('axios');
  const ETSY_CLIENT_ID = process.env.ETSY_CLIENT_ID || '8wjat6eeh0w2bpsx7csgxrb4';
  const ETSY_CLIENT_SECRET = process.env.ETSY_CLIENT_SECRET || '53py6xxcyt';
  try {
    console.log('[Etsy Category Search] Fetching seller taxonomy from Etsy API...');
    const response = await axios.get('https://openapi.etsy.com/v3/application/seller-taxonomy/nodes', {
      headers: {
        'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`
      }
    });
    
    if (response.data && response.data.results) {
      const flatList = [];
      function traverse(node, currentPath = []) {
        const path = [...currentPath, node.name];
        flatList.push({
          id: String(node.id),
          name: node.name,
          fullName: path.join(' > '),
          level: node.level
        });
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => traverse(child, path));
        }
      }
      response.data.results.forEach(node => traverse(node));
      cachedEtsyTaxonomy = flatList;
      console.log(`[Etsy Category Search] Loaded ${flatList.length} categories.`);
      return flatList;
    }
    return [];
  } catch (err) {
    console.error('[Etsy Category Search] Failed to fetch seller taxonomy:', err.response?.data || err.message);
    return [];
  }
}

// Simple Levenshtein distance helper for fuzzy matching
function levenshteinDistance(s1, s2) {
    if (Math.abs(s1.length - s2.length) > 2) return 99;
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    return track[s2.length][s1.length];
}

function getEtsyShortLabel(fullName) {
  if (!fullName) return '';
  let label = fullName;
  
  // Clothing mappings
  if (label.startsWith("Clothing > Men's Clothing > ")) {
    return "Men's " + label.replace("Clothing > Men's Clothing > ", "");
  }
  if (label.startsWith("Clothing > Women's Clothing > ")) {
    return "Women's " + label.replace("Clothing > Women's Clothing > ", "");
  }
  if (label.startsWith("Clothing > Boys' Clothing > ")) {
    return "Boys' " + label.replace("Clothing > Boys' Clothing > ", "");
  }
  if (label.startsWith("Clothing > Girls' Clothing > ")) {
    return "Girls' " + label.replace("Clothing > Girls' Clothing > ", "");
  }
  if (label.startsWith("Clothing > Unisex Adult Clothing > ")) {
    return "Gender-Neutral Adult " + label.replace("Clothing > Unisex Adult Clothing > ", "");
  }
  if (label.startsWith("Clothing > Unisex Kids' Clothing > ")) {
    return "Gender-Neutral Kids' " + label.replace("Clothing > Unisex Kids' Clothing > ", "");
  }
  if (label.startsWith("Clothing > Baby Boys' Clothing > ")) {
    return "Baby Boys' " + label.replace("Clothing > Baby Boys' Clothing > ", "");
  }
  if (label.startsWith("Clothing > Baby Girls' Clothing > ")) {
    return "Baby Girls' " + label.replace("Clothing > Baby Girls' Clothing > ", "");
  }
  if (label.startsWith("Clothing > Unisex Baby Clothing > ")) {
    return "Gender-Neutral Baby " + label.replace("Clothing > Unisex Baby Clothing > ", "");
  }
  
  // Shoes mappings
  if (label.startsWith("Shoes > Men's Shoes > ")) {
    return "Men's " + label.replace("Shoes > Men's Shoes > ", "");
  }
  if (label.startsWith("Shoes > Women's Shoes > ")) {
    return "Women's " + label.replace("Shoes > Women's Shoes > ", "");
  }
  if (label.startsWith("Shoes > Boys' Shoes > ")) {
    return "Boys' " + label.replace("Shoes > Boys' Shoes > ", "");
  }
  if (label.startsWith("Shoes > Girls' Shoes > ")) {
    return "Girls' " + label.replace("Shoes > Girls' Shoes > ", "");
  }
  if (label.startsWith("Shoes > Unisex Adult Shoes > ")) {
    return "Gender-Neutral Adult " + label.replace("Shoes > Unisex Adult Shoes > ", "");
  }
  if (label.startsWith("Shoes > Unisex Kids' Shoes > ")) {
    return "Gender-Neutral Kids' " + label.replace("Shoes > Unisex Kids' Shoes > ", "");
  }

  const parts = label.split(' > ');
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return label;
}

exports.searchEtsyCategories = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);

        let cleanQuery = String(query).toLowerCase().trim();
        // Auto-correct common typos
        cleanQuery = cleanQuery
            .replace(/jecket/g, 'jacket')
            .replace(/coates/g, 'coats')
            .replace(/jeanss/g, 'jeans');

        const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
        const taxonomy = await getEtsyTaxonomy();

        const matches = taxonomy.map(cat => {
            const shortLabel = getEtsyShortLabel(cat.fullName);
            const catPathLower = (cat.fullName.toLowerCase() + " " + shortLabel.toLowerCase());
            let score = 0;
            
            // Check how many query tokens match or are close to words in category path
            queryTokens.forEach(token => {
                if (catPathLower.includes(token)) {
                    score += 2.0; // exact token match inside path gets high score
                } else {
                    const catWords = catPathLower.split(/[^a-z0-9]+/);
                    catWords.forEach(word => {
                        if (levenshteinDistance(word, token) <= 1) {
                            score += 1.0; // close token match gets partial score
                        }
                    });
                }
            });

            return { cat, score, shortLabel };
        })
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);

        const formatted = matches.slice(0, 20).map(m => ({
            id: m.cat.id,
            name: m.cat.name,
            fullName: m.cat.fullName,
            label: m.shortLabel
        }));

        res.json(formatted);
    } catch (error) {
        console.error('❌ Etsy Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
