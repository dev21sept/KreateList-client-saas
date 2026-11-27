const express = require('express');
const {
  getSettings,
  updateSettings,
  createJob,
  listJobs,
  getJob,
  cancelJob,
  getActivity
} = require('../controllers/automationController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);
router.use(requireActiveSubscription);

router.get('/settings', getSettings);
router.put('/settings/:platform/:feature', updateSettings);
router.post('/jobs', createJob);
router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/cancel', cancelJob);
router.get('/activity', getActivity);

module.exports = router;
