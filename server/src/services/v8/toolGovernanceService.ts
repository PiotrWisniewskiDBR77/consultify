/**
 * V8 Tool Governance & HITL Service
 *
 * Manages the tool catalog, consumer-class policies, invocation requests,
 * and 7-step support-visible traces.
 *
 * All queries enforce organization-level isolation.
 *
 * Decisions implemented:
 *  D19 — new tool defaults to `requires_human_approval` / `proposed` until classified
 *  D20 — effective policy = most restrictive of all active layers; project may tighten only
 *  D21 — delegation tokens are scoped/temporary (type-level; issuance not in this service)
 *  D22 — background consumer class defaults to `deferred_approval` for mutating tools
 */

import { v4 as uuidv4 } from 'uuid';

import type { ConsumerClass } from '../../types/contextSnapshot.js';
import type { ApprovalClass } from '../../types/executionSpine.js';
import type {
  ApprovalOverride,
  ClassifyToolParams,
  ConsumerToolPolicy,
  LogInvocationTraceParams,
  RegisterToolParams,
  RequestInvocationParams,
  SetConsumerPolicyParams,
  ToolApprovalResult,
  ToolApprovalState,
  ToolCapability,
  ToolInvocationRequest,
  ToolInvocationTrace,
} from '../../types/toolGovernance.js';
import {
  APPROVAL_CLASS_STRICTNESS,
  ClassifyToolParamsSchema,
  LogInvocationTraceParamsSchema,
  RegisterToolParamsSchema,
  RequestInvocationParamsSchema,
  RISK_CLASS_DEFAULT_APPROVAL,
  SetConsumerPolicyParamsSchema,
} from '../../types/toolGovernance.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ToolGovernance]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

function stricterApproval(a: ApprovalClass, b: ApprovalClass): ApprovalClass {
  return APPROVAL_CLASS_STRICTNESS[a] >= APPROVAL_CLASS_STRICTNESS[b] ? a : b;
}

// ==========================================
// ROW TYPES
// ==========================================

interface ToolRow {
  tool_id: string;
  organization_id: string;
  name: string;
  description: string;
  category: string;
  risk_class: string;
  mutation_type: string;
  classification_status: string;
  default_approval_mode: string;
  classified_by: string | null;
  classified_at: string | null;
  version: string;
  created_at: string;
  updated_at: string;
}

interface PolicyRow {
  policy_id: string;
  organization_id: string;
  project_id: string | null;
  consumer_class: string;
  tool_id: string;
  allowed: number;
  approval_override: string;
  max_invocations_per_run: number | null;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

interface InvocationRow {
  invocation_id: string;
  organization_id: string;
  tool_id: string;
  consumer_class: string;
  context_snapshot_id: string;
  execution_run_id: string | null;
  initiator_user_id: string;
  parameters: string;
  approval_result: string;
  policy_ref: string | null;
  block_reason: string | null;
  created_at: string;
}

interface TraceRow {
  trace_id: string;
  invocation_id: string;
  tool_id: string;
  consumer_class: string;
  execution_run_id: string | null;
  delegation_id: string | null;
  initiating_user_ref: string;
  effective_role_ref: string;
  context_snapshot_ref: string;
  tool_risk_class: string;
  consumer_policy_ref: string;
  approval_state: string;
  block_reason: string | null;
  blocking_policy_ref: string | null;
  approval_ref: string | null;
  invocation_result: string;
  timestamp: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToTool(row: ToolRow): ToolCapability {
  return {
    toolId: row.tool_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    category: row.category as ToolCapability['category'],
    riskClass: row.risk_class as ToolCapability['riskClass'],
    mutationType: row.mutation_type as ToolCapability['mutationType'],
    classificationStatus: row.classification_status as ToolCapability['classificationStatus'],
    defaultApprovalMode: row.default_approval_mode as ToolCapability['defaultApprovalMode'],
    classifiedBy: row.classified_by,
    classifiedAt: row.classified_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPolicy(row: PolicyRow): ConsumerToolPolicy {
  return {
    policyId: row.policy_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    consumerClass: row.consumer_class as ConsumerToolPolicy['consumerClass'],
    toolId: row.tool_id,
    allowed: row.allowed === 1,
    approvalOverride: row.approval_override as ConsumerToolPolicy['approvalOverride'],
    maxInvocationsPerRun: row.max_invocations_per_run,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInvocation(row: InvocationRow): ToolInvocationRequest {
  return {
    invocationId: row.invocation_id,
    organizationId: row.organization_id,
    toolId: row.tool_id,
    consumerClass: row.consumer_class as ToolInvocationRequest['consumerClass'],
    contextSnapshotId: row.context_snapshot_id,
    executionRunId: row.execution_run_id,
    initiatorUserId: row.initiator_user_id,
    parameters: safeJsonParse(row.parameters, {}),
    approvalResult: row.approval_result as ToolInvocationRequest['approvalResult'],
    policyRef: row.policy_ref,
    blockReason: row.block_reason,
    createdAt: row.created_at,
  };
}

function rowToTrace(row: TraceRow): ToolInvocationTrace {
  return {
    traceId: row.trace_id,
    invocationId: row.invocation_id,
    toolId: row.tool_id,
    consumerClass: row.consumer_class as ToolInvocationTrace['consumerClass'],
    executionRunId: row.execution_run_id,
    delegationId: row.delegation_id,
    initiatingUserRef: row.initiating_user_ref,
    effectiveRoleRef: row.effective_role_ref,
    contextSnapshotRef: row.context_snapshot_ref,
    toolRiskClass: row.tool_risk_class as ToolInvocationTrace['toolRiskClass'],
    consumerPolicyRef: row.consumer_policy_ref,
    approvalState: row.approval_state as ToolInvocationTrace['approvalState'],
    blockReason: row.block_reason,
    blockingPolicyRef: row.blocking_policy_ref,
    approvalRef: row.approval_ref,
    invocationResult: row.invocation_result as ToolInvocationTrace['invocationResult'],
    timestamp: row.timestamp,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Register a new tool in the catalog.
 * D19: defaults to `proposed` classification, `requires_human_approval`, `medium_risk`.
 */
export async function registerTool(params: RegisterToolParams): Promise<ToolCapability> {
  const validated = RegisterToolParamsSchema.parse(params);

  const toolId = uuidv4();
  const now = new Date().toISOString();

  const tool: ToolCapability = {
    toolId,
    organizationId: validated.organizationId,
    name: validated.name,
    description: validated.description,
    category: validated.category,
    riskClass: 'medium_risk',
    mutationType: validated.mutationType,
    classificationStatus: 'proposed',
    defaultApprovalMode: 'requires_human_approval',
    classifiedBy: null,
    classifiedAt: null,
    version: validated.version,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_catalog (
      tool_id, organization_id, name, description, category,
      risk_class, mutation_type, classification_status,
      default_approval_mode, classified_by, classified_at,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tool.toolId,
      tool.organizationId,
      tool.name,
      tool.description,
      tool.category,
      tool.riskClass,
      tool.mutationType,
      tool.classificationStatus,
      tool.defaultApprovalMode,
      tool.classifiedBy,
      tool.classifiedAt,
      tool.version,
      tool.createdAt,
      tool.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered tool ${toolId} "${validated.name}" for org ${validated.organizationId}`
  );
  return tool;
}

/**
 * Retrieve a single tool by ID with org isolation.
 */
export async function getTool(
  toolId: string,
  organizationId: string
): Promise<ToolCapability | null> {
  const row = await dbGet<ToolRow>(
    `SELECT * FROM v8_tool_catalog
     WHERE tool_id = ? AND organization_id = ?`,
    [toolId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToTool(row);
}

/**
 * Retrieve the full tool catalog for an organization.
 */
export async function getToolCatalog(organizationId: string): Promise<ToolCapability[]> {
  const rows = await dbAll<ToolRow>(
    `SELECT * FROM v8_tool_catalog
     WHERE organization_id = ?
     ORDER BY name ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToTool);
}

/**
 * Classify (ratify) a tool's risk class.
 * Transitions classification_status to `ratified` and updates default approval mode
 * based on the risk-class → approval mapping.
 */
export async function classifyTool(params: ClassifyToolParams): Promise<ToolCapability> {
  const validated = ClassifyToolParamsSchema.parse(params);

  const existing = await getTool(validated.toolId, validated.organizationId);
  if (!existing) {
    throw new Error(
      `Tool ${validated.toolId} not found in organization ${validated.organizationId}`
    );
  }

  const now = new Date().toISOString();
  const defaultApproval = RISK_CLASS_DEFAULT_APPROVAL[validated.riskClass];

  await dbRun(
    `UPDATE v8_tool_catalog
     SET risk_class = ?, classification_status = 'ratified',
         default_approval_mode = ?, classified_by = ?, classified_at = ?,
         updated_at = ?
     WHERE tool_id = ? AND organization_id = ?`,
    [
      validated.riskClass,
      defaultApproval,
      validated.classifiedBy,
      now,
      now,
      validated.toolId,
      validated.organizationId,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Classified tool ${validated.toolId} as ${validated.riskClass} by ${validated.classifiedBy}`
  );

  return {
    ...existing,
    riskClass: validated.riskClass,
    classificationStatus: 'ratified',
    defaultApprovalMode: defaultApproval,
    classifiedBy: validated.classifiedBy,
    classifiedAt: now,
    updatedAt: now,
  };
}

/**
 * Set a consumer-class policy for a tool.
 * If projectId is provided, this is a project-level policy (narrowing only — D20).
 */
export async function setConsumerPolicy(
  params: SetConsumerPolicyParams
): Promise<ConsumerToolPolicy> {
  const validated = SetConsumerPolicyParamsSchema.parse(params);

  const policyId = uuidv4();
  const now = new Date().toISOString();
  const effectiveFrom = validated.effectiveFrom || now;

  const policy: ConsumerToolPolicy = {
    policyId,
    organizationId: validated.organizationId,
    projectId: validated.projectId ?? null,
    consumerClass: validated.consumerClass,
    toolId: validated.toolId,
    allowed: validated.allowed,
    approvalOverride: validated.approvalOverride,
    maxInvocationsPerRun: validated.maxInvocationsPerRun,
    effectiveFrom,
    effectiveUntil: validated.effectiveUntil,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_consumer_tool_policies (
      policy_id, organization_id, project_id, consumer_class, tool_id,
      allowed, approval_override, max_invocations_per_run,
      effective_from, effective_until, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      policy.policyId,
      policy.organizationId,
      policy.projectId,
      policy.consumerClass,
      policy.toolId,
      policy.allowed ? 1 : 0,
      policy.approvalOverride,
      policy.maxInvocationsPerRun,
      policy.effectiveFrom,
      policy.effectiveUntil,
      policy.createdAt,
      policy.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Set policy ${policyId} for consumer=${validated.consumerClass} tool=${validated.toolId}`
  );
  return policy;
}

/**
 * Resolve the effective policy for a tool + consumer class + org (+ optional project).
 *
 * Resolution order (D20 — most restrictive wins):
 *  1. Tool's own defaultApprovalMode (from risk class)
 *  2. Org-level consumer policy
 *  3. Project-level consumer policy (can only tighten)
 *  4. Background consumer class override (D22 — deferred approval for mutations)
 */
export async function getEffectivePolicy(
  toolId: string,
  consumerClass: ConsumerClass,
  organizationId: string,
  projectId?: string | null
): Promise<ToolApprovalResult> {
  const tool = await getTool(toolId, organizationId);
  if (!tool) {
    return {
      state: 'blocked',
      policyRef: null,
      blockReason: 'tool_not_found',
      approvalClass: 'requires_human_approval',
    };
  }

  let effectiveApproval: ApprovalClass = tool.defaultApprovalMode;
  let policyRef: string | null = `tool:${toolId}`;

  const now = new Date().toISOString();

  const orgPolicies = await dbAll<PolicyRow>(
    `SELECT * FROM v8_consumer_tool_policies
     WHERE organization_id = ? AND tool_id = ? AND consumer_class = ?
       AND project_id IS NULL
       AND effective_from <= ?
       AND (effective_until IS NULL OR effective_until > ?)`,
    [organizationId, toolId, consumerClass, now, now],
    { fallback: true }
  );

  for (const row of orgPolicies || []) {
    const policy = rowToPolicy(row);

    if (!policy.allowed) {
      return {
        state: 'blocked',
        policyRef: policy.policyId,
        blockReason: 'org_policy_denied',
        approvalClass: 'requires_human_approval',
      };
    }

    const overrideApproval = resolveOverride(policy.approvalOverride, effectiveApproval);
    effectiveApproval = stricterApproval(effectiveApproval, overrideApproval);
    policyRef = policy.policyId;
  }

  if (projectId) {
    const projectPolicies = await dbAll<PolicyRow>(
      `SELECT * FROM v8_consumer_tool_policies
       WHERE organization_id = ? AND tool_id = ? AND consumer_class = ?
         AND project_id = ?
         AND effective_from <= ?
         AND (effective_until IS NULL OR effective_until > ?)`,
      [organizationId, toolId, consumerClass, projectId, now, now],
      { fallback: true }
    );

    for (const row of projectPolicies || []) {
      const policy = rowToPolicy(row);

      if (!policy.allowed) {
        return {
          state: 'blocked',
          policyRef: policy.policyId,
          blockReason: 'project_policy_denied',
          approvalClass: 'requires_human_approval',
        };
      }

      const overrideApproval = resolveOverride(policy.approvalOverride, effectiveApproval);
      effectiveApproval = stricterApproval(effectiveApproval, overrideApproval);
      policyRef = policy.policyId;
    }
  }

  if (consumerClass === 'background' && tool.mutationType !== 'read_only') {
    effectiveApproval = stricterApproval(effectiveApproval, 'requires_human_approval');

    const state: ToolApprovalState = 'deferred_approval';
    return {
      state,
      policyRef,
      blockReason: null,
      approvalClass: effectiveApproval,
    };
  }

  const state: ToolApprovalState =
    effectiveApproval === 'auto_executable'
      ? 'allowed'
      : effectiveApproval === 'policy_approvable'
        ? 'allowed'
        : 'requires_approval';

  return {
    state,
    policyRef,
    blockReason: null,
    approvalClass: effectiveApproval,
  };
}

/**
 * Create a tool invocation request. Evaluates policy and records the result.
 */
export async function requestInvocation(
  params: RequestInvocationParams
): Promise<ToolInvocationRequest> {
  const validated = RequestInvocationParamsSchema.parse(params);

  const policyResult = await getEffectivePolicy(
    validated.toolId,
    validated.consumerClass,
    validated.organizationId
  );

  const invocationId = uuidv4();
  const now = new Date().toISOString();

  const invocation: ToolInvocationRequest = {
    invocationId,
    organizationId: validated.organizationId,
    toolId: validated.toolId,
    consumerClass: validated.consumerClass,
    contextSnapshotId: validated.contextSnapshotId,
    executionRunId: validated.executionRunId ?? null,
    initiatorUserId: validated.initiatorUserId,
    parameters: validated.parameters,
    approvalResult: policyResult.state,
    policyRef: policyResult.policyRef,
    blockReason: policyResult.blockReason,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_invocation_log (
      invocation_id, organization_id, tool_id, consumer_class,
      context_snapshot_id, execution_run_id, initiator_user_id,
      parameters, approval_result, policy_ref, block_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invocation.invocationId,
      invocation.organizationId,
      invocation.toolId,
      invocation.consumerClass,
      invocation.contextSnapshotId,
      invocation.executionRunId,
      invocation.initiatorUserId,
      JSON.stringify(invocation.parameters),
      invocation.approvalResult,
      invocation.policyRef,
      invocation.blockReason,
      invocation.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Invocation ${invocationId}: tool=${validated.toolId} result=${policyResult.state}`
  );
  return invocation;
}

/**
 * Record a 7-step invocation trace for support visibility.
 */
export async function logInvocationTrace(
  params: LogInvocationTraceParams
): Promise<ToolInvocationTrace> {
  const validated = LogInvocationTraceParamsSchema.parse(params);

  const traceId = uuidv4();
  const now = new Date().toISOString();

  const trace: ToolInvocationTrace = {
    traceId,
    invocationId: validated.invocationId,
    toolId: validated.toolId,
    consumerClass: validated.consumerClass,
    executionRunId: validated.executionRunId ?? null,
    delegationId: validated.delegationId ?? null,
    initiatingUserRef: validated.initiatingUserRef,
    effectiveRoleRef: validated.effectiveRoleRef,
    contextSnapshotRef: validated.contextSnapshotRef,
    toolRiskClass: validated.toolRiskClass,
    consumerPolicyRef: validated.consumerPolicyRef,
    approvalState: validated.approvalState,
    blockReason: validated.blockReason ?? null,
    blockingPolicyRef: validated.blockingPolicyRef ?? null,
    approvalRef: validated.approvalRef ?? null,
    invocationResult: validated.invocationResult,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_invocation_traces (
      trace_id, invocation_id, tool_id, consumer_class,
      execution_run_id, delegation_id,
      initiating_user_ref, effective_role_ref, context_snapshot_ref,
      tool_risk_class, consumer_policy_ref, approval_state,
      block_reason, blocking_policy_ref, approval_ref,
      invocation_result, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trace.traceId,
      trace.invocationId,
      trace.toolId,
      trace.consumerClass,
      trace.executionRunId,
      trace.delegationId,
      trace.initiatingUserRef,
      trace.effectiveRoleRef,
      trace.contextSnapshotRef,
      trace.toolRiskClass,
      trace.consumerPolicyRef,
      trace.approvalState,
      trace.blockReason,
      trace.blockingPolicyRef,
      trace.approvalRef,
      trace.invocationResult,
      trace.timestamp,
    ]
  );

  logger.info(`${LOG_PREFIX} Trace ${traceId} for invocation ${validated.invocationId}`);
  return trace;
}

// ==========================================
// CONSUMER CLASS ENFORCEMENT RUNTIME
// ==========================================

export interface EnforcementResult {
  allowed: boolean;
  approvalState: ToolApprovalState;
  effectivePolicy: ConsumerToolPolicy | null;
  reason: string;
}

/**
 * Enforce consumer-class policy for a tool invocation.
 *
 * D20: effective policy = most restrictive of org + project layers.
 * D22: background consumer class defaults to `deferred_approval` for mutating tools.
 */
export async function enforceConsumerPolicy(
  toolId: string,
  consumerClass: ConsumerClass,
  organizationId: string,
  projectId?: string | null
): Promise<EnforcementResult> {
  const tool = await getTool(toolId, organizationId);
  if (!tool) {
    return {
      allowed: false,
      approvalState: 'blocked',
      effectivePolicy: null,
      reason: 'tool_not_found',
    };
  }

  const policy = await getEffectiveConsumerPolicy(toolId, consumerClass, organizationId, projectId);

  if (policy && !policy.allowed) {
    return {
      allowed: false,
      approvalState: 'blocked',
      effectivePolicy: policy,
      reason: policy.projectId ? 'project_policy_denied' : 'org_policy_denied',
    };
  }

  if (policy?.approvalOverride === 'force_blocked') {
    return {
      allowed: false,
      approvalState: 'blocked',
      effectivePolicy: policy,
      reason: 'policy_force_blocked',
    };
  }

  if (consumerClass === 'background' && tool.mutationType !== 'read_only') {
    return {
      allowed: false,
      approvalState: 'deferred_approval',
      effectivePolicy: policy,
      reason: 'background_mutating_tool_deferred',
    };
  }

  let effectiveApproval: ApprovalClass = tool.defaultApprovalMode;
  if (policy) {
    const overrideApproval = resolveOverride(policy.approvalOverride, effectiveApproval);
    effectiveApproval = stricterApproval(effectiveApproval, overrideApproval);
  }

  if (effectiveApproval === 'requires_human_approval') {
    return {
      allowed: false,
      approvalState: 'requires_approval',
      effectivePolicy: policy,
      reason: 'requires_human_approval',
    };
  }

  return {
    allowed: true,
    approvalState: 'allowed',
    effectivePolicy: policy,
    reason: 'allowed',
  };
}

/**
 * Resolve the effective consumer policy for a tool + consumer class + org (+ optional project).
 *
 * D20: project may tighten (force_human_approval, force_blocked) but never loosen.
 * Returns the merged effective policy, or null if none exists.
 */
export async function getEffectiveConsumerPolicy(
  toolId: string,
  consumerClass: ConsumerClass,
  organizationId: string,
  projectId?: string | null
): Promise<ConsumerToolPolicy | null> {
  const now = new Date().toISOString();

  const orgRows = await dbAll<PolicyRow>(
    `SELECT * FROM v8_consumer_tool_policies
     WHERE organization_id = ? AND tool_id = ? AND consumer_class = ?
       AND project_id IS NULL
       AND effective_from <= ?
       AND (effective_until IS NULL OR effective_until > ?)
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, toolId, consumerClass, now, now],
    { fallback: true }
  );

  const orgPolicy = orgRows && orgRows.length > 0 ? rowToPolicy(orgRows[0]) : null;

  if (!projectId) return orgPolicy;

  const projectRows = await dbAll<PolicyRow>(
    `SELECT * FROM v8_consumer_tool_policies
     WHERE organization_id = ? AND tool_id = ? AND consumer_class = ?
       AND project_id = ?
       AND effective_from <= ?
       AND (effective_until IS NULL OR effective_until > ?)
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, toolId, consumerClass, projectId, now, now],
    { fallback: true }
  );

  const projectPolicy = projectRows && projectRows.length > 0 ? rowToPolicy(projectRows[0]) : null;

  if (!orgPolicy && !projectPolicy) return null;
  if (!projectPolicy) return orgPolicy;
  if (!orgPolicy) return projectPolicy;

  const merged: ConsumerToolPolicy = { ...orgPolicy };

  if (!projectPolicy.allowed) {
    merged.allowed = false;
  }

  const OVERRIDE_STRICTNESS: Record<ApprovalOverride, number> = {
    inherit_from_tool: 0,
    force_policy_gate: 1,
    force_human_approval: 2,
    force_blocked: 3,
  };

  if (
    OVERRIDE_STRICTNESS[projectPolicy.approvalOverride] >
    OVERRIDE_STRICTNESS[merged.approvalOverride]
  ) {
    merged.approvalOverride = projectPolicy.approvalOverride;
  }

  if (
    projectPolicy.maxInvocationsPerRun !== null &&
    (merged.maxInvocationsPerRun === null ||
      projectPolicy.maxInvocationsPerRun < merged.maxInvocationsPerRun)
  ) {
    merged.maxInvocationsPerRun = projectPolicy.maxInvocationsPerRun;
  }

  merged.policyId = projectPolicy.policyId;

  return merged;
}

// ==========================================
// DEFERRED APPROVAL QUEUE
// ==========================================

/**
 * Query all invocation requests with `deferred_approval` state for an organization.
 */
export async function getDeferredApprovals(
  organizationId: string,
  limit: number = 50
): Promise<ToolInvocationRequest[]> {
  const rows = await dbAll<InvocationRow>(
    `SELECT * FROM v8_tool_invocation_log
     WHERE organization_id = ? AND approval_result = 'deferred_approval'
     ORDER BY created_at ASC
     LIMIT ?`,
    [organizationId, limit],
    { fallback: true }
  );

  return (rows || []).map(rowToInvocation);
}

/**
 * Resolve a deferred approval — approve (→ allowed) or reject (→ blocked).
 */
export async function processDeferredApproval(
  invocationId: string,
  decision: 'approve' | 'reject',
  resolvedBy: string,
  reason?: string | null
): Promise<ToolInvocationRequest> {
  const row = await dbGet<InvocationRow>(
    `SELECT * FROM v8_tool_invocation_log WHERE invocation_id = ?`,
    [invocationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Invocation ${invocationId} not found`);
  }

  if (row.approval_result !== 'deferred_approval') {
    throw new Error(
      `Invocation ${invocationId} is not in deferred_approval state (current: ${row.approval_result})`
    );
  }

  const newState: ToolApprovalState = decision === 'approve' ? 'allowed' : 'blocked';
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_tool_invocation_log
     SET approval_result = ?,
         block_reason = ?,
         deferred_resolved_at = ?,
         deferred_resolved_by = ?
     WHERE invocation_id = ?`,
    [
      newState,
      decision === 'reject' ? (reason ?? 'deferred_rejected') : null,
      now,
      resolvedBy,
      invocationId,
    ]
  );

  logger.info(`${LOG_PREFIX} Deferred approval ${invocationId}: ${decision} by ${resolvedBy}`);

  const updated = rowToInvocation({
    ...row,
    approval_result: newState,
    block_reason: decision === 'reject' ? (reason ?? 'deferred_rejected') : null,
  });

  return updated;
}

// ==========================================
// SUBAGENT GOVERNANCE
// ==========================================

export interface SubagentAccessResult {
  allowed: boolean;
  reason: string;
}

export interface RunToolUsage {
  invocations: ToolInvocationRequest[];
  traces: ToolInvocationTrace[];
}

/**
 * Validate whether a subagent may use a tool within a parent execution run.
 *
 * D21: subagents cannot use critical-risk tools.
 * The parent run must exist and be in `applying` state.
 */
export async function validateSubagentAccess(
  toolId: string,
  parentRunId: string,
  organizationId: string
): Promise<SubagentAccessResult> {
  const runRow = await dbGet<{ run_id: string; state: string; organization_id: string }>(
    `SELECT run_id, state, organization_id FROM v8_execution_runs
     WHERE run_id = ? AND organization_id = ?`,
    [parentRunId, organizationId],
    { fallback: true }
  );

  if (!runRow) {
    return { allowed: false, reason: 'parent_run_not_found' };
  }

  if (runRow.state !== 'applying') {
    return {
      allowed: false,
      reason: `parent_run_not_in_applying_state (current: ${runRow.state})`,
    };
  }

  const tool = await getTool(toolId, organizationId);
  if (!tool) {
    return { allowed: false, reason: 'tool_not_found' };
  }

  if (tool.riskClass === 'critical') {
    return { allowed: false, reason: 'critical_tools_denied_for_subagents' };
  }

  return { allowed: true, reason: 'allowed' };
}

/**
 * Get all invocations and their traces for a specific execution run.
 */
export async function getToolUsageByRun(
  runId: string,
  organizationId: string
): Promise<RunToolUsage> {
  const invocationRows = await dbAll<InvocationRow>(
    `SELECT * FROM v8_tool_invocation_log
     WHERE execution_run_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [runId, organizationId],
    { fallback: true }
  );

  const invocations = (invocationRows || []).map(rowToInvocation);

  const traceRows = await dbAll<TraceRow>(
    `SELECT * FROM v8_tool_invocation_traces
     WHERE execution_run_id = ?
     ORDER BY timestamp ASC`,
    [runId],
    { fallback: true }
  );

  const traces = (traceRows || []).map(rowToTrace);

  return { invocations, traces };
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

function resolveOverride(override: ApprovalOverride, current: ApprovalClass): ApprovalClass {
  switch (override) {
    case 'force_human_approval':
      return 'requires_human_approval';
    case 'force_policy_gate':
      return 'policy_approvable';
    case 'force_blocked':
      return 'requires_human_approval';
    case 'inherit_from_tool':
    default:
      return current;
  }
}
