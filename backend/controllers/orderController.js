const Order = require('../models/Order');
const { syncOrders: syncEbayOrders } = require('./ebayController');

// @desc    Get all orders/sales for the logged-in user
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).sort({ createdDate: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales data',
      error: error.message
    });
  }
};

// @desc    Sync sales from connected platforms (eBay, Depop, Poshmark, Etsy)
// @route   POST /api/orders/sync
// @access  Private
exports.syncOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    let ebaySyncStatus = 'skipped';
    let ebayCount = 0;

    // 1. Try to sync real eBay orders
    try {
      console.log('[OrderController] Syncing eBay orders...');
      const ebayResult = await syncEbayOrders(req, null); // Run but don't respond directly yet
      if (ebayResult && ebayResult.success) {
        ebaySyncStatus = 'success';
        ebayCount = ebayResult.count;
      }
    } catch (err) {
      console.warn('[OrderController] eBay order sync failed or not connected:', err.message);
      ebaySyncStatus = 'failed';
    }

    const updatedOrders = await Order.find({ user: userId }).sort({ createdDate: -1 });

    return res.status(200).json({
      success: true,
      message: 'Sales synchronized successfully',
      ebayStatus: ebaySyncStatus,
      ebayCount: ebayCount,
      count: updatedOrders.length,
      data: updatedOrders
    });
  } catch (error) {
    console.error('Error syncing orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync sales',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status, updated_at: Date.now() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
};
