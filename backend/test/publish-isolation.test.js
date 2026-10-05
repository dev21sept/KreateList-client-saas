const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, rel), 'utf8');

test('shared publish routes each platform to its own endpoint (no Poshmark default)', () => {
  const api = read('../../frontend/src/services/api.js');
  assert.doesNotMatch(api, /publish: \(id, data\) => data\.platform === 'depop'/);
  assert.match(api, /ebay: \(\) => listingService\.publish\(id\)/);
  assert.match(api, /etsy: \(\) => etsyService\.publish\(id, data\)/);
  assert.match(api, /amazon: \(\) => amazonService\.publish\(id, data\)/);
  assert.match(api, /Unknown publish platform/);
});

test('master page does not pre-select platforms inferred from saved marketplace IDs', () => {
  const master = read('../../frontend/src/pages/CreateMasterListing.jsx');
  assert.doesNotMatch(master, /if \(detected\.length > 0\) return detected;/);
});

test('background Poshmark and Depop sync is opt-in per listing', () => {
  const controller = read('../controllers/listingController.js');
  assert.match(controller, /listing\.poshmarkAutoSync === true && \(listing\.poshmarkListingId/);
  assert.match(controller, /listing\.depopAutoSync === true && \(listing\.depopListingId/);
  const model = read('../models/Listing.js');
  assert.match(model, /poshmarkAutoSync: \{ type: Boolean, default: false \}/);
  assert.match(model, /depopAutoSync: \{ type: Boolean, default: false \}/);
});
