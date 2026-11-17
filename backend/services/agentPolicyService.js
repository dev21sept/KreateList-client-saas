const crypto = require('crypto');
const { TOOL_CATALOG } = require('./agentTools');

// This release only ever allows read_only and draft_only steps to execute
// automatically; anything riskier requires a plan from a future release where the
// corresponding tool is actually enabled. This is a hard cap, not a seller setting.
const MAX_AUTO_RISK_LEVELS = new Set(['read_only', 'draft_only']);

function hashPlan(planJson) {
  return crypto.createHash('sha256').update(JSON.stringify(planJson)).digest('hex');
}

/**
 * Validates a proposed plan against the tool allowlist and risk matrix. Never
 * mutates anything - pure validation, called both at plan-build time and again
 * at execution time (re-checked, not trusted from planning alone).
 */
function validatePlan(planJson) {
  const errors = [];
  const steps = Array.isArray(planJson.steps) ? planJson.steps : [];

  if (steps.length === 0) {
    errors.push('Plan has no steps.');
  }

  let highestRisk = 'read_only';
  for (const step of steps) {
    const toolDef = TOOL_CATALOG[step.tool];
    if (!toolDef) {
      errors.push(`Step references unknown tool '${step.tool}'.`);
      continue;
    }
    if (toolDef.enabled === false) {
      errors.push(`Step uses tool '${step.tool}', which is defined but not enabled in this release.`);
    }
    if (!MAX_AUTO_RISK_LEVELS.has(toolDef.riskLevel)) {
      errors.push(`Step uses tool '${step.tool}' (risk: ${toolDef.riskLevel}), which this release does not permit the agent to execute.`);
    }
    highestRisk = toolDef.riskLevel;
  }

  const requiresApproval = highestRisk !== 'read_only' || planJson.approval_required !== false;

  return { valid: errors.length === 0, errors, highestRisk, requiresApproval };
}

/**
 * The approval must bind to this exact plan version and hash. If the plan content
 * changed since approval, the approval is invalid - checked again right before
 * execution, not assumed from the approval record's mere existence.
 */
function approvalCoversPlan(approval, planVersion) {
  return !!approval && approval.planVersionId.toString() === planVersion._id.toString() && approval.payloadHash === planVersion.planHash;
}

module.exports = { hashPlan, validatePlan, approvalCoversPlan, MAX_AUTO_RISK_LEVELS };
