const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}

function isDataUri(value) {
    return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

function looksLikeRawBase64(value) {
    if (typeof value !== 'string') return false;
    if (value.length < 100) return false;
    return !/^https?:\/\//i.test(value);
}

function extractRawBase64(trimmed) {
    const commaIndex = trimmed.indexOf(';base64,');
    if (commaIndex !== -1) {
        return trimmed.substring(commaIndex + 8);
    }
    if (trimmed.startsWith('data:')) {
        const firstComma = trimmed.indexOf(',');
        if (firstComma !== -1) {
            return trimmed.substring(firstComma + 1);
        }
    }
    return trimmed;
}

/**
 * Saves a base64 image string as a physical file on the server's disk
 * in the 'uploads' folder, and returns its public absolute URL.
 */
async function saveBase64ImageToDisk(base64OrDataUri, baseUrl) {
    const trimmed = String(base64OrDataUri || '').trim();
    const rawBase64 = extractRawBase64(trimmed);

    const inputBuffer = Buffer.from(rawBase64, 'base64');
    if (!inputBuffer.length) {
        throw new Error('Decoded image buffer is empty');
    }

    // Generate unique file name
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);

    // Normalize and save to disk using sharp
    await sharp(inputBuffer)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(filePath);

    // Return absolute public URL
    const cleanBaseUrl = String(baseUrl || '').replace(/\/$/, '');
    return `${cleanBaseUrl}/uploads/${filename}`;
}

async function normalizeSingleImage(image, baseUrl) {
    if (typeof image !== 'string') return null;
    const trimmed = image.trim();
    if (!trimmed) return null;

    if (isHttpUrl(trimmed)) {
        return trimmed;
    }

    if (isDataUri(trimmed) || looksLikeRawBase64(trimmed)) {
        try {
            // Save to disk and return public URL link instead of base64 DataURI
            return await saveBase64ImageToDisk(trimmed, baseUrl);
        } catch (error) {
            console.warn(`[IMAGE PROCESSOR] Base64 save to disk failed. Skipping image. Reason: ${error.message}`);
            return null;
        }
    }

    return null;
}

async function normalizeProductImages(images = [], baseUrl) {
    if (!Array.isArray(images) || images.length === 0) return [];

    const normalized = [];
    for (const image of images) {
        const processed = await normalizeSingleImage(image, baseUrl);
        if (processed) normalized.push(processed);
    }

    return [...new Set(normalized)];
}

async function generateThumbnail(image) {
    if (typeof image !== 'string') return null;
    const trimmed = image.trim();
    if (!trimmed) return null;

    if (isHttpUrl(trimmed)) {
        return trimmed;
    }

    if (isDataUri(trimmed) || looksLikeRawBase64(trimmed)) {
        try {
            const rawBase64 = extractRawBase64(trimmed);

            const inputBuffer = Buffer.from(rawBase64, 'base64');
            if (!inputBuffer.length) {
                return null;
            }

            const thumbnailBuffer = await sharp(inputBuffer)
                .rotate()
                .resize({ width: 150, height: 150, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 50, mozjpeg: true })
                .toBuffer();

            return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
        } catch (error) {
            console.warn(`[IMAGE PROCESSOR] Thumbnail generation failed. Reason: ${error.message}`);
            return null;
        }
    }

    return null;
}

module.exports = {
    normalizeProductImages,
    generateThumbnail
};
