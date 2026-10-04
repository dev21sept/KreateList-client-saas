/**
 * Pricing Routes
 * Maps /api/v1/pricing endpoints to controller methods.
 */

const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { protect } = require('../middleware/auth');

// Pricing calls use third-party APIs and must be attributable to a user.
router.use(protect);

// Single item price recommendation
router.post('/recommendations', pricingController.getRecommendation);

// Bulk batch pricing
router.post('/batch', pricingController.createBatchPricing);
router.get('/batch/:job_id', pricingController.getBatchStatus);

// Audit & Feedback
router.post('/feedback', pricingController.recordFeedback);
router.get('/sources/status', pricingController.getSourcesStatus);

module.exports = router;
