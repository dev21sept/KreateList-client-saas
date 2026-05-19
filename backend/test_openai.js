require('dotenv').config();
const OpenAI = require('openai');
const sharp = require('sharp');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runTest() {
    try {
        console.log("Creating dummy 100x100 image buffer...");
        const buffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        }).jpeg().toBuffer();

        const base64Str = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        console.log("Calling OpenAI GPT-4o...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Identify the color of this image."
                        },
                        {
                            type: "image_url",
                            image_url: { url: base64Str }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        console.log("Response:", response.choices[0].message.content);
    } catch (err) {
        console.error("OpenAI API Error details:", err);
    }
}

runTest();
