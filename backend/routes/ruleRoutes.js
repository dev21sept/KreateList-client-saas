const express = require('express');
const {
  getRules,
  createRule,
  updateRule,
  deleteRule
} = require('../controllers/ruleController');
const { protect } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getRules)
  .post(requireActiveSubscription, createRule);

router.route('/:id')
  .put(requireActiveSubscription, updateRule)
  .delete(requireActiveSubscription, deleteRule);

module.exports = router;
