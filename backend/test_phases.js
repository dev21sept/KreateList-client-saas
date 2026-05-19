require('dotenv').config();
const OpenAI = require('openai');
const sharp = require('sharp');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runTest() {
    try {
        console.log("Creating dummy image...");
        const buffer = await sharp({
            create: {
                width: 400,
                height: 400,
                channels: 3,
                background: { r: 100, g: 150, b: 200 }
            }
        }).jpeg().toBuffer();

        const base64Str = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        const imageContent = [{
            type: "image_url",
            image_url: { url: base64Str }
        }];

        // Phase 1 Simulation
        console.log("Running Phase 1...");
        const categoryResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are an expert in marketplace categorization for ebay. Your goal is to identify the deepest, most accurate leaf-category for ANY type of product.`
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
        console.log("Phase 1 Result:", categoryResult);

        // Phase 3 Simulation
        console.log("Running Phase 3...");
        const mainResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `You are a world-class ebay listing expert. You strictly follow instructions.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze images for a professional ebay listing.
                            
1. Visual Research & Title Construction:
   - Identify the EXACT retail name of this product.
   - Look for keywords like "Vintage", "Rare", "Authentic".
   - Extract these precise attributes for the Title Sequence: [Brand, Product Type, Model / Series, Material, Key Features, Size]
   
   CRITICAL RULES:
   - GOAL: A professional, keyword-rich title between 70-80 characters.
   - NO BLANKS: Fill every requested attribute.
   - Output as a JSON object inside 'title_parts'.
   
2. Description Construction - HIGH-CONVERSION & PERSUASIVE (Detailed & Lengthy):
   - Analyze the item to write a professional summary.
   - Use HTML <b> for section headers and <br><br> for spacing.
   - Include these sections:
     - <b>The Ultimate Look / Perfect Upgrade:</b> {Engaging hook about the item}.<br><br>
     - <b>About the Brand:</b> {Quality/Heritage info about the brand}.<br><br>
     - <b>Key Features & Design:</b> {Detailed bullet points for material, durability, and standout design elements}.<br><br>
     - <b>Versatility / Usage:</b> {Styling tips or functional use cases}.<br><br>
     - <b>Condition Report:</b> Pre-owned. <br><br>
   - Custom Instruction: "Generate a professional eBay listing description."
   
3. Item Specifics - FILL EVERY FIELD: Brand, Type, Size, Color, Material, Condition, Style, Department. 
    
4. Pricing: Estimate a realistic 'selling_price' in USD.

Context: Gender: Unisex, Category: Clothing.

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

        console.log("Phase 3 Raw content:", mainResponse.choices[0].message.content);
        const finalData = JSON.parse(mainResponse.choices[0].message.content);
        console.log("Phase 3 Success:", finalData);
    } catch (err) {
        console.error("Error during execution:", err);
    }
}

runTest();
