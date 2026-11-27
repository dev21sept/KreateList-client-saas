const express = require('express');
const {
  getStats,
  getUsers,
  updateUser
} = require('../controllers/adminController');
const {
  listAffiliates,
  getAffiliate,
  approveAffiliate,
  rejectAffiliate,
  terminateAffiliate,
  reactivateAffiliate
} = require('../controllers/adminAffiliateController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);

router.get('/affiliates', listAffiliates);
router.get('/affiliates/:id', getAffiliate);
router.post('/affiliates/:id/approve', approveAffiliate);
router.post('/affiliates/:id/reject', rejectAffiliate);
router.post('/affiliates/:id/terminate', terminateAffiliate);
router.post('/affiliates/:id/reactivate', reactivateAffiliate);

module.exports = router;
