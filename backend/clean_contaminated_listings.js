const mongoose = require('mongoose');
const { isStrictMatch, extractGarmentType, extractGender } = require('./utils/listingMatcher');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Listing = mongoose.model('Listing', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  const users = await User.find({}).lean();
  console.log(`Starting thorough cleanup across ${users.length} users...`);

  for (const user of users) {
    const userId = user._id;
    console.log(`\n======================================================`);
    console.log(`Processing User: ${user.email} (${userId})`);

    const [listings, products] = await Promise.all([
      Listing.find({ user: userId }).lean(),
      Product.find({ user: userId, status: { $in: ['active', 'live', 'published'] } }).lean()
    ]);

    console.log(`Found ${listings.length} listings, ${products.length} active channel products.`);

    const ebayProductMap = new Map();
    const poshProductMap = new Map();
    const mercariProductMap = new Map();
    const etsyProductMap = new Map();

    for (const p of products) {
      const src = p.source || p.platform;
      if (src === 'ebay' && (p.ebayListingId || p.itemId || p.liveListingId)) {
        ebayProductMap.set(String(p.ebayListingId || p.itemId || p.liveListingId), p);
      } else if (src === 'poshmark' && p.poshmarkListingId) {
        poshProductMap.set(String(p.poshmarkListingId), p);
      } else if (src === 'mercari' && p.mercariListingId) {
        mercariProductMap.set(String(p.mercariListingId), p);
      } else if (src === 'etsy' && p.etsyListingId) {
        etsyProductMap.set(String(p.etsyListingId), p);
      }
    }

    let unlinkedCount = 0;
    let cleanedImageCount = 0;

    for (const listing of listings) {
      const setFields = {};
      const unsetFields = {};
      let modified = false;

      // 1. eBay verification
      let ebayProd = null;
      if (listing.ebayListingId) {
        ebayProd = ebayProductMap.get(String(listing.ebayListingId));
      }

      // 2. Poshmark verification
      let poshProd = null;
      if (listing.poshmarkListingId) {
        poshProd = poshProductMap.get(String(listing.poshmarkListingId));
        if (poshProd) {
          const isMatch = isStrictMatch(listing, poshProd, 0.60);
          if (!isMatch) {
            console.log(`[Unlinking Poshmark Mismatch] Listing: "${listing.title}" != Poshmark: "${poshProd.title}"`);
            unsetFields['poshmarkListingId'] = 1;
            unsetFields['poshmarkUrl'] = 1;
            unsetFields['poshmarkPrice'] = 1;
            unsetFields['platformData.poshmark'] = 1;
            unsetFields['platforms.poshmark'] = 1;
            unsetFields['crosslistingDetails.poshmark'] = 1;
            setFields['poshmarkStatus'] = 'none';
            poshProd = null;
            unlinkedCount++;
            modified = true;
          }
        }
      }

      // 3. Mercari verification
      let mercProd = null;
      if (listing.mercariListingId) {
        mercProd = mercariProductMap.get(String(listing.mercariListingId));
        if (mercProd) {
          const isMatch = isStrictMatch(listing, mercProd, 0.60);
          if (!isMatch) {
            console.log(`[Unlinking Mercari Mismatch] Listing: "${listing.title}" != Mercari: "${mercProd.title}"`);
            unsetFields['mercariListingId'] = 1;
            unsetFields['mercariUrl'] = 1;
            unsetFields['mercariPrice'] = 1;
            unsetFields['platformData.mercari'] = 1;
            unsetFields['platforms.mercari'] = 1;
            unsetFields['crosslistingDetails.mercari'] = 1;
            setFields['mercariStatus'] = 'none';
            mercProd = null;
            unlinkedCount++;
            modified = true;
          }
        }
      }

      // 4. Etsy verification
      let etsyProd = null;
      if (listing.etsyListingId) {
        etsyProd = etsyProductMap.get(String(listing.etsyListingId));
        if (etsyProd) {
          const isMatch = isStrictMatch(listing, etsyProd, 0.60);
          if (!isMatch) {
            console.log(`[Unlinking Etsy Mismatch] Listing: "${listing.title}" != Etsy: "${etsyProd.title}"`);
            unsetFields['etsyListingId'] = 1;
            unsetFields['etsyUrl'] = 1;
            unsetFields['platformData.etsy'] = 1;
            unsetFields['platforms.etsy'] = 1;
            unsetFields['crosslistingDetails.etsy'] = 1;
            setFields['etsyStatus'] = 'none';
            etsyProd = null;
            unlinkedCount++;
            modified = true;
          }
        }
      }

      // 5. Clean up Listing Images to ONLY contain verified photos
      const verifiedImages = [];
      const seenUrls = new Set();

      const addImages = (imgs) => {
        if (!Array.isArray(imgs)) return;
        for (const img of imgs) {
          const url = typeof img === 'string' ? img : img?.url || '';
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            verifiedImages.push(url);
          }
        }
      };

      if (ebayProd?.images?.length > 0) addImages(ebayProd.images);
      if (poshProd?.images?.length > 0) addImages(poshProd.images);
      if (mercProd?.images?.length > 0) addImages(mercProd.images);
      if (etsyProd?.images?.length > 0) addImages(etsyProd.images);

      if (verifiedImages.length > 0) {
        const currentLen = listing.images?.length || 0;
        const needsImgUpdate = currentLen !== verifiedImages.length || !listing.images.every((img, idx) => img === verifiedImages[idx]);
        if (needsImgUpdate) {
          setFields['images'] = verifiedImages;
          setFields['thumbnail'] = verifiedImages[0] || '';
          cleanedImageCount++;
          modified = true;
        }
      }

      // 6. Clean platformData
      if (ebayProd) {
        setFields['platformData.ebay'] = {
          thumbnail: ebayProd.images?.[0] || ebayProd.thumbnail || '',
          images: ebayProd.images || [],
          price: listing.ebayPrice || ebayProd.selling_price || listing.price,
          url: listing.ebayUrl || ebayProd.ebayUrl || ''
        };
        modified = true;
      }
      if (poshProd) {
        setFields['platformData.poshmark'] = {
          thumbnail: poshProd.images?.[0] || poshProd.thumbnail || '',
          images: poshProd.images || [],
          price: listing.poshmarkPrice || poshProd.selling_price || listing.price,
          url: listing.poshmarkUrl || poshProd.poshmarkUrl || ''
        };
        modified = true;
      }
      if (mercProd) {
        setFields['platformData.mercari'] = {
          thumbnail: mercProd.images?.[0] || mercProd.thumbnail || '',
          images: mercProd.images || [],
          price: listing.mercariPrice || mercProd.selling_price || listing.price,
          url: listing.mercariUrl || mercProd.mercariUrl || ''
        };
        modified = true;
      }

      if (modified) {
        const updateDoc = {};
        if (Object.keys(setFields).length > 0) updateDoc['$set'] = setFields;
        if (Object.keys(unsetFields).length > 0) updateDoc['$unset'] = unsetFields;

        await Listing.updateOne({ _id: listing._id }, updateDoc);
      }
    }

    console.log(`User ${user.email} summary: Unlinked Mismatches: ${unlinkedCount}, Cleaned Image Listings: ${cleanedImageCount}`);
  }

  console.log('\nAll users database cleanup completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error('[Cleanup Error]', err);
  process.exit(1);
});
