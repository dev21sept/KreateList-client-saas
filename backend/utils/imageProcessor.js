const sharp = require('sharp');

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

async function toNormalizedJpegDataUri(base64OrDataUri) {
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
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

    return `data:image/jpeg;base64,${normalized.toString('base64')}`;
}

async function normalizeSingleImage(image) {
    if (typeof image !== 'string') return null;
    const trimmed = image.trim();
    if (!trimmed) return null;

    if (isHttpUrl(trimmed)) {
        return trimmed;
    }

    if (isDataUri(trimmed) || looksLikeRawBase64(trimmed)) {
        try {
            return await toNormalizedJpegDataUri(trimmed);
        } catch (error) {
            console.warn(`[IMAGE PROCESSOR] Base64 normalization failed. Skipping image. Reason: ${error.message}`);
            return null;
        }
    }

    return null;
}

async function normalizeProductImages(images = []) {
    if (!Array.isArray(images) || images.length === 0) return [];

    const normalized = [];
    for (const image of images) {
        // Keep this sequential to avoid aggressive burst-downloads from remote hosts.
        const processed = await normalizeSingleImage(image);
        if (processed) normalized.push(processed);
    }

    return [...new Set(normalized)];
}

module.exports = {
    normalizeProductImages
};
