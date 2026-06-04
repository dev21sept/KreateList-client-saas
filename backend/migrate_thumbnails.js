/**
 * One-time migration: Generate thumbnails for all existing listings.
 * Run with: node migrate_thumbnails.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Listing = require('./models/Listing');
const { generateThumbnail } = require('./utils/imageProcessor');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const listings = await Listing.find({ thumbnail: { $in: [null, '', undefined] } })
    .select('_id images title');
  
  console.log(`Found ${listings.length} listings without thumbnails`);

  let updated = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      if (listing.images && listing.images.length > 0) {
        const thumb = await generateThumbnail(listing.images[0]);
        if (thumb) {
          await Listing.updateOne({ _id: listing._id }, { $set: { thumbnail: thumb } });
          updated++;
          console.log(`[${updated}/${listings.length}] ✓ ${listing.title?.substring(0, 50)}`);
        } else {
          console.log(`[SKIP] No valid image for: ${listing.title?.substring(0, 50)}`);
        }
      } else {
        console.log(`[SKIP] No images: ${listing.title?.substring(0, 50)}`);
      }
    } catch (err) {
      failed++;
      console.error(`[FAIL] ${listing.title?.substring(0, 50)}: ${err.message}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}, Skipped: ${listings.length - updated - failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
