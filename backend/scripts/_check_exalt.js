const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = require('../models/Listing');
  const { scorePair, titleOverlap, hammingDistance } = require('../services/mergeMatcher');

  const listings = await Listing.find({ title: /Exalt Alpha Chest Protector/i, mergedInto: null }).lean();
  console.log('Found', listings.length, 'listings');
  listings.forEach(l => console.log('\n', l._id, {
    title: l.title, brand: l.brand, size: l.size, price: l.price,
    ebayListingId: l.ebayListingId, poshmarkListingId: l.poshmarkListingId, mercariListingId: l.mercariListingId,
    ebayStatus: l.ebayStatus, poshmarkStatus: l.poshmarkStatus, mercariStatus: l.mercariStatus,
    hasHash: !!l.imageHash, hashLen: l.imageHash?.length, images: l.images?.slice(0,1), thumbnail: l.thumbnail
  }));

  if (listings.length >= 2) {
    const [a, b] = listings;
    console.log('\ntitleOverlap:', titleOverlap(a.title, b.title));
    console.log('hammingDistance:', hammingDistance(a.imageHash, b.imageHash));
    const platA = ['ebay','poshmark','mercari','etsy'].filter(p => a[`${p}ListingId`]);
    const platB = ['ebay','poshmark','mercari','etsy'].filter(p => b[`${p}ListingId`]);
    const recA = { id: 'a', platform: platA[0], platforms: platA, title: a.title, brand: a.brand, size: a.size, price: a.price, imageHash: a.imageHash };
    const recB = { id: 'b', platform: platB[0], platforms: platB, title: b.title, brand: b.brand, size: b.size, price: b.price, imageHash: b.imageHash };
    console.log('scorePair (titleUniquePair=true):', scorePair(recA, recB, { titleUniquePair: true }));
    console.log('scorePair (titleUniquePair=false):', scorePair(recA, recB, { titleUniquePair: false }));
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
