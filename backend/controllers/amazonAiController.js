const OpenAI = require('openai');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const User = require('../models/User');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AMAZON_PRODUCT_TYPES = [
  { id: 'SHIRT', name: 'Shirts & Tops', category: 'Clothing, Shoes & Jewelry > Men / Women > Tops' },
  { id: 'PANTS', name: 'Pants & Trousers', category: 'Clothing, Shoes & Jewelry > Bottoms > Pants' },
  { id: 'DRESS', name: 'Dresses', category: 'Clothing, Shoes & Jewelry > Women > Dresses' },
  { id: 'SHOES', name: 'Shoes & Footwear', category: 'Clothing, Shoes & Jewelry > Shoes' },
  { id: 'OUTERWEAR', name: 'Jackets & Coats', category: 'Clothing, Shoes & Jewelry > Outerwear' },
  { id: 'SWEATER', name: 'Sweaters & Cardigans', category: 'Clothing, Shoes & Jewelry > Sweaters' },
  { id: 'SHORTS', name: 'Shorts', category: 'Clothing, Shoes & Jewelry > Bottoms > Shorts' },
  { id: 'SKIRT', name: 'Skirts', category: 'Clothing, Shoes & Jewelry > Women > Skirts' },
  { id: 'SWIMWEAR', name: 'Swimwear', category: 'Clothing, Shoes & Jewelry > Swim' },
  { id: 'UNDERWEAR', name: 'Underwear & Socks', category: 'Clothing, Shoes & Jewelry > Underwear' },
  { id: 'HANDBAG', name: 'Handbags & Purses', category: 'Clothing, Shoes & Jewelry > Handbags & Wallets' },
  { id: 'JEWELRY', name: 'Jewelry & Accessories', category: 'Clothing, Shoes & Jewelry > Accessories > Jewelry' },
  { id: 'WATCH', name: 'Watches', category: 'Clothing, Shoes & Jewelry > Watches' },
  { id: 'HOME', name: 'Home & Kitchen', category: 'Home & Kitchen' },
  { id: 'BEAUTY', name: 'Beauty & Personal Care', category: 'Beauty & Personal Care' },
  { id: 'HEALTH_PERSONAL_CARE', name: 'Health & Household', category: 'Health & Household' },
  { id: 'TOYS_AND_GAMES', name: 'Toys & Games', category: 'Toys & Games' },
  { id: 'SPORTING_GOODS', name: 'Sports & Outdoors', category: 'Sports & Outdoors' },
  { id: 'ELECTRONICS', name: 'Consumer Electronics', category: 'Electronics' },
  { id: 'CELLULAR_PHONE_CASE', name: 'Cell Phone Cases & Accessories', category: 'Cell Phones & Accessories' },
  { id: 'HEADPHONES', name: 'Headphones & Audio', category: 'Electronics > Headphones' },
  { id: 'BOOK', name: 'Books', category: 'Books' },
  { id: 'VIDEO_GAMES', name: 'Video Games & Consoles', category: 'Video Games' },
  { id: 'PET_SUPPLIES', name: 'Pet Supplies', category: 'Pet Supplies' },
  { id: 'OFFICE_PRODUCTS', name: 'Office Products', category: 'Office Products' },
  { id: 'TOOLS', name: 'Tools & Home Improvement', category: 'Tools & Home Improvement' },
  { id: 'AUTOMOTIVE', name: 'Automotive Parts & Accessories', category: 'Automotive' },
  { id: 'PRODUCT', name: 'General Product', category: 'Everything Else' }
];

/**
 * AI Listing Analyzer specifically tuned for Amazon SP-API guidelines
 */
exports.amazonAnalyzeListing = async (req, res) => {
  try {
    const { 
      images = [], 
      existingTitle = '', 
      existingDescription = '', 
      brand: inputBrand = '', 
      price: inputPrice = '', 
      category: inputCategory = '',
      condition: inputCondition = '',
      color: inputColor = '',
      size: inputSize = '',
      sku: inputSku = ''
    } = req.body;

    // Build user description or image payload
    const imageContents = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images.slice(0, 4)) {
        if (typeof img === 'string' && img.startsWith('data:image')) {
          imageContents.push({
            type: 'image_url',
            image_url: { url: img, detail: 'high' }
          });
        } else if (typeof img === 'string' && img.startsWith('http')) {
          imageContents.push({
            type: 'image_url',
            image_url: { url: img, detail: 'high' }
          });
        }
      }
    }

    const contextInfo = `
Existing/Provided Details:
- Title: ${existingTitle || 'None'}
- Brand: ${inputBrand || 'None'}
- Category/Type: ${inputCategory || 'None'}
- Price: ${inputPrice || 'None'}
- Condition: ${inputCondition || 'None'}
- Color: ${inputColor || 'None'}
- Size: ${inputSize || 'None'}
- Description: ${existingDescription || 'None'}
`;

    const systemPrompt = `You are an elite Amazon SP-API Catalog Specialist and Copywriter.
Your goal is to inspect the product images and details, and generate a fully optimized, high-converting, policy-compliant Amazon Product Listing JSON.

STRICT AMAZON LISTING RULES:
1. TITLE:
   - Format: [Brand] + [Model/Line/Style] + [Key Product Feature / Material] + [Product Type] + [Color] + [Size/Pack]
   - Keep length between 80 and 150 characters (max 200 characters).
   - Capitalize the first letter of each major word.
   - DO NOT include promotional phrases (e.g. "Free Shipping", "Best Seller", "100% Quality Guaranteed", "Sale", "Discount").
   - DO NOT use emojis or special symbol spam (e.g., ***, !!!, ~~~).

2. BULLET POINTS (Key Product Features):
   - You MUST generate EXACTLY 5 high-converting bullet points.
   - Format each bullet point with an uppercase benefit header in brackets, followed by a detailed description.
   - Example Headers:
     • [PREMIUM QUALITY MATERIAL] - ...
     • [ERGONOMIC & COMFORT FIT] - ...
     • [INNOVATIVE DESIGN & FEATURES] - ...
     • [VERSATILE OCCASIONS & STYLING] - ...
     • [CARE INSTRUCTIONS & SPECIFICATIONS] - ...
   - Keep each bullet point concise, persuasive, and under 250 characters.

3. DESCRIPTION:
   - Provide a clean, persuasive 2-3 paragraph product overview explaining benefits, craftsmanship, and specifications.

4. GENERIC KEYWORDS (Backend Search Terms):
   - Provide 5 to 8 relevant, high-search-volume keywords/phrases (no brand names or competitor names, no punctuation).

5. PRODUCT TYPE:
   - Match with one of these Amazon Product Types: SHIRT, PANTS, DRESS, SHOES, OUTERWEAR, SWEATER, SHORTS, SKIRT, SWIMWEAR, HANDBAG, JEWELRY, WATCH, HOME, BEAUTY, TOYS_AND_GAMES, SPORTING_GOODS, ELECTRONICS, BOOK, PRODUCT.

6. CONDITION:
   - Must be one of: "New", "Used - Like New", "Used - Very Good", "Used - Good", "Used - Acceptable".

7. JSON OUTPUT ONLY:
Return a valid JSON object with EXACTLY these keys:
{
  "title": string,
  "bulletPoints": [string, string, string, string, string],
  "description": string,
  "genericKeywords": [string],
  "productType": string,
  "category": string,
  "brand": string,
  "color": string,
  "size": string,
  "condition": string,
  "price": string,
  "sku": string
}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Please analyze this product and create an Amazon listing.\n${contextInfo}` },
          ...imageContents
        ]
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1500
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');

    // Ensure 5 bullets
    let bullets = Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints : [];
    if (bullets.length < 5) {
      const fallbacks = [
        '[DURABLE QUALITY CRAFTSMANSHIP] - Built to last with premium materials for dependable everyday performance.',
        '[COMFORTABLE EVERYDAY FIT] - Tailored for maximum ease and versatile comfort throughout the day.',
        '[TIMELESS MODERN STYLE] - Designed with clean aesthetics suitable for various occasions and settings.',
        '[PREMIUM FINISH & DETAILS] - Featuring refined stitching and high-standard finishing touches.',
        '[EASY MAINTENANCE] - Simple to clean and maintain for long-lasting freshness.'
      ];
      while (bullets.length < 5) {
        bullets.push(fallbacks[bullets.length]);
      }
    }

    const result = {
      title: parsed.title || existingTitle || 'Amazon Product Listing',
      bulletPoints: bullets.slice(0, 5),
      description: parsed.description || existingDescription || '',
      genericKeywords: Array.isArray(parsed.genericKeywords) ? parsed.genericKeywords : [],
      productType: parsed.productType || 'PRODUCT',
      category: parsed.category || 'Clothing, Shoes & Jewelry',
      brand: parsed.brand || inputBrand || 'Generic',
      color: parsed.color || inputColor || '',
      size: parsed.size || inputSize || '',
      condition: parsed.condition || inputCondition || 'New',
      price: parsed.price ? String(parsed.price).replace(/[^0-9.]/g, '') : (inputPrice || '29.99'),
      sku: parsed.sku || inputSku || `AMZ-${Date.now().toString().slice(-6)}`
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Amazon AI Controller] Analyze error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze Amazon listing.'
    });
  }
};

/**
 * Search Amazon categories and product types
 */
exports.searchAmazonCategories = async (req, res) => {
  try {
    const q = (req.query.q || req.query.query || '').toLowerCase().trim();
    if (!q) {
      return res.status(200).json({ success: true, results: AMAZON_PRODUCT_TYPES });
    }

    const filtered = AMAZON_PRODUCT_TYPES.filter(pt =>
      pt.id.toLowerCase().includes(q) ||
      pt.name.toLowerCase().includes(q) ||
      pt.category.toLowerCase().includes(q)
    );

    res.status(200).json({
      success: true,
      results: filtered.length > 0 ? filtered : [
        { id: 'PRODUCT', name: `Custom: ${q}`, category: `General Products > ${q}` }
      ]
    });
  } catch (error) {
    console.error('[Amazon AI Controller] searchAmazonCategories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
