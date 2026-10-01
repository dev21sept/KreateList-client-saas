const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const userId = user._id;
  const username = user.poshmarkAccount?.username || 'ramayali';
  const cookie = user.poshmarkAccount?.sessionCookie || '';
  const csrf = user.poshmarkAccount?.csrfToken || '';

  console.log(`Starting Poshmark cover photo resync for @${username}...`);

  const allPosts = [];
  let maxId = null;
  let hasMore = true;
  let page = 1;

  while (hasMore) {
    let apiUrl = `https://poshmark.com/vm-rest/users/${username}/posts?request_context=closet&count=48`;
    if (maxId) {
      apiUrl += `&max_id=${maxId}`;
    }

    console.log(`Fetching Poshmark page ${page}...`);
    const apiResponse = await axios.get(apiUrl, {
      headers: {
        'cookie': cookie,
        'x-csrf-token': csrf || '',
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });

    const posts = apiResponse.data?.data || [];
    if (posts.length > 0) {
      allPosts.push(...posts);
    }

    const more = apiResponse.data?.more;
    if (more && more.next_max_id && posts.length > 0) {
      maxId = more.next_max_id;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allPosts.length} total posts from Poshmark API.`);

  let updatedProducts = 0;
  let updatedListings = 0;

  for (const post of allPosts) {
    let coverUrl = '';
    if (post.cover_shot && post.cover_shot.url) {
      coverUrl = post.cover_shot.url;
    } else if (post.pictures && post.pictures.length > 0) {
      coverUrl = post.pictures[0].url || post.pictures[0].src || '';
    }

    let imgUrls = [];
    if (coverUrl) imgUrls.push(coverUrl);
    if (post.pictures && Array.isArray(post.pictures)) {
      post.pictures.forEach(p => {
        const u = p.url || p.src || (typeof p === 'string' ? p : '');
        if (u && !imgUrls.includes(u)) {
          imgUrls.push(u);
        }
      });
    }
    if (imgUrls.length === 0 && coverUrl) {
      imgUrls = [coverUrl];
    }

    if (!coverUrl && imgUrls.length === 0) continue;

    // 1. Update Product
    const pRes = await Product.updateMany(
      { user: userId, source: 'poshmark', poshmarkListingId: post.id },
      {
        $set: {
          thumbnail: coverUrl || imgUrls[0],
          images: imgUrls,
          updated_at: Date.now()
        }
      }
    );
    if (pRes.modifiedCount > 0) {
      updatedProducts += pRes.modifiedCount;
    }

    // 2. Update Listing platformData.poshmark
    const lRes = await Listing.updateMany(
      { user: userId, poshmarkListingId: post.id },
      {
        $set: {
          'platformData.poshmark.thumbnail': coverUrl || imgUrls[0],
          'platformData.poshmark.images': imgUrls
        }
      }
    );
    if (lRes.modifiedCount > 0) {
      updatedListings += lRes.modifiedCount;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Updated Product documents: ${updatedProducts}`);
  console.log(`Updated Listing documents: ${updatedListings}`);

  // Verification on key items: APFU, Oak Hill, American Apparel, Tommy Hilfiger
  const checkItems = await Product.find({
    user: userId,
    source: 'poshmark',
    title: /APFU|Oak Hill|American Apparel|Tommy Hilfiger/i
  }).limit(4).lean();

  console.log('\n=== Verified Poshmark Products After Fix ===');
  checkItems.forEach(item => {
    console.log('Title:', item.title);
    console.log('Thumbnail:', item.thumbnail);
    console.log('Images[0]:', item.images?.[0]);
    console.log('---');
  });

  process.exit(0);
}

run().catch(e => {
  console.error('Resync error:', e);
  process.exit(1);
});
