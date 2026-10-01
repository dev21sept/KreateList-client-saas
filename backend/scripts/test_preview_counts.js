const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const User = require('../models/User');
  const listingController = require('../controllers/listingController');

  const user = await User.findOne({ email: /ramayali/i }).lean();
  const userId = user._id;

  const req = { user: { id: userId.toString() }, query: {} };
  let jsonResult = null;
  const res = {
    status: () => ({
      json: (data) => { jsonResult = data; }
    }),
    json: (data) => { jsonResult = data; }
  };

  await listingController.getActiveChannelImportPreview(req, res);

  console.log('=== getActiveChannelImportPreview Breakdown ===');
  console.log('Total Active Products:', jsonResult?.totalActiveProducts);
  console.log('Grouped Count (Unique Masters):', jsonResult?.groupedCount);
  console.log('Breakdown:', jsonResult?.breakdown);

  const groups = jsonResult?.groups || [];
  let ebayInGroups = 0;
  let poshInGroups = 0;
  let mercInGroups = 0;

  groups.forEach(g => {
    if (g.channels?.ebay) ebayInGroups++;
    if (g.channels?.poshmark) poshInGroups++;
    if (g.channels?.mercari) mercInGroups++;
  });

  console.log(`\nChannels mapped into groups:`);
  console.log(`eBay in groups: ${ebayInGroups}`);
  console.log(`Poshmark in groups: ${poshInGroups}`);
  console.log(`Mercari in groups: ${mercInGroups}`);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
