const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const isSyntheticSku = (str) => {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim();
  if (s === '' || s === '-') return true;
  const parts = s.split(/[\s|,\/]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every(part =>
    /^(EBAY|POSH|POSHMARK|MERCARI|ETSY|AMAZON|M|P|E)-[a-zA-Z0-9_\-]+$/i.test(part) ||
    /^[0-9]{11,14}$/.test(part) ||
    /^[a-f0-9]{24}$/i.test(part) ||
    /^m[0-9]{10,12}$/i.test(part)
  );
};

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Listing = mongoose.models.Listing || mongoose.model('Listing', new mongoose.Schema({}, { strict: false }));
  const listings = await Listing.find({}).lean();
  console.log('Total listings in DB:', listings.length);

  let updatedCount = 0;
  for (const item of listings) {
    const rawSku = item.sku || '';
    let needsUpdate = false;
    const updateFields = {};

    // Extract live IDs from rawSku if missing on document
    const ebayMatch = rawSku.match(/EBAY-([0-9]+)/i);
    if (ebayMatch && !item.ebayListingId) {
      updateFields.ebayListingId = ebayMatch[1];
      if (!item.ebayUrl) updateFields.ebayUrl = `https://www.ebay.com/itm/${ebayMatch[1]}`;
      needsUpdate = true;
    }

    const poshMatch = rawSku.match(/P-([a-f0-9]{24})/i);
    if (poshMatch && !item.poshmarkListingId) {
      updateFields.poshmarkListingId = poshMatch[1];
      needsUpdate = true;
    }

    const mercMatch = rawSku.match(/M-(m[0-9]+)/i);
    if (mercMatch && !item.mercariListingId) {
      updateFields.mercariListingId = mercMatch[1];
      if (!item.mercariUrl) updateFields.mercariUrl = `https://www.mercari.com/item/${mercMatch[1]}/`;
      needsUpdate = true;
    }

    const etsyMatch = rawSku.match(/ETSY-([0-9]+)/i);
    if (etsyMatch && !item.etsyListingId) {
      updateFields.etsyListingId = etsyMatch[1];
      needsUpdate = true;
    }

    // Clean SKU if it is synthetic
    if (isSyntheticSku(rawSku)) {
      if (rawSku !== '') {
        updateFields.sku = '';
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await Listing.updateOne({ _id: item._id }, { $set: updateFields });
      updatedCount++;
    }
  }

  console.log(`Cleaned up ${updatedCount} listings successfully.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Error cleaning SKUs:', err);
  process.exit(1);
});
