import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { enforceConsumerPolicy } from './toolGovernanceService.js';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|system)\s+instructions?/iu,
  /(reveal|print|extract|exfiltrate).{0,40}(system\s+prompt|secret|api[_ -]?key)/iu,
  /(bypass|disable|skip|override).{0,40}(approval|policy|guardrail|authorization)/iu,
  /pretend\s+(you\s+are|to\s+be).{0,30}(admin|owner|system)/iu,
];

function canonicalInput(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalInput).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalInput(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function recordDecision(input: {
  organizationId: string;
  userId: string;
  agentId: string;
  toolId: string | null;
  toolName: string;
  projectId?: string | null;
  runId?: string | null;
  decision: 'allowed' | 'denied';
  reason: string;
  policyRef?: string | null;
  toolInput: Record<string, unknown>;
}): Promise<string> {
  const eventId = `agent-tool-event-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave8_agent_tool_governance_events
      (event_id, organization_id, user_id, agent_id, tool_id, tool_name, project_id, run_id,
       decision, reason, policy_ref, input_digest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      input.organizationId,
      input.userId,
      input.agentId,
      input.toolId,
      input.toolName,
      input.projectId || null,
      input.runId || null,
      input.decision,
      input.reason,
      input.policyRef || null,
      createHash('sha256').update(canonicalInput(input.toolInput)).digest('hex'),
    ]
  );
  return eventId;
}

export async function authorizeAgentToolExecution(input: {
  organizationId: string;
  userId: string;
  agentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  projectId?: string | null;
  runId?: string | null;
  preliminaryDenial?: string | null;
}): Promise<{ allowed: boolean; reason: string; eventId: string; toolId: string | null }> {
  const tool = await dbGet<{
    tool_id: string;
    classification_status: string;
  }>(
    `SELECT tool_id, classification_status FROM v8_tool_catalog
     WHERE organization_id = ? AND name = ? ORDER BY updated_at DESC LIMIT 1`,
    [input.organizationId, input.toolName]
  );
  let reason = input.preliminaryDenial || '';
  if (!reason && !tool) reason = 'tool_not_registered_in_governance_catalog';
  if (!reason && tool?.classification_status !== 'ratified') reason = 'tool_not_ratified';

  if (!reason && input.projectId) {
    const membership = await dbGet(
      `SELECT pm.user_id FROM project_members pm
       INNER JOIN projects p ON p.id = pm.project_id
       WHERE pm.project_id = ? AND pm.user_id = ? AND p.organization_id = ?`,
      [input.projectId, input.userId, input.organizationId]
    );
    if (!membership) reason = 'project_membership_required';
  }

  const serializedInput = canonicalInput(input.toolInput).normalize('NFKC');
  if (!reason && INJECTION_PATTERNS.some((pattern) => pattern.test(serializedInput))) {
    reason = 'prompt_injection_pattern_detected';
  }

  let policyRef: string | null = null;
  if (!reason && tool) {
    const enforcement = await enforceConsumerPolicy(
      tool.tool_id,
      'execution',
      input.organizationId,
      input.projectId
    );
    policyRef = enforcement.effectivePolicy?.policyId || null;
    if (!enforcement.allowed) reason = enforcement.reason;
    const limit = enforcement.effectivePolicy?.maxInvocationsPerRun;
    if (!reason && limit != null) {
      if (!input.runId) {
        reason = 'run_id_required_for_invocation_limit';
      } else {
        const usage = await dbGet<{ count: number }>(
          `SELECT COUNT(*) AS count FROM wave8_agent_tool_governance_events
           WHERE organization_id = ? AND run_id = ? AND tool_name = ? AND decision = 'allowed'`,
          [input.organizationId, input.runId, input.toolName]
        );
        if (Number(usage?.count || 0) >= limit) reason = 'tool_invocation_limit_exceeded';
      }
    }
  }

  const allowed = !reason;
  const finalReason = reason || 'central_governance_allowed';
  const eventId = await recordDecision({
    ...input,
    toolId: tool?.tool_id || null,
    decision: allowed ? 'allowed' : 'denied',
    reason: finalReason,
    policyRef,
  });
  return { allowed, reason: finalReason, eventId, toolId: tool?.tool_id || null };
}
