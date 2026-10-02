/**
 * Pricing Controller
 * Handles HTTP endpoints for eLister eBay Pricing Engine:
 * - POST /api/v1/pricing/recommendations (Single item)
 * - POST /api/v1/pricing/batch (Batch items)
 * - GET /api/v1/pricing/batch/:job_id (Batch status)
 * - POST /api/v1/pricing/feedback (Feedback on recommendations)
 * - GET /api/v1/pricing/sources/status (Data source health)
 */

const { recommendPrice, PRICING_ALGORITHM_VERSION } = require('../services/pricing/pricingService');
const { getAppToken } = require('../services/ebayService');

// In-memory store for bulk batch jobs
const batchJobs = new Map();

/**
 * Single item price recommendation
 */
async function getRecommendation(req, res) {
  try {
    const { item, marketplace, currency, objective, options } = req.body;

    if (!item || (!item.title && !item.upc && !item.model)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid item data. Provide at least a title, model, or UPC barcode.'
      });
    }

    const result = await recommendPrice({
      item,
      marketplace: marketplace || 'EBAY_US',
      currency: currency || 'USD',
      objective: objective || 'MARKET_MATCHED',
      options: options || {}
    });

    return res.json(result);
  } catch (error) {
    console.error('[PricingController] Error generating recommendation:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate price recommendation.',
      error: error.message
    });
  }
}

/**
 * Start bulk batch pricing job
 */
async function createBatchPricing(req, res) {
  try {
    const { items, marketplace, objective } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items array is required for batch pricing.'
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        status: 'error',
        message: 'Batch size exceeds maximum limit of 500 items per request.'
      });
    }

    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const jobData = {
      job_id: jobId,
      status: 'PROCESSING',
      total_items: items.length,
      completed_items: 0,
      failed_items: 0,
      results: [],
      created_at: new Date().toISOString()
    };

    batchJobs.set(jobId, jobData);

    // Run batch processing asynchronously in background
    processBatchAsync(jobId, items, marketplace, objective);

    return res.status(202).json({
      status: 'accepted',
      job_id: jobId,
      total_items: items.length,
      message: 'Batch pricing job enqueued successfully.'
    });
  } catch (error) {
    console.error('[PricingController] Error creating batch job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to initiate batch pricing job.',
      error: error.message
    });
  }
}

/**
 * Background worker for batch processing
 */
async function processBatchAsync(jobId, items, marketplace, objective) {
  const job = batchJobs.get(jobId);
  if (!job) return;

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i];
    try {
      const rec = await recommendPrice({
        item: itemData.item || itemData,
        marketplace: marketplace || 'EBAY_US',
        objective: objective || 'MARKET_MATCHED'
      });

      job.results.push({
        index: i,
        item_id: itemData.id || `row_${i}`,
        status: rec.status,
        recommendation: rec.recommendation || null,
        error: rec.reason || null
      });
      job.completed_items++;
    } catch (err) {
      job.results.push({
        index: i,
        item_id: itemData.id || `row_${i}`,
        status: 'error',
        error: err.message
      });
      job.failed_items++;
    }

    // Small delay between requests to be polite with rate limits
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  job.status = 'COMPLETED';
  job.completed_at = new Date().toISOString();
}

/**
 * Retrieve batch job status and results
 */
async function getBatchStatus(req, res) {
  const { job_id } = req.params;
  const job = batchJobs.get(job_id);

  if (!job) {
    return res.status(404).json({
      status: 'error',
      message: 'Batch job not found.'
    });
  }

  return res.json({
    status: 'ok',
    job_id: job.job_id,
    job_status: job.status,
    total_items: job.total_items,
    completed_items: job.completed_items,
    failed_items: job.failed_items,
    results: job.results,
    created_at: job.created_at,
    completed_at: job.completed_at || null
  });
}

/**
 * Capture user feedback / price acceptance for audit and calibration
 */
async function recordFeedback(req, res) {
  try {
    const { request_id, item_title, suggested_price, accepted, user_custom_price, comments } = req.body;
    
    // Log feedback for monitoring and quality evaluation
    console.log('[PricingFeedback]', {
      timestamp: new Date().toISOString(),
      request_id,
      item_title,
      suggested_price,
      accepted,
      user_custom_price,
      comments
    });

    return res.json({
      status: 'ok',
      message: 'Feedback recorded successfully.'
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', error: error.message });
  }
}

/**
 * Internal source status check
 */
async function getSourcesStatus(req, res) {
  let ebayTokenOk = false;
  try {
    const token = await getAppToken();
    ebayTokenOk = !!token;
  } catch (e) {
    ebayTokenOk = false;
  }

  return res.json({
    algorithm_version: PRICING_ALGORITHM_VERSION,
    sources: {
      ebay_browse_api: {
        enabled: true,
        authenticated: ebayTokenOk,
        role: 'Active competitor listings'
      },
      authorized_sold_feed: {
        enabled: !!process.env.EBAY_SOLD_DATA_PROVIDER_URL,
        role: 'Historical completed sales'
      }
    }
  });
}

module.exports = {
  getRecommendation,
  createBatchPricing,
  getBatchStatus,
  recordFeedback,
  getSourcesStatus
};
