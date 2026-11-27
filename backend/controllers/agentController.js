const tokenService = require('../services/tokenService');
const AgentTask = require('../models/AgentTask');
const AgentPlanVersion = require('../models/AgentPlanVersion');
const AgentStep = require('../models/AgentStep');
const AgentAuditEvent = require('../models/AgentAuditEvent');
const { createTaskFromGoal, approveTask, executeTask } = require('../services/agentOrchestratorService');

exports.createTask = async (req, res) => {
  try {
    const { goal } = req.body;
    if (!goal || !goal.trim()) {
      return res.status(400).json({ success: false, message: 'goal is required' });
    }

    const deduct = await tokenService.deductTokens(req.user.id, { action: 'agent_plan', feature: 'AI Agent task planning' });
    if (!deduct.success) {
      return res.status(403).json({ success: false, message: deduct.message, tokensRemaining: deduct.tokensRemaining });
    }

    const { task, planVersion, validation } = await createTaskFromGoal(req.user.id, goal.trim());
    res.status(201).json({
      success: true,
      task: { id: task._id, status: task.status, riskLevel: task.riskLevel },
      plan: planVersion.planJson,
      planVersionId: planVersion._id,
      valid: validation.valid,
      errors: validation.errors,
      tokensRemaining: deduct.tokensRemaining
    });
  } catch (err) {
    console.error('[agentController] createTask error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create agent task' });
  }
};

exports.getTask = async (req, res) => {
  const task = await AgentTask.findOne({ _id: req.params.id, user: req.user.id }).lean();
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

  const planVersion = task.activePlanVersionId ? await AgentPlanVersion.findById(task.activePlanVersionId).lean() : null;
  const steps = planVersion ? await AgentStep.find({ planVersion: planVersion._id }).sort({ sequence: 1 }).lean() : [];
  const auditTrail = await AgentAuditEvent.find({ task: task._id }).sort({ occurredAt: 1 }).lean();

  res.json({ success: true, task, plan: planVersion ? planVersion.planJson : null, steps, auditTrail });
};

exports.listTasks = async (req, res) => {
  const tasks = await AgentTask.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, tasks });
};

exports.approveTask = async (req, res) => {
  try {
    const { task, approval } = await approveTask(req.user.id, req.params.id);
    res.json({ success: true, task: { id: task._id, status: task.status }, approvalId: approval._id });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'INVALID_STATE' ? 409 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

exports.runTask = async (req, res) => {
  try {
    const task = await executeTask(req.user.id, req.params.id);
    res.json({ success: true, task: { id: task._id, status: task.status, resultSummary: task.resultSummary } });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'INVALID_STATE' || err.code === 'APPROVAL_INVALID' ? 409 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

exports.cancelTask = async (req, res) => {
  const task = await AgentTask.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id, status: { $in: ['draft', 'awaiting_approval', 'approved'] } },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!task) return res.status(409).json({ success: false, message: 'Task cannot be cancelled from its current status' });
  res.json({ success: true, task: { id: task._id, status: task.status } });
};
