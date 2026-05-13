const express = require('express');
const {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  publishListing,
  getDashboardStats
} = require('../controllers/listingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats', getDashboardStats);

router.route('/')
  .get(getListings)
  .post(createListing);

router.route('/:id')
  .get(getListing)
  .put(updateListing)
  .delete(deleteListing);

router.post('/:id/publish', publishListing);

module.exports = router;
