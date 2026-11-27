const OpenAI = require('openai');
const AgentTask = require('../models/AgentTask');
const AgentPlanVersion = require('../models/AgentPlanVersion');
const AgentStep = require('../models/AgentStep');
const AgentApproval = require('../models/AgentApproval');
const AgentAuditEvent = require('../models/AgentAuditEvent');
const { hashPlan, validatePlan, approvalCoversPlan } = require('./agentPolicyService');
const { runTool, TOOL_CATALOG } = require('./agentTools');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key' });
const MODEL = 'gpt-4o-mini';

const TOOL_CATALOG_DESCRIPTION = Object.entries(TOOL_CATALOG)
  .filter(([, def]) => def.enabled !== false)
  .map(([name, def]) => `- ${name} (risk: ${def.riskLevel})`)
  .join('\n');

async function logAudit(taskId, userId, actor, action, beforeRef = null, afterRef = null) {
  await AgentAuditEvent.create({ task: taskId, user: userId, actor, action, beforeRef, afterRef });
}

/**
 * The model only ever proposes planJson. It never receives DB credentials,
 * marketplace tokens, or the ability to call a tool directly - this function is
 * the entire boundary between "what the LLM said" and "what actually runs".
 */
async function proposePlan(goalText) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are eLister's AI Agent planner. You convert a seller's natural-language goal into a strict JSON plan. ` +
          `You may ONLY use these tools:\n${TOOL_CATALOG_DESCRIPTION}\n` +
          `Return JSON: {"goal": string, "scope": object, "constraints": object, "steps": [{"tool": string, "input": object}], "approval_required": boolean}. ` +
          `Never propose a tool outside the allowlist above. If the goal requires an action outside these tools, explain that in a "clarification_needed" field instead of steps.`
      },
      { role: 'user', content: goalText }
    ]
  });

  const planJson = JSON.parse(response.choices[0].message.content);
  return { planJson, modelVersion: MODEL };
}

/**
 * Creates an AgentTask + its first AgentPlanVersion from a seller's natural-
 * language goal. Returns the plan for preview before anything executes (AGT-02).
 */
async function createTaskFromGoal(userId, goalText) {
  const task = await AgentTask.create({ user: userId, goalText, status: 'draft' });
  await logAudit(task._id, userId, 'user', 'task.created', null, { goalText });

  const { planJson, modelVersion } = await proposePlan(goalText);
  const validation = validatePlan(planJson);

  const planVersion = await AgentPlanVersion.create({
    task: task._id,
    version: 1,
    planJson,
    planHash: hashPlan(planJson),
    modelVersion
  });

  for (const [i, step] of (planJson.steps || []).entries()) {
    await AgentStep.create({ planVersion: planVersion._id, sequence: i, toolName: step.tool, inputJson: step.input || {} });
  }

  task.activePlanVersionId = planVersion._id;
  task.riskLevel = validation.highestRisk;
  task.status = validation.valid ? 'awaiting_approval' : 'rejected';
  await task.save();

  await logAudit(task._id, userId, 'agent', 'plan.proposed', null, { planVersionId: planVersion._id, valid: validation.valid, errors: validation.errors });

  return { task, planVersion, validation };
}

async function approveTask(userId, taskId) {
  const task = await AgentTask.findOne({ _id: taskId, user: userId });
  if (!task) throw Object.assign(new Error('Task not found.'), { code: 'NOT_FOUND' });
  if (task.status !== 'awaiting_approval') {
    throw Object.assign(new Error(`Task cannot be approved from status '${task.status}'.`), { code: 'INVALID_STATE' });
  }

  const planVersion = await AgentPlanVersion.findById(task.activePlanVersionId);
  const approval = await AgentApproval.create({
    task: task._id,
    planVersionId: planVersion._id,
    payloadHash: planVersion.planHash,
    approvedBy: userId
  });

  task.status = 'approved';
  await task.save();
  await logAudit(task._id, userId, 'user', 'task.approved', null, { planVersionId: planVersion._id });

  return { task, approval };
}

/**
 * Executes an approved task's steps, in order, re-validating authorization and
 * the approval binding before every step - never trusting the approval record's
 * mere existence once a step has already started running (AGT-06, AGT-08).
 */
async function executeTask(userId, taskId) {
  const task = await AgentTask.findOne({ _id: taskId, user: userId });
  if (!task) throw Object.assign(new Error('Task not found.'), { code: 'NOT_FOUND' });
  if (task.status !== 'approved') {
    throw Object.assign(new Error(`Task cannot run from status '${task.status}'.`), { code: 'INVALID_STATE' });
  }

  const planVersion = await AgentPlanVersion.findById(task.activePlanVersionId);
  const approval = await AgentApproval.findOne({ task: task._id, planVersionId: planVersion._id });
  if (!approvalCoversPlan(approval, planVersion)) {
    task.status = 'rejected';
    await task.save();
    throw Object.assign(new Error('Approval no longer covers this plan version.'), { code: 'APPROVAL_INVALID' });
  }

  task.status = 'running';
  await task.save();
  await logAudit(task._id, userId, 'agent', 'task.started');

  const steps = await AgentStep.find({ planVersion: planVersion._id }).sort({ sequence: 1 });
  let failed = false;
  const outputs = [];

  for (const step of steps) {
    step.status = 'running';
    step.startedAt = new Date();
    await step.save();
    try {
      const output = await runTool(userId, step.toolName, step.inputJson);
      step.status = 'succeeded';
      step.outputRef = output;
      outputs.push({ tool: step.toolName, output });
    } catch (err) {
      step.status = 'failed';
      step.outputRef = { error: err.message, code: err.code };
      failed = true;
    }
    step.finishedAt = new Date();
    await step.save();
    await logAudit(task._id, userId, 'agent', `step.${step.status}`, null, { tool: step.toolName });
    if (failed) break;
  }

  task.status = failed ? 'partially_completed' : 'completed';
  task.resultSummary = { outputs };
  await task.save();
  await logAudit(task._id, userId, 'agent', 'task.finished', null, { status: task.status });

  return task;
}

module.exports = { createTaskFromGoal, approveTask, executeTask };
