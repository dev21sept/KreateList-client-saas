const OpenAI = require('openai');
const sharp = require('sharp');
const axios = require('axios');
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

function getTokens(str) {
    if (!str) return [];
    let normalized = String(str).toLowerCase()
        .replace(/t[\s-]?shirt/g, 'tshirt')
        .replace(/tee[\s-]?shirt/g, 'tshirt');
    const rawTokens = normalized.split(/[\s,\/\-_&]+/);
    const tokens = [];
    rawTokens.forEach(t => {
        const cleaned = t.trim().replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 1) {
            tokens.push(cleaned);
        }
    });
    // Also include composite words like "t-shirt" (just removing hyphen) if they are in the original string
    const wordsWithHyphens = normalized.split(/\s+/);
    wordsWithHyphens.forEach(w => {
        const cleaned = w.trim().replace(/[^a-z0-9-]/g, '');
        if (cleaned.includes('-') && cleaned.length > 2) {
            tokens.push(cleaned);
        }
    });
    return [...new Set(tokens)];
}

function scoreCategory(categoryPath, queryStr) {
    const pathLower = categoryPath.toLowerCase();
    const queryTokens = getTokens(queryStr);
    const pathParts = pathLower.split(/\s*>\s*/);
    const lastPart = pathParts[pathParts.length - 1] || '';
    
    const pathTokens = getTokens(pathLower);
    const lastPartTokens = getTokens(lastPart);

    let score = 0;

    queryTokens.forEach(qToken => {
        const qSingular = qToken.endsWith('s') ? qToken.slice(0, -1) : qToken;

        // Check path tokens
        let matchedInPath = false;
        for (const pToken of pathTokens) {
            const pSingular = pToken.endsWith('s') ? pToken.slice(0, -1) : pToken;
            if (pToken === qToken || pSingular === qSingular || pToken === qSingular || pSingular === qToken) {
                score += 10;
                matchedInPath = true;
                break;
            }
        }
        if (!matchedInPath && pathLower.includes(qToken)) {
            score += 5;
        }

        // Check last part tokens (extra score for leaf matching)
        let matchedInLeaf = false;
        for (const lToken of lastPartTokens) {
            const lSingular = lToken.endsWith('s') ? lToken.slice(0, -1) : lToken;
            if (lToken === qToken || lSingular === qSingular || lToken === qSingular || lSingular === qToken) {
                score += 15;
                matchedInLeaf = true;
                break;
            }
        }
        if (!matchedInLeaf && lastPart.includes(qToken)) {
            score += 7;
        }
    });

    // Gender matching logic
    const rootCategory = pathParts[0] || '';
    const queryLower = queryStr.toLowerCase();
    
    const isQueryMen = queryLower.includes('men') && !queryLower.includes('women');
    const isQueryWomen = queryLower.includes('women');
    const isQueryKids = queryLower.includes('kids') || queryLower.includes('boy') || queryLower.includes('girl') || queryLower.includes('baby');

    if (isQueryMen) {
        if (rootCategory.includes('men')) {
            score += 30; // Strong boost for correct root
        } else if (rootCategory.includes('women') || rootCategory.includes('kids')) {
            score -= 30; // Penalty for mismatch
        }
    } else if (isQueryWomen) {
        if (rootCategory.includes('women')) {
            score += 30;
        } else if (rootCategory.includes('men') || rootCategory.includes('kids')) {
            score -= 30;
        }
    } else if (isQueryKids) {
        if (rootCategory.includes('kids')) {
            score += 30;
        } else if (rootCategory.includes('men') || rootCategory.includes('women')) {
            score -= 20;
        }
    }

    // Penalize catch-all "other" categories so specific categories rank higher
    const lastPartLower = lastPart.toLowerCase();
    if (lastPartLower.includes('other') || lastPartLower.includes('misc') || lastPartLower.includes('miscellaneous')) {
        score -= 25;
    }

    // High-value keyword boosts to resolve classification confusion (e.g. shirt vs t-shirt, jeans vs pants)
    const queryTokensSet = new Set(queryTokens);
    
    // T-shirt boost
    if (queryTokensSet.has('tshirt') || queryTokensSet.has('t-shirt')) {
        if (pathLower.includes('t-shirts') || pathLower.includes('t-shirt')) {
            score += 50;
        }
    }
    
    // Shirt boost (only if NOT a t-shirt)
    const hasTshirt = queryTokensSet.has('tshirt') || queryTokensSet.has('t-shirt');
    if (queryTokensSet.has('shirt') && !hasTshirt) {
        if (pathLower.includes('shirts') && !pathLower.includes('t-shirts') && !pathLower.includes('sweatshirts')) {
            score += 50;
        }
    }

    // Jeans boost
    if (queryTokensSet.has('jeans') || queryTokensSet.has('jean')) {
        if (pathLower.includes('jeans') || pathLower.includes('jean ')) {
            score += 50;
        }
    }

    // Hoodie boost
    if (queryTokensSet.has('hoodie') || queryTokensSet.has('hoodies')) {
        if (pathLower.includes('hoodie') || pathLower.includes('hoodies')) {
            score += 50;
        }
    }

    // Sweatshirt / Jumper / Sweater boost
    if (queryTokensSet.has('sweatshirt') || queryTokensSet.has('sweatshirts') || queryTokensSet.has('jumper') || queryTokensSet.has('sweater')) {
        if (pathLower.includes('sweatshirt') || pathLower.includes('jumper') || pathLower.includes('sweater') || pathLower.includes('cardigan')) {
            score += 50;
        }
    }

    // Polo boost
    if (queryTokensSet.has('polo') || queryTokensSet.has('polos')) {
        if (pathLower.includes('polo')) {
            score += 50;
        }
    }

    // Dress boost
    if (queryTokensSet.has('dress') || queryTokensSet.has('dresses')) {
        if (pathLower.includes('dress') || pathLower.includes('dresses')) {
            score += 50;
        }
    }

    // Skirt boost
    if (queryTokensSet.has('skirt') || queryTokensSet.has('skirts')) {
        if (pathLower.includes('skirt') || pathLower.includes('skirts') || pathLower.includes('skort')) {
            score += 50;
        }
    }

    // Jacket boost
    if (queryTokensSet.has('jacket') || queryTokensSet.has('jackets')) {
        if (pathLower.includes('jacket') || pathLower.includes('jackets')) {
            score += 50;
        }
    }

    // Coat boost
    if (queryTokensSet.has('coat') || queryTokensSet.has('coats')) {
        if (pathLower.includes('coat') || pathLower.includes('coats')) {
            score += 50;
        }
    }

    // Sneakers boost
    if (queryTokensSet.has('sneakers') || queryTokensSet.has('sneaker') || queryTokensSet.has('trainers')) {
        if (pathLower.includes('sneakers') || pathLower.includes('sneaker')) {
            score += 50;
        }
    }

    // Boots boost
    if (queryTokensSet.has('boots') || queryTokensSet.has('boot')) {
        if (pathLower.includes('boots') || pathLower.includes('boot')) {
            score += 50;
        }
    }

    // Shorts boost
    if (queryTokensSet.has('shorts') || queryTokensSet.has('short')) {
        if (pathLower.includes('shorts') && !pathLower.includes('t-shirts')) {
            score += 50;
        }
    }

    // Leggings boost
    if (queryTokensSet.has('leggings') || queryTokensSet.has('legging')) {
        if (pathLower.includes('leggings')) {
            score += 50;
        }
    }

    // Tracksuit boost
    if (queryTokensSet.has('tracksuit') || queryTokensSet.has('tracksuits')) {
        if (pathLower.includes('tracksuit')) {
            score += 50;
        }
    }

    // Joggers / Sweatpants boost
    if (queryTokensSet.has('joggers') || queryTokensSet.has('jogger') || queryTokensSet.has('sweatpants')) {
        if (pathLower.includes('joggers') || pathLower.includes('sweatpants') || pathLower.includes('activewear')) {
            score += 50;
        }
    }

    // Cargo boost
    if (queryTokensSet.has('cargo')) {
        if (pathLower.includes('cargo')) {
            score += 50;
        }
    }

    // Blazer boost
    if (queryTokensSet.has('blazer') || queryTokensSet.has('blazers')) {
        if (pathLower.includes('blazer')) {
            score += 50;
        }
    }

    // Suit boost (avoid swimsuit, activewear)
    if (queryTokensSet.has('suit') || queryTokensSet.has('suits')) {
        if (pathLower.includes('suits') && !pathLower.includes('swimwear') && !pathLower.includes('activewear')) {
            score += 50;
        }
    }

    // Vest boost
    if (queryTokensSet.has('vest') || queryTokensSet.has('vests')) {
        if (pathLower.includes('vests') || pathLower.includes('vest')) {
            score += 50;
        }
    }

    // Tank Top boost
    if (queryTokensSet.has('tank') || queryTokensSet.has('tanks')) {
        if (pathLower.includes('tank tops') || pathLower.includes('tank top')) {
            score += 50;
        }
    }

    // Sandals boost
    if (queryTokensSet.has('sandals') || queryTokensSet.has('sandal') || queryTokensSet.has('slides')) {
        if (pathLower.includes('sandals') || pathLower.includes('slides')) {
            score += 50;
        }
    }

    // Heels boost
    if (queryTokensSet.has('heels') || queryTokensSet.has('heel') || queryTokensSet.has('pumps')) {
        if (pathLower.includes('heels') || pathLower.includes('pumps')) {
            score += 50;
        }
    }

    // Loafers boost
    if (queryTokensSet.has('loafers') || queryTokensSet.has('loafer') || queryTokensSet.has('flats')) {
        if (pathLower.includes('loafers') || pathLower.includes('flats') || pathLower.includes('boat shoes')) {
            score += 50;
        }
    }

    // Backpack boost
    if (queryTokensSet.has('backpack') || queryTokensSet.has('backpacks')) {
        if (pathLower.includes('backpack')) {
            score += 50;
        }
    }

    // Handbag / Bag boost
    if (queryTokensSet.has('handbag') || queryTokensSet.has('handbags') || queryTokensSet.has('bag') || queryTokensSet.has('bags')) {
        if (pathLower.includes('handbag') || pathLower.includes('bags') || pathLower.includes('clutches')) {
            if (!pathLower.includes('sleeping bags') && !pathLower.includes('litter') && !pathLower.includes('diaper')) {
                score += 50;
            }
        }
    }

    // Wallet / Purse boost
    if (queryTokensSet.has('wallet') || queryTokensSet.has('wallets') || queryTokensSet.has('purse')) {
        if (pathLower.includes('wallet') || pathLower.includes('purse')) {
            score += 50;
        }
    }

    // Watch boost
    if (queryTokensSet.has('watch') || queryTokensSet.has('watches')) {
        if (pathLower.includes('watch') || pathLower.includes('watches')) {
            score += 50;
        }
    }

    // Belt boost
    if (queryTokensSet.has('belt') || queryTokensSet.has('belts')) {
        if (pathLower.includes('belt') || pathLower.includes('belts')) {
            score += 50;
        }
    }

    // Hat / Cap boost
    if (queryTokensSet.has('hat') || queryTokensSet.has('hats') || queryTokensSet.has('cap') || queryTokensSet.has('caps') || queryTokensSet.has('beanie')) {
        if (pathLower.includes('hat') || pathLower.includes('cap') || pathLower.includes('beanie') || pathLower.includes('headwear')) {
            score += 50;
        }
    }

    // Scarf boost
    if (queryTokensSet.has('scarf') || queryTokensSet.has('scarves')) {
        if (pathLower.includes('scarf') || pathLower.includes('scarves') || pathLower.includes('wrap')) {
            score += 50;
        }
    }

    return score;
}

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
    const isMen = String(itemGender).toLowerCase() === 'men' || String(itemGender).toLowerCase() === 'male';
    const defaultCategory = isMen
        ? "Men > Clothing > Tops & T-shirts > T-shirts > Plain T-shirts"
        : "Women > Clothing > Tops & T-shirts > Other tops & t-shirts";
    if (!cleanAi) return defaultCategory;

    // Convert Unisex to Men or Women
    if (cleanAi.startsWith('unisex')) {
        if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male') {
            cleanAi = cleanAi.replace('unisex', 'men');
        } else {
            cleanAi = cleanAi.replace('unisex', 'women');
        }
    }

    // Direct match check
    let directMatch = VINTED_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
    if (directMatch) return directMatch.path;

    // Path level comparison check
    const aiParts = cleanAi.split('>').map(p => p.trim());
    let bestMatch = defaultCategory;
    let maxMatchLength = 0;
    let minPathDifference = 999;

    for (const cat of VINTED_TAXONOMY) {
        const catParts = cat.path.toLowerCase().split('>').map(p => p.trim());
        
        // Count consecutive matching levels from root
        let matchLength = 0;
        const maxPossible = Math.min(aiParts.length, catParts.length);
        for (let i = 0; i < maxPossible; i++) {
            if (aiParts[i] === catParts[i]) {
                matchLength++;
            } else {
                break;
            }
        }

        // If matchLength is equal, prefer the one with smaller remaining length difference
        const pathDiff = Math.abs(catParts.length - aiParts.length);

        if (matchLength > maxMatchLength) {
            maxMatchLength = matchLength;
            minPathDifference = pathDiff;
            bestMatch = cat.path;
        } else if (matchLength === maxMatchLength && matchLength > 0) {
            if (pathDiff < minPathDifference) {
                minPathDifference = pathDiff;
                bestMatch = cat.path;
            }
        }
    }

    // Fallback to token overlap if no prefix match at all
    if (maxMatchLength === 0) {
        const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
        let maxOverlap = 0;
        
        for (const cat of VINTED_TAXONOMY) {
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
            image_url: { 
                url: url,
                detail: "auto"
            }
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

3. Product Characteristics (for Category Selection):
   - Identify the target gender/demographic (e.g. Men, Women, Kids, Baby, etc.).
   - Identify the general product type (e.g. T-Shirt, Jeans, Sneakers, Dress, Hoodie, Book, Video Game, etc.).
   - Identify the sub-type or style details (e.g. Plain T-Shirt, Slim Fit Jeans, Running Shoes, Maxi Dress, Pullover Hoodie, etc.).

4. Pricing: Estimate a realistic 'selling_price' in USD and estimate 'original_price' in USD.
5. Attribute Extraction:
   - Identify 'color'.
   - Identify 'size'.
   - Identify the materials of the product. Use ONLY materials from this allowed list: Acrylic, Alpaca, Bamboo, Canvas, Cardboard, Cashmere, Ceramic, Chiffon, Corduroy, Cotton, Denim, Down, Elastane, Faux fur, Faux leather, Felt, Flannel, Fleece, Foam, Glass, Gold, Jute, Lace, Latex, Leather, Linen, Merino, Mesh, Metal, Mohair, Neoprene, Nylon, Paper, Patent leather, Plastic, Polyester, Porcelain, Rattan, Rayon, Rubber, Satin, Sequin, Silicone, Silk, Silver, Steel, Stone, Straw, Suede, Tulle, Tweed, Velour, Velvet, Wood, Wool. If the material is not explicitly visible or labeled in the images, you MUST estimate/approximate the most likely materials based on the product type (e.g. Cotton for a t-shirt, Denim for jeans). Return them as a comma-separated list of 1 to 3 materials (e.g., 'Cotton, Polyester'). DO NOT leave this empty.
   - If the product is a book, identify 'isbn', 'author', and 'book_title'.
   - If the product is a video game, identify 'video_game_rating'.
   - If measurements are relevant (clothing, shoes, bags, accessories, etc.), extract 'measurements'. Carefully check all product images for any measuring tapes, ruler lines, or visible measurements, and extract them accurately (e.g., 'Pit to pit: 21 in, Length: 28 in'). If there are no measurements visible in the images, you MUST estimate/approximate realistic measurements based on the item type and size (e.g., for a Size M shirt: 'Pit to pit: 20 in, Length: 27 in'). DO NOT leave this empty.
 
Context: Gender: ${gender}.

Response ONLY as JSON: {
  "brand": "Company Name",
  "title": "A descriptive title",
  "title_parts": { "AttributeName": "Value", ... },
  "description": "HTML content",
  "detected_gender": "Target demographic (e.g. Men, Women, Kids, Baby)",
  "product_type": "Product type (e.g. T-Shirt, Jeans, Dress, Sneakers)",
  "sub_type": "Sub-type / style (e.g. Plain T-Shirt, Skinny Jeans)",
  "selling_price": 0.00,
  "original_price": 0.00,
  "color": "Color",
  "size": "Size",
  "material": "Primary materials of the product, comma-separated, max 3 from allowed list (e.g. Cotton, Polyester)",
  "isbn": "ISBN code if a book",
  "author": "Author name if a book",
  "book_title": "Book title if a book",
  "video_game_rating": "Rating if a video game (e.g. PEGI 3, ESRB Everyone, etc.)",
  "measurements": "Measurements details if clothing/shoes/accessories (e.g. Pit to pit: 21 in, Length: 28 in)"
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

        // Step 2: Search and rank categories from VINTED_TAXONOMY
        const detectedGender = finalData.detected_gender || finalData.gender || gender || 'Unisex';
        const productType = finalData.product_type || '';
        const subType = finalData.sub_type || '';

        const searchQuery = `${detectedGender} ${productType} ${subType}`.trim();
        console.log(`[Vinted AI] Category search query generated: "${searchQuery}"`);

        // Score each category in taxonomy
        const scoredCategories = VINTED_TAXONOMY.map(cat => ({
            category: cat,
            score: scoreCategory(cat.path, searchQuery)
        }));

        // Sort by score in descending order
        scoredCategories.sort((a, b) => b.score - a.score);

        // Take top 10 candidate paths
        const topCandidates = scoredCategories.slice(0, 10).map(sc => sc.category.path);
        console.log(`[Vinted AI] Top candidates with scores:`, 
            scoredCategories.slice(0, 5).map(sc => `${sc.category.path} (Score: ${sc.score})`)
        );

        // Step 3: Query AI (text-only) to select the single best category from top 10 candidates
        const isMen = detectedGender.toLowerCase() === 'men' || detectedGender.toLowerCase() === 'male' || gender.toLowerCase() === 'men';
        const fallbackCategory = isMen
            ? "Men > Clothing > Tops & T-shirts > T-shirts > Plain T-shirts"
            : "Women > Clothing > Tops & T-shirts > Other tops & t-shirts";

        let chosenCategory = '';
        if (topCandidates.length > 0) {
            console.log(`[Vinted AI] Querying AI (text-only) to select best category from top 10 candidates...`);
            const categoryResponse = await aiClient.chat.completions.create({
                model: finalModel,
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content: "You are a Vinted category classification assistant. You must select the single most accurate category path from the provided list."
                    },
                    {
                        role: "user",
                        content: `Based on the product details below, choose the SINGLE most accurate category path from the provided list of candidate options.
                        
Product Details:
- Brand: ${finalData.brand || ''}
- Gender/Demographic: ${detectedGender}
- Product Type: ${productType}
- Sub-type / Style details: ${subType}
- Primary Color: ${finalData.color || ''}
- Description: ${finalData.description || ''}

Candidate Options (Choose EXACTLY ONE path):
${topCandidates.map((path, idx) => `${idx + 1}. ${path}`).join('\n')}

CRITICAL RULES:
- You MUST choose exactly one category path from the list above.
- Return the selection EXACTLY as it appears in the list (do not modify, abbreviate, or invent a path).
- Do not output any explanation or extra text.

Response ONLY as JSON:
{
  "category": "Exact chosen category path"
}`
                    }
                ],
                response_format: { type: "json_object" }
            });

            try {
                const categoryData = JSON.parse(categoryResponse.choices[0].message.content);
                chosenCategory = String(categoryData.category || '').trim();
                console.log(`[Vinted AI] AI chose category: "${chosenCategory}"`);
            } catch (err) {
                console.error(`[Vinted AI] Error parsing category AI response, using top scorer:`, err.message);
                chosenCategory = topCandidates[0];
            }
        }

        // Fallback to highest scorer if selection is empty or invalid
        if (!chosenCategory || !VINTED_TAXONOMY.some(c => c.path === chosenCategory)) {
            console.warn(`[Vinted AI] Selected category was invalid or not found in taxonomy, falling back to top candidate`);
            chosenCategory = topCandidates[0] || fallbackCategory;
        }

        finalData.category = chosenCategory;

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

        const normalizedCategory = finalData.category;
        const matchedTaxonomy = VINTED_TAXONOMY.find(c => c.path.toLowerCase() === normalizedCategory.toLowerCase()) || {};

        return res.json({
            success: true,
            data: {
                brand: finalData.brand,
                title: finalTitle,
                description: templatedDescription,
                title_parts: standardizedParts,
                category: normalizedCategory,
                category_name: normalizedCategory,
                categoryId: matchedTaxonomy.id || '',
                price: finalData.selling_price || finalData.price,
                originalPrice: finalData.original_price || '',
                color: finalData.color || '',
                size: finalData.size || '',
                sku: finalData.sku,
                material: (() => {
                    const allowedMaterials = [
                        'Acrylic', 'Alpaca', 'Bamboo', 'Canvas', 'Cardboard', 'Cashmere', 'Ceramic', 'Chiffon', 'Corduroy', 
                        'Cotton', 'Denim', 'Down', 'Elastane', 'Faux fur', 'Faux leather', 'Felt', 'Flannel', 'Fleece', 
                        'Foam', 'Glass', 'Gold', 'Jute', 'Lace', 'Latex', 'Leather', 'Linen', 'Merino', 'Mesh', 'Metal', 
                        'Mohair', 'Neoprene', 'Nylon', 'Paper', 'Patent leather', 'Plastic', 'Polyester', 'Porcelain', 
                        'Rattan', 'Rayon', 'Rubber', 'Satin', 'Sequin', 'Silicone', 'Silk', 'Silver', 'Steel', 'Stone', 
                        'Straw', 'Suede', 'Tulle', 'Tweed', 'Velour', 'Velvet', 'Wood', 'Wool'
                    ];
                    const matchedMaterials = [];
                    if (finalData.material) {
                        const rawMaterials = String(finalData.material).split(/[\s,]+/);
                        for (const rm of rawMaterials) {
                            const clean = rm.trim().toLowerCase();
                            const matched = allowedMaterials.find(am => am.toLowerCase() === clean);
                            if (matched && !matchedMaterials.includes(matched)) {
                                matchedMaterials.push(matched);
                            }
                        }
                    }
                    if (matchedMaterials.length === 0) {
                        const pType = String(productType || '').toLowerCase();
                        if (pType.includes('jean') || pType.includes('denim')) {
                            matchedMaterials.push('Denim');
                        } else if (pType.includes('jacket') || pType.includes('coat') || pType.includes('sweater')) {
                            matchedMaterials.push('Polyester');
                        } else {
                            matchedMaterials.push('Cotton');
                        }
                    }
                    return matchedMaterials.slice(0, 3).join(', ');
                })(),
                isbn: finalData.isbn || '',
                author: finalData.author || '',
                bookTitle: finalData.book_title || '',
                videoGameRating: finalData.video_game_rating || '',
                measurements: (() => {
                    let m = String(finalData.measurements || '').trim();
                    if (!m) {
                        const s = String(finalData.size || '').toUpperCase();
                        const pType = String(productType || '').toLowerCase();
                        if (pType.includes('shirt') || pType.includes('top') || pType.includes('hoodie') || pType.includes('sweater')) {
                            if (s.includes('S')) m = "Pit to pit: 18 in, Length: 26 in";
                            else if (s.includes('L')) m = "Pit to pit: 22 in, Length: 29 in";
                            else if (s.includes('XL')) m = "Pit to pit: 24 in, Length: 30 in";
                            else m = "Pit to pit: 20 in, Length: 27 in"; // Default Medium
                        } else if (pType.includes('jean') || pType.includes('pant') || pType.includes('trouser')) {
                            if (s.includes('S')) m = "Waist: 30 in, Inseam: 30 in";
                            else if (s.includes('L')) m = "Waist: 34 in, Inseam: 32 in";
                            else if (s.includes('XL')) m = "Waist: 36 in, Inseam: 32 in";
                            else m = "Waist: 32 in, Inseam: 30 in";
                        } else {
                            m = "Standard measurements apply";
                        }
                    }
                    return m;
                })(),
                categoryFields: {
                    brand_field_visibility: matchedTaxonomy.brand_field_visibility ?? false,
                    size_field_visibility: matchedTaxonomy.size_field_visibility ?? false,
                    color_field_visibility: matchedTaxonomy.color_field_visibility ?? false,
                    isbn_field_visibility: matchedTaxonomy.isbn_field_visibility ?? false,
                    author_field_visibility: matchedTaxonomy.author_field_visibility ?? false,
                    book_title_field_visibility: matchedTaxonomy.book_title_field_visibility ?? false,
                    video_game_rating_field_visibility: matchedTaxonomy.video_game_rating_field_visibility ?? false,
                    measurements_field_visibility: matchedTaxonomy.measurements_field_visibility ?? false
                }
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
        const matches = VINTED_TAXONOMY.filter(cat => cat.path.toLowerCase().includes(lowerQuery));

        const formatted = matches.slice(0, 20).map(cat => {
            const parts = cat.path.split(' > ');
            const name = parts[parts.length - 1];
            const path = parts.slice(0, -1).join(' > ');
            return {
                id: cat.id,
                name: name,
                path: path,
                fullName: cat.path,
                brand_field_visibility: cat.brand_field_visibility,
                size_field_visibility: cat.size_field_visibility,
                color_field_visibility: cat.color_field_visibility,
                isbn_field_visibility: cat.isbn_field_visibility,
                author_field_visibility: cat.author_field_visibility,
                book_title_field_visibility: cat.book_title_field_visibility,
                video_game_rating_field_visibility: cat.video_game_rating_field_visibility,
                measurements_field_visibility: cat.measurements_field_visibility
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('❌ Vinted Category Search Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getVintedCategoryDetails = async (req, res) => {
    try {
        const { path, id } = req.query;
        let match;
        if (id) {
            match = VINTED_TAXONOMY.find(cat => cat.id === Number(id));
        } else if (path) {
            match = VINTED_TAXONOMY.find(cat => cat.path.toLowerCase() === String(path).toLowerCase().trim());
        }
        if (!match) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        return res.json({ success: true, data: match });
    } catch (error) {
        console.error('❌ Vinted Category Details Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const DEFAULT_POPULAR_BRANDS = [
    { id: 1, title: 'Nike' },
    { id: 2, title: 'Adidas' },
    { id: 3, title: 'Zara' },
    { id: 4, title: 'H&M' },
    { id: 5, title: 'Gucci' },
    { id: 6, title: 'Levi\'s' },
    { id: 7, title: 'Ralph Lauren' },
    { id: 8, title: 'Tommy Hilfiger' },
    { id: 9, title: 'Lacoste' },
    { id: 10, title: 'Puma' },
    { id: 11, title: 'Calvin Klein' },
    { id: 12, title: 'Hugo Boss' },
    { id: 13, title: 'Prada' },
    { id: 14, title: 'Chanel' },
    { id: 15, title: 'Louis Vuitton' }
];

async function getVintedBrandsFromApi(categoryId) {
    try {
        console.log(`[Vinted API] Fetching brands for category_id: ${categoryId}`);
        // First visit Vinted to fetch cookie session
        const homeRes = await axios.get('https://www.vinted.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const cookies = homeRes.headers['set-cookie'] || [];
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        const brandsRes = await axios.get(`https://www.vinted.com/api/v2/item_upload/brands?category_id=${categoryId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader,
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        if (brandsRes.data && Array.isArray(brandsRes.data.brands)) {
            console.log(`[Vinted API] Found ${brandsRes.data.brands.length} brands`);
            return brandsRes.data.brands;
        }
        return [];
    } catch (error) {
        console.error(`[Vinted API] Error fetching brands from Vinted:`, error.message);
        return [];
    }
}

exports.getVintedBrands = async (req, res) => {
    try {
        const { category_id } = req.query;
        if (!category_id) {
            return res.json({ success: true, data: DEFAULT_POPULAR_BRANDS.map(b => ({ id: String(b.id), label: b.title })) });
        }
        
        let brands = await getVintedBrandsFromApi(category_id);
        if (!brands || brands.length === 0) {
            console.log('[Vinted API] Falling back to default popular brands list');
            brands = DEFAULT_POPULAR_BRANDS;
        }
        
        const formatted = brands.map(b => ({
            id: String(b.id),
            label: b.title
        }));
        
        return res.json({ success: true, data: formatted });
    } catch (error) {
        console.error('❌ Vinted Brands Controller Error:', error.message);
        const fallback = DEFAULT_POPULAR_BRANDS.map(b => ({ id: String(b.id), label: b.title }));
        return res.json({ success: true, data: fallback });
    }
};

const DEFAULT_VINTED_COLORS = [
    { id: 1, title: 'Black' },
    { id: 2, title: 'White' },
    { id: 3, title: 'Grey' },
    { id: 4, title: 'Red' },
    { id: 5, title: 'Blue' },
    { id: 6, title: 'Green' },
    { id: 7, title: 'Yellow' },
    { id: 8, title: 'Orange' },
    { id: 9, title: 'Pink' },
    { id: 10, title: 'Purple' },
    { id: 11, title: 'Brown' },
    { id: 12, title: 'Beige' },
    { id: 13, title: 'Gold' },
    { id: 14, title: 'Silver' },
    { id: 15, title: 'Multicolor' }
];

const DEFAULT_VINTED_SIZES = [
    { id: 1, title: 'S' },
    { id: 2, title: 'M' },
    { id: 3, title: 'L' },
    { id: 4, title: 'XL' },
    { id: 5, title: 'XXL' },
    { id: 6, title: '6' },
    { id: 7, title: '7' },
    { id: 8, title: '8' },
    { id: 9, title: '9' },
    { id: 10, title: '10' },
    { id: 11, title: '11' },
    { id: 12, title: '12' }
];

async function getVintedColorsFromApi() {
    try {
        console.log(`[Vinted API] Fetching Vinted colors`);
        const homeRes = await axios.get('https://www.vinted.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const cookies = homeRes.headers['set-cookie'] || [];
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        const colorsRes = await axios.get(`https://www.vinted.com/api/v2/item_upload/colors`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader,
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        if (colorsRes.data && Array.isArray(colorsRes.data.colors)) {
            console.log(`[Vinted API] Found ${colorsRes.data.colors.length} colors`);
            return colorsRes.data.colors;
        }
        return [];
    } catch (error) {
        console.error(`[Vinted API] Error fetching colors from Vinted:`, error.message);
        return [];
    }
}

async function getVintedSizesFromApi(catalogIds) {
    try {
        console.log(`[Vinted API] Fetching size groups for catalog_ids: ${catalogIds}`);
        const homeRes = await axios.get('https://www.vinted.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const cookies = homeRes.headers['set-cookie'] || [];
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
        
        const sizesRes = await axios.get(`https://www.vinted.com/api/v2/item_upload/size_groups?catalog_ids=${catalogIds}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Cookie': cookieHeader,
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        let sizesList = [];
        if (sizesRes.data && Array.isArray(sizesRes.data.size_groups)) {
            sizesRes.data.size_groups.forEach(sg => {
                if (Array.isArray(sg.sizes)) {
                    sg.sizes.forEach(s => {
                        sizesList.push({
                            id: s.id,
                            title: s.title || s.name
                        });
                    });
                }
            });
        }
        console.log(`[Vinted API] Extracted ${sizesList.length} sizes`);
        return sizesList;
    } catch (error) {
        console.error(`[Vinted API] Error fetching sizes from Vinted:`, error.message);
        return [];
    }
}

exports.getVintedColors = async (req, res) => {
    try {
        let colors = await getVintedColorsFromApi();
        if (!colors || colors.length === 0) {
            console.log('[Vinted API] Falling back to default popular colors list');
            colors = DEFAULT_VINTED_COLORS;
        }
        
        const formatted = colors.map(c => ({
            id: String(c.id),
            label: c.title || c.name || ''
        }));
        
        return res.json({ success: true, data: formatted });
    } catch (error) {
        console.error('❌ Vinted Colors Controller Error:', error.message);
        const fallback = DEFAULT_VINTED_COLORS.map(c => ({ id: String(c.id), label: c.title }));
        return res.json({ success: true, data: fallback });
    }
};

exports.getVintedSizes = async (req, res) => {
    try {
        const { catalog_ids } = req.query;
        if (!catalog_ids) {
            return res.json({ success: true, data: DEFAULT_VINTED_SIZES.map(s => ({ id: String(s.id), label: s.title })) });
        }
        
        let sizes = await getVintedSizesFromApi(catalog_ids);
        if (!sizes || sizes.length === 0) {
            console.log('[Vinted API] Falling back to default Vinted sizes');
            sizes = DEFAULT_VINTED_SIZES;
        }
        
        const formatted = sizes.map(s => ({
            id: String(s.id),
            label: s.title || s.name || ''
        }));
        
        return res.json({ success: true, data: formatted });
    } catch (error) {
        console.error('❌ Vinted Sizes Controller Error:', error.message);
        const fallback = DEFAULT_VINTED_SIZES.map(s => ({ id: String(s.id), label: s.title }));
        return res.json({ success: true, data: fallback });
    }
};


