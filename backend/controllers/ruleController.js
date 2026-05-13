const Rule = require('../models/Rule');

// @desc    Get all rules for a user
// @route   GET /api/rules
// @access  Private
exports.getRules = async (req, res) => {
  try {
    const rules = await Rule.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create a new rule
// @route   POST /api/rules
// @access  Private
exports.createRule = async (req, res) => {
  try {
    req.body.user = req.user.id;
    const rule = await Rule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update a rule
// @route   PUT /api/rules/:id
// @access  Private
exports.updateRule = async (req, res) => {
  try {
    let rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    if (rule.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete a rule
// @route   DELETE /api/rules/:id
// @access  Private
exports.deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    if (rule.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    await Rule.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

