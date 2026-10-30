const express = require('express');
const {
  getOrders,
  syncOrders,
  updateOrderStatus,
  deleteOrder,
  relistOrder,
  getProfitOrders,
  updateOrderProfit
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to protect all order routes
router.use(protect);

router.route('/')
  .get(getOrders);

router.get('/profit', getProfitOrders);
router.patch('/:id/profit', updateOrderProfit);

router.post('/sync', syncOrders);

router.post('/:id/relist', relistOrder);

router.route('/:id')
  .put(updateOrderStatus)
  .delete(deleteOrder);

module.exports = router;
