const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = require('../models/Listing');
  const User = require('../models/User');
  const axios = require('axios');

  const pmId = '6afa9ada7d90570886ad0fe2';
  const listing = await Listing.findOne({ poshmarkListingId: pmId }).lean();
  console.log('Listing:', listing ? { id: listing._id, poshmarkListingId: listing.poshmarkListingId, poshmarkUrl: listing.poshmarkUrl, poshmarkStatus: listing.poshmarkStatus, user: listing.user } : 'NOT FOUND');
  if (!listing) { process.exit(0); }

  const user = await User.findById(listing.user);
  console.log('Poshmark connected:', user.poshmarkAccount?.connected, '| has cookie:', !!user.poshmarkAccount?.sessionCookie);

  const { getPoshmarkHeaders, getAxiosConfig } = require('../services/backendPublishService');
  const domain = user.poshmarkAccount.domain || 'poshmark.com';
  const headers = getPoshmarkHeaders(user.poshmarkAccount.sessionCookie, user.poshmarkAccount.csrfToken);
  delete headers['origin'];
  delete headers['content-type'];

  try {
    const config = getAxiosConfig({ method: 'GET', url: `https://${domain}/vm-rest/posts/${pmId}?pm_version=2026.26.01`, headers });
    const res = await axios(config);
    console.log('Status:', res.status);
    const post = res.data?.post || res.data;
    console.log('post.status:', post?.status, '| post.listing_status:', post?.listing_status);
    console.log('post.inventory:', JSON.stringify(post?.inventory));
    console.log('post.active_item:', post?.active_item, '| post.not_for_sale:', post?.not_for_sale);
  } catch (e) {
    console.log('ERROR status:', e.response?.status, '| data:', JSON.stringify(e.response?.data)?.slice(0, 800), '| message:', e.message);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
