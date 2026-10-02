/**
 * Pricing Routes
 * Maps /api/v1/pricing endpoints to controller methods.
 */

const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');

// Single item price recommendation
router.post('/recommendations', pricingController.getRecommendation);

// Bulk batch pricing
router.post('/batch', pricingController.createBatchPricing);
router.get('/batch/:job_id', pricingController.getBatchStatus);

// Audit & Feedback
router.post('/feedback', pricingController.recordFeedback);
router.get('/sources/status', pricingController.getSourcesStatus);

module.exports = router;
