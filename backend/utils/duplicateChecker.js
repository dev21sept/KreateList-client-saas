const Listing = require('../models/Listing');
const { normalizeSingleImage } = require('./imageProcessor');

async function findDuplicateListing(userId, platform, newFirstImage) {
    if (!newFirstImage) return null;

    try {
        const normalizedNewImg = await normalizeSingleImage(newFirstImage);
        if (!normalizedNewImg) return null;

        // Find listings for this user and this platform
        const listings = await Listing.find({ user: userId, platform: platform }).select('images title');

        for (const listing of listings) {
            if (listing.images && listing.images.length > 0) {
                const existingImg = listing.images[0];
                if (!existingImg) continue;

                // 1. Exact string match
                if (existingImg === normalizedNewImg) {
                    return listing;
                }

                // 2. Prefix check for base64 strings to account for minor tail padding/compression variations
                if (existingImg.startsWith('data:') && normalizedNewImg.startsWith('data:')) {
                    const len = Math.min(existingImg.length, normalizedNewImg.length);
                    const checkLen = Math.min(len, 10000);
                    if (checkLen > 500) {
                        const prefix1 = existingImg.substring(0, checkLen);
                        const prefix2 = normalizedNewImg.substring(0, checkLen);
                        if (prefix1 === prefix2) {
                            return listing;
                        }
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
