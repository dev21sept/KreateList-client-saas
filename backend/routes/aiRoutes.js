const express = require('express');
const router = express.Router();
const { analyzeListing, saveAiListing, searchCategories } = require('../controllers/aiController');
const { poshmarkAnalyzeListing, searchPoshmarkCategories } = require('../controllers/poshmarkAiController');
const { depopAnalyzeListing, searchDepopCategories, getDepopCategoryDetails } = require('../controllers/depopAiController');
const { etsyFetchListing, etsyAnalyzeListing, searchEtsyCategories } = require('../controllers/etsyAiController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

router.post('/analyze', protect, requireActiveSubscription, analyzeListing);
router.post('/poshmark-analyze', protect, requireActiveSubscription, poshmarkAnalyzeListing);
router.post('/depop-analyze', protect, requireActiveSubscription, depopAnalyzeListing);
router.post('/etsy-fetch', protect, requireActiveSubscription, etsyFetchListing);
router.post('/etsy-analyze', protect, requireActiveSubscription, etsyAnalyzeListing);
router.post('/save', protect, requireActiveSubscription, saveAiListing);
router.get('/categories', protect, searchCategories);
router.get('/poshmark-categories', protect, searchPoshmarkCategories);
router.get('/depop-categories', protect, searchDepopCategories);
router.get('/depop-category-details', protect, getDepopCategoryDetails);
router.get('/etsy-categories', protect, searchEtsyCategories);

module.exports = router;
