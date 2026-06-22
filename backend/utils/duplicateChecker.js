const Listing = require('../models/Listing');
const { normalizeProductImages } = require('./imageProcessor');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function getFileHash(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return null;
    try {
        // If it's a base64 string, hash the base64 content directly
        if (imgUrl.startsWith('data:')) {
            const raw = imgUrl.substring(imgUrl.indexOf(',') + 1);
            return crypto.createHash('md5').update(raw).digest('hex');
        }
        
        // If it's a URL, get the filename and check the local uploads folder
        const filename = path.basename(imgUrl);
        const localPath = path.join(__dirname, '..', 'uploads', filename);
        if (fs.existsSync(localPath)) {
            const fileBuffer = fs.readFileSync(localPath);
            return crypto.createHash('md5').update(fileBuffer).digest('hex');
        }
    } catch (err) {
        console.error('[Duplicate Checker] Error hashing file:', err);
    }
    return null;
}

async function findDuplicateListing(userId, platform, newFirstImage, title = '') {
    if (!newFirstImage && !title) return null;

    try {
        let normalizedNewImg = null;
        if (newFirstImage) {
            const normalizedArr = await normalizeProductImages([newFirstImage]);
            if (normalizedArr.length > 0) {
                normalizedNewImg = normalizedArr[0];
            }
        }

        const newHash = normalizedNewImg ? getFileHash(normalizedNewImg) : null;
        const cleanTitle = title ? String(title).trim().toLowerCase() : '';

        // Find listings for this user and this platform
        const listings = await Listing.find({ user: userId, platform: platform }).select('images title');

        for (const listing of listings) {
            // 1. Check title match if title is provided
            if (cleanTitle && listing.title) {
                const existingTitle = String(listing.title).trim().toLowerCase();
                if (existingTitle === cleanTitle) {
                    return listing;
                }
            }

            // 2. Check image match if image is provided
            if (newFirstImage && listing.images && listing.images.length > 0) {
                const existingImg = listing.images[0];
                if (!existingImg) continue;

                // Exact string match of URL
                if (normalizedNewImg && existingImg === normalizedNewImg) {
                    return listing;
                }

                // File hash match
                if (newHash) {
                    const existingHash = getFileHash(existingImg);
                    if (existingHash && existingHash === newHash) {
                        return listing;
                    }
                }
            }
        }
    } catch (err) {
        console.error('[Duplicate Checker Error]', err);
    }

    return null;
}

module.exports = {
    findDuplicateListing
};
