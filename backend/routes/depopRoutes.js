const express = require('express');
const { 
  depopConnect, 
  depopImportCloset, 
  depopPublish, 
  depopGetLive 
} = require('../controllers/depopController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All Depop routes require authentication
router.use(protect);

router.post('/connect', depopConnect);
router.post('/import', depopImportCloset);
router.post('/publish/:id', depopPublish);
router.get('/live', depopGetLive);

module.exports = router;
