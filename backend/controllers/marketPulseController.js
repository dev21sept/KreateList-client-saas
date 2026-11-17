const { getTrends, getComparables, getBrandSummaries, ingestUserObservations, computeAggregates } = require('../services/marketPulseService');

exports.getTrends = async (req, res) => {
  try {
    const { category, marketplace } = req.query;
    const trends = await getTrends(req.user.id, { category, marketplace });
    res.json({ success: true, trends });
  } catch (err) {
    console.error('[marketPulseController] getTrends error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load trends' });
  }
};

exports.getComparables = async (req, res) => {
  try {
    const { category, brand } = req.query;
    const result = await getComparables(req.user.id, { category, brand });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[marketPulseController] getComparables error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load comparables' });
  }
};

exports.getBrands = async (req, res) => {
  try {
    const brands = await getBrandSummaries(req.user.id);
    res.json({ success: true, brands });
  } catch (err) {
    console.error('[marketPulseController] getBrands error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load brand summaries' });
  }
};

// Lets a seller refresh their own trend data on demand rather than waiting for the nightly cron.
exports.refresh = async (req, res) => {
  try {
    const ingestResult = await ingestUserObservations(req.user.id);
    const aggregateResult = await computeAggregates(req.user.id);
    res.json({ success: true, ingested: ingestResult, aggregated: aggregateResult });
  } catch (err) {
    console.error('[marketPulseController] refresh error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to refresh market data' });
  }
};
