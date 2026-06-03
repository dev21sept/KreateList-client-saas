const express = require('express');
const router = express.Router();
const { analyzeListing, saveAiListing, searchCategories } = require('../controllers/aiController');
const { poshmarkAnalyzeListing, searchPoshmarkCategories } = require('../controllers/poshmarkAiController');
const { vintedAnalyzeListing, searchVintedCategories, getVintedCategoryDetails, getVintedBrands, getVintedColors, getVintedSizes } = require('../controllers/vintedAiController');
const { depopAnalyzeListing, searchDepopCategories } = require('../controllers/depopAiController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

router.post('/analyze', protect, requireActiveSubscription, analyzeListing);
router.post('/poshmark-analyze', protect, requireActiveSubscription, poshmarkAnalyzeListing);
router.post('/vinted-analyze', protect, requireActiveSubscription, vintedAnalyzeListing);
router.post('/depop-analyze', protect, requireActiveSubscription, depopAnalyzeListing);
router.post('/save', protect, requireActiveSubscription, saveAiListing);
router.get('/categories', protect, searchCategories);
router.get('/poshmark-categories', protect, searchPoshmarkCategories);
router.get('/vinted-categories', protect, searchVintedCategories);
router.get('/vinted-category-details', protect, getVintedCategoryDetails);
router.get('/vinted-brands', protect, getVintedBrands);
router.get('/vinted-colors', protect, getVintedColors);
router.get('/vinted-sizes', protect, getVintedSizes);
router.get('/depop-categories', protect, searchDepopCategories);

module.exports = router;
