const express = require('express');
const {
  getOrders,
  syncOrders,
  updateOrderStatus,
  deleteOrder,
  relistOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to protect all order routes
router.use(protect);

router.route('/')
  .get(getOrders);

router.post('/sync', syncOrders);

router.post('/:id/relist', relistOrder);

router.route('/:id')
  .put(updateOrderStatus)
  .delete(deleteOrder);

module.exports = router;
