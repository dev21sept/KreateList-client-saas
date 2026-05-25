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
    return (
        value.length > 2000 &&
        /^[a-z0-9+/=\r\n]+$/i.test(value)
    );
}

async function saveBase64ImageToDisk(base64OrDataUri, baseUrl) {
    const trimmed = String(base64OrDataUri || '').trim();
    const dataUriMatch = trimmed.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    let rawBase64 = dataUriMatch ? dataUriMatch[2] : trimmed;
    rawBase64 = rawBase64.replace(/[\r\n\t\s]+/g, '');

    if (!/^[a-z0-9+/=]+$/i.test(rawBase64)) {
        throw new Error('Invalid Base64 image data');
    }

    const inputBuffer = Buffer.from(rawBase64, 'base64');
    if (!inputBuffer.length) {
        throw new Error('Decoded image buffer is empty');
    }

    const normalized = await sharp(inputBuffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

    const filename = `img_${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
    
    // Resolve upload dir path (backend/uploads)
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, normalized);

    return `${baseUrl}/uploads/${filename}`;
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
            return await saveBase64ImageToDisk(trimmed, baseUrl);
        } catch (error) {
            console.warn(`[IMAGE PROCESSOR] Base64 normalization failed. Skipping image. Reason: ${error.message}`);
            return null;
        }
    }

    return null;
}

async function normalizeProductImages(images = [], baseUrl) {
    if (!Array.isArray(images) || images.length === 0) return [];

    const normalized = [];
    for (const image of images) {
        // Keep this sequential to avoid aggressive burst-downloads from remote hosts.
        const processed = await normalizeSingleImage(image, baseUrl);
        if (processed) normalized.push(processed);
    }

    return [...new Set(normalized)];
}

module.exports = {
    normalizeProductImages
};
