const express = require('express');
const { 
  depopConnect, 
  depopConnectInteractive,
  depopImportCloset, 
  depopPublish, 
  depopGetLive 
} = require('../controllers/depopController');
const { protect } = require('../middleware/auth');
const { requireWithinFetchLimit } = require('../middleware/subscriptionCheck');

const router = express.Router();

// All Depop routes require authentication
router.use(protect);

router.post('/connect', depopConnect);
router.post('/connect-interactive', depopConnectInteractive);
router.post('/import', requireWithinFetchLimit, depopImportCloset);
router.post('/publish/:id', depopPublish);
router.get('/live', depopGetLive);

module.exports = router;
