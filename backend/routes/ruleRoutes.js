const express = require('express');
const {
  getRules,
  createRule,
  updateRule,
  deleteRule
} = require('../controllers/ruleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getRules)
  .post(createRule);

router.route('/:id')
  .put(updateRule)
  .delete(deleteRule);

module.exports = router;
