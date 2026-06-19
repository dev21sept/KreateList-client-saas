const express = require('express');
const { 
  poshmarkConnect, 
  poshmarkConnectPassword, 
  poshmarkImportCloset, 
  poshmarkPublish, 
  poshmarkGetLive 
} = require('../controllers/poshmarkController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All Poshmark routes require authentication
router.use(protect);

router.post('/connect', poshmarkConnect);
router.post('/connect-password', poshmarkConnectPassword);
router.post('/import', poshmarkImportCloset);
router.post('/publish/:id', poshmarkPublish);
router.get('/live', poshmarkGetLive);

module.exports = router;
