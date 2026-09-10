const express = require('express');
const { 
  mercariConnect, 
  mercariConnectPassword, 
  mercariVerify2FA,
  mercariImportCloset, 
  mercariPublish, 
  mercariGetLive,
  mercariInitiateLogin,
  mercariSessionStatus,
  mercariSubmit2faStream,
  mercariTriggerVerificationMethod,
  getMercariBrands,
  mercariDelist,
  mercariDelete,
  mercariVerifyStatus,
  mercariGetItemDetails
} = require('../controllers/mercariController');
const { protect } = require('../middleware/auth');
const { requireWithinFetchLimit } = require('../middleware/subscriptionCheck');

const router = express.Router();

// All Mercari routes require authentication
router.use(protect);

router.post('/connect', mercariConnect);
router.post('/connect-password', mercariConnectPassword);
router.post('/verify-2fa', mercariVerify2FA);
router.post('/initiate-login', mercariInitiateLogin);
router.get('/session-status/:sessionId', mercariSessionStatus);
router.post('/submit-2fa-stream', mercariSubmit2faStream);
router.post('/trigger-verification-method', mercariTriggerVerificationMethod);
router.post('/import', requireWithinFetchLimit, mercariImportCloset);
router.post('/publish/:id', mercariPublish);
router.post('/delist/:id', mercariDelist);
router.post('/delete/:id', mercariDelete);
router.post('/verify-status/:id', mercariVerifyStatus);
router.get('/live', mercariGetLive);
router.get('/brands', getMercariBrands);
router.get('/item-details/:id', mercariGetItemDetails);

module.exports = router;
