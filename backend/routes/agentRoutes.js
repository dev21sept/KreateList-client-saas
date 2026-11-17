const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');
const { createTask, getTask, listTasks, approveTask, runTask, cancelTask } = require('../controllers/agentController');

router.post('/tasks', protect, requireActiveSubscription, createTask);
router.get('/tasks', protect, listTasks);
router.get('/tasks/:id', protect, getTask);
router.post('/tasks/:id/approve', protect, approveTask);
router.post('/tasks/:id/run', protect, runTask);
router.post('/tasks/:id/cancel', protect, cancelTask);

module.exports = router;
