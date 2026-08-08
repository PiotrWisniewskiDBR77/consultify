import { v4 as uuidv4 } from 'uuid';

import {
  all as dbAll,
  get as dbGet,
  run as dbRun,
  transaction as dbTransaction,
} from '../../utils/DbPromise.js';
import { launchWave8Agent } from '../wave8AgentRuntimeService.js';
import { projectCanonicalRunAfterExternalTransition } from './agentCanonicalRunService.js';
import { revalidateCanonicalRunContextForWorker } from './agentContextGroundingService.js';
import {
  releaseAgentResource,
  reserveAgentResource,
  settleAgentResource,
} from './agentResourceGovernanceService.js';
import * as executionSpineService from './executionSpineService.js';

export type WorkGraphMode = 'sequential' | 'hierarchical' | 'router_parallel';

export interface BranchTaskDraft {
  key: string;
  specialistAgentId: string;
  title: string;
  objective: string;
  dependsOn?: string[];
  expectedOutputSchema?: Record<string, unknown>;
  toolScope?: string[];
  budget?: { maxTokens?: number; maxCostUsd?: number; timeoutSeconds?: number };
  maxAttempts?: number;
}

async function projectWorkGraphTransition(input: {
  graphId: string;
  organizationId: string;
  actorUserId: string;
  reason: string;
  executionRunId?: string;
}): Promise<void> {
  const executionRunId =
    input.executionRunId ||
    String(
      (
        await dbGet(
          `SELECT execution_run_id FROM v8_agent_work_graphs
            WHERE graph_id = ? AND organization_id = ?`,
          [input.graphId, input.organizationId]
        )
      )?.execution_run_id || ''
    );
  if (!executionRunId) throw new Error('work_graph_not_found');
  await projectCanonicalRunAfterExternalTransition({
    canonicalRunId: executionRunId,
    organizationId: input.organizationId,
    aliasType: 'work_graph',
    externalId: input.graphId,
    actorUserId: input.actorUserId,
    reason: input.reason,
  });
}

function assertAcyclic(tasks: BranchTaskDraft[]): void {
  const keys = new Set(tasks.map((task) => task.key));
  if (keys.size !== tasks.length) throw new Error('duplicate_branch_task_key');
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const visit = (key: string): void => {
    if (visiting.has(key)) throw new Error('circular_branch_dependency');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)?.dependsOn || []) {
      if (!keys.has(dependency)) throw new Error(`unknown_branch_dependency:${dependency}`);
      visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
  };
  tasks.forEach((task) => visit(task.key));
}

export async function createWorkGraph(input: {
  executionRunId: string;
  organizationId: string;
  leadAgentId: string;
  createdBy: string;
  mode: WorkGraphMode;
  budget?: Record<string, unknown>;
  tasks: BranchTaskDraft[];
  runtimeBundle?: Record<string, unknown>;
  runtimeBundleDigest?: string;
  sourceTemplateRef?: { templateId: string; version: number };
}): Promise<{ graphId: string; taskIds: Record<string, string> }> {
  if (input.tasks.length === 0) throw new Error('branch_tasks_required');
  assertAcyclic(input.tasks);
  const graphBudget = input.budget || {};
  const taskTokenBudget = input.tasks.reduce(
    (sum, task) => sum + Number(task.budget?.maxTokens || 0),
    0
  );
  const taskCostBudget = input.tasks.reduce(
    (sum, task) => sum + Number(task.budget?.maxCostUsd || 0),
    0
  );
  if (Number(graphBudget.maxTokens || 0) > 0 && taskTokenBudget > Number(graphBudget.maxTokens)) {
    throw new Error('branch_token_budget_exceeds_graph_budget');
  }
  if (Number(graphBudget.maxCostUsd || 0) > 0 && taskCostBudget > Number(graphBudget.maxCostUsd)) {
    throw new Error('branch_cost_budget_exceeds_graph_budget');
  }
  if (
    Number(graphBudget.maxTokens || 0) > 0 &&
    input.tasks.some((task) => !Number(task.budget?.maxTokens || 0))
  ) {
    throw new Error('graph_token_budget_requires_branch_allocations');
  }
  if (
    Number(graphBudget.maxCostUsd || 0) > 0 &&
    input.tasks.some((task) => task.budget?.maxCostUsd == null)
  ) {
    throw new Error('graph_cost_budget_requires_branch_allocations');
  }
  const graphId = `graph-${uuidv4()}`;
  const taskIds = Object.fromEntries(input.tasks.map((task) => [task.key, `branch-${uuidv4()}`]));
  const statements = [
    {
      sql: `INSERT INTO v8_agent_work_graphs
      (graph_id, execution_run_id, organization_id, lead_agent_id, mode, status, budget_json, created_by,
       runtime_bundle_json, runtime_bundle_digest, source_template_ref_json)
     VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?)`,
      params: [
        graphId,
        input.executionRunId,
        input.organizationId,
        input.leadAgentId,
        input.mode,
        JSON.stringify(input.budget || {}),
        input.createdBy,
        input.runtimeBundle ? JSON.stringify(input.runtimeBundle) : null,
        input.runtimeBundleDigest || null,
        input.sourceTemplateRef ? JSON.stringify(input.sourceTemplateRef) : null,
      ],
    },
    ...input.tasks.map((task) => ({
      sql: `INSERT INTO v8_agent_branch_tasks
        (task_id, graph_id, organization_id, specialist_agent_id, title, objective,
         expected_output_schema_json, dependencies_json, tool_scope_json, budget_json, status, max_attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      params: [
        taskIds[task.key],
        graphId,
        input.organizationId,
        task.specialistAgentId,
        task.title,
        task.objective,
        JSON.stringify(task.expectedOutputSchema || {}),
        JSON.stringify((task.dependsOn || []).map((key) => taskIds[key])),
        JSON.stringify(task.toolScope || []),
        JSON.stringify(task.budget || {}),
        Math.max(1, Math.min(Number(task.maxAttempts || 3), 10)),
      ],
    })),
  ];
  const result = await dbTransaction(statements);
  if (!result.success) {
    throw new Error(`work_graph_transaction_failed:${result.error || 'unknown'}`);
  }
  await projectWorkGraphTransition({
    graphId,
    organizationId: input.organizationId,
    actorUserId: input.createdBy,
    reason: 'Multi-agent work graph created in planned state.',
    executionRunId: input.executionRunId,
  });
  return { graphId, taskIds };
}

export async function claimReadyBranchTasks(input: {
  graphId: string;
  organizationId: string;
  workerId: string;
  limit?: number;
  now?: string;
}): Promise<any[]> {
  const canonicalBinding = await dbGet(
    `SELECT g.execution_run_id, i.transformation_case_id
       FROM v8_agent_work_graphs g
       LEFT JOIN v8_agent_run_identities i
         ON i.canonical_run_id = g.execution_run_id
        AND i.organization_id = g.organization_id
      WHERE g.graph_id = ? AND g.organization_id = ?`,
    [input.graphId, input.organizationId]
  );
  if (!canonicalBinding) throw new Error('work_graph_not_found');
  if (canonicalBinding.transformation_case_id) {
    const contextDecision = await revalidateCanonicalRunContextForWorker({
      canonicalRunId: canonicalBinding.execution_run_id,
      organizationId: input.organizationId,
      actorUserId: input.workerId,
      workerKind: 'work_graph_branch',
      externalId: input.graphId,
    });
    if (contextDecision.decision !== 'allowed') {
      await dbRun(
        `UPDATE v8_agent_work_graphs
            SET status = 'blocked', synthesis_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE graph_id = ? AND organization_id = ? AND status IN ('planned', 'running', 'blocked')`,
        [
          JSON.stringify({
            contextGate: {
              decision: contextDecision.decision,
              reason: contextDecision.reason,
              revalidationId: contextDecision.revalidationId,
            },
          }),
          input.graphId,
          input.organizationId,
        ]
      );
      return [];
    }
  }
  await propagateFailedDependencies(input.graphId, input.organizationId);
  const now = input.now || new Date().toISOString();
  const leaseUntil = new Date(Date.parse(now) + 5 * 60_000).toISOString();
  const rows = await dbAll(
    `SELECT * FROM v8_agent_branch_tasks WHERE graph_id = ? AND organization_id = ?
       AND status = 'pending' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
     ORDER BY created_at ASC LIMIT ?`,
    [input.graphId, input.organizationId, now, input.limit || 8]
  );
  const completed = new Set(
    (
      await dbAll(
        `SELECT task_id FROM v8_agent_branch_tasks WHERE graph_id = ? AND organization_id = ? AND status = 'completed'`,
        [input.graphId, input.organizationId]
      )
    ).map((row: any) => row.task_id)
  );
  const claimed: any[] = [];
  for (const row of rows) {
    const dependencies = JSON.parse(row.dependencies_json || '[]') as string[];
    if (!dependencies.every((dependency) => completed.has(dependency))) continue;
    const result = await dbRun(
      `UPDATE v8_agent_branch_tasks SET status = 'running', lease_owner = ?, lease_expires_at = ?,
         attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ? AND organization_id = ? AND status = 'pending' AND attempt_count < max_attempts
         AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
      [input.workerId, leaseUntil, row.task_id, input.organizationId, now]
    );
    if (Number(result.changes || 0) === 1)
      claimed.push({ ...row, status: 'running', lease_owner: input.workerId });
  }
  if (claimed.length > 0) {
    await dbRun(
      `UPDATE v8_agent_work_graphs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE graph_id = ? AND organization_id = ?`,
      [input.graphId, input.organizationId]
    );
    await projectWorkGraphTransition({
      graphId: input.graphId,
      organizationId: input.organizationId,
      actorUserId: input.workerId,
      reason: 'Multi-agent work graph transitioned to running.',
    });
  }
  return claimed;
}

async function propagateFailedDependencies(graphId: string, organizationId: string): Promise<void> {
  const tasks = await dbAll(
    `SELECT task_id, status, dependencies_json FROM v8_agent_branch_tasks WHERE graph_id = ? AND organization_id = ?`,
    [graphId, organizationId]
  );
  const failed = new Set(
    tasks
      .filter((task: any) => ['failed', 'cancelled'].includes(task.status))
      .map((task: any) => task.task_id)
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks as any[]) {
      if (task.status !== 'pending') continue;
      const dependency = (JSON.parse(task.dependencies_json || '[]') as string[]).find((id) =>
        failed.has(id)
      );
      if (!dependency) continue;
      const result = await dbRun(
        `UPDATE v8_agent_branch_tasks SET status = 'cancelled', error_text = ?, updated_at = CURRENT_TIMESTAMP
         WHERE task_id = ? AND organization_id = ? AND status = 'pending'`,
        [`dependency_failed:${dependency}`, task.task_id, organizationId]
      );
      if (Number(result.changes || 0) === 1) {
        task.status = 'cancelled';
        failed.add(task.task_id);
        changed = true;
      }
    }
  }
}

export async function completeBranchTask(input: {
  taskId: string;
  organizationId: string;
  workerId: string;
  output: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  confidence: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
    source: string;
  };
}): Promise<void> {
  if (input.confidence < 0 || input.confidence > 1) throw new Error('invalid_branch_confidence');
  if (input.evidence.length === 0) throw new Error('branch_evidence_required');
  const current = await dbGet(
    `SELECT budget_json FROM v8_agent_branch_tasks WHERE task_id = ? AND organization_id = ? AND status = 'running' AND lease_owner = ?`,
    [input.taskId, input.organizationId, input.workerId]
  );
  if (!current) throw new Error('branch_lease_not_owned');
  const budget = JSON.parse(current.budget_json || '{}') as {
    maxTokens?: number;
    maxCostUsd?: number;
  };
  const usage = input.usage || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    durationMs: 0,
    source: 'not_reported',
  };
  if (Number(budget.maxTokens || 0) > 0 && usage.totalTokens > Number(budget.maxTokens)) {
    throw new Error(`branch_token_budget_exceeded:${usage.totalTokens}:${budget.maxTokens}`);
  }
  if (budget.maxCostUsd != null && usage.costUsd > Number(budget.maxCostUsd)) {
    throw new Error(`branch_cost_budget_exceeded:${usage.costUsd}:${budget.maxCostUsd}`);
  }
  const result = await dbRun(
    `UPDATE v8_agent_branch_tasks SET status = 'completed', output_json = ?, evidence_json = ?, confidence = ?, usage_json = ?,
       lease_owner = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND organization_id = ? AND status = 'running' AND lease_owner = ?`,
    [
      JSON.stringify(input.output),
      JSON.stringify(input.evidence),
      input.confidence,
      JSON.stringify(usage),
      input.taskId,
      input.organizationId,
      input.workerId,
    ]
  );
  if (Number(result.changes || 0) !== 1) throw new Error('branch_lease_not_owned');
}

export async function failBranchTask(input: {
  taskId: string;
  organizationId: string;
  workerId: string;
  error: string;
}): Promise<void> {
  const result = await dbRun(
    `UPDATE v8_agent_branch_tasks SET status = 'failed', error_text = ?,
       lease_owner = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND organization_id = ? AND status = 'running' AND lease_owner = ?`,
    [input.error.slice(0, 4000), input.taskId, input.organizationId, input.workerId]
  );
  if (Number(result.changes || 0) !== 1) throw new Error('branch_lease_not_owned');
}

export async function retryBranchTask(input: {
  taskId: string;
  organizationId: string;
}): Promise<void> {
  const result = await dbRun(
    `UPDATE v8_agent_branch_tasks SET status = 'pending', error_text = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND organization_id = ? AND status = 'failed' AND attempt_count < max_attempts`,
    [input.taskId, input.organizationId]
  );
  if (Number(result.changes || 0) !== 1) throw new Error('branch_retry_not_allowed');
}

export async function cancelWorkGraph(input: {
  graphId: string;
  organizationId: string;
  actorUserId?: string;
}): Promise<void> {
  const running = await dbGet<{ count: number }>(
    `SELECT COUNT(*) AS count FROM v8_agent_branch_tasks WHERE graph_id = ? AND organization_id = ? AND status = 'running'`,
    [input.graphId, input.organizationId]
  );
  if (Number(running?.count || 0) > 0) throw new Error('work_graph_has_running_branches');
  const graphResult = await dbRun(
    `UPDATE v8_agent_work_graphs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE graph_id = ? AND organization_id = ? AND status NOT IN ('completed', 'cancelled')`,
    [input.graphId, input.organizationId]
  );
  if (Number(graphResult.changes || 0) !== 1) throw new Error('work_graph_cancel_not_allowed');
  await dbRun(
    `UPDATE v8_agent_branch_tasks SET status = 'cancelled', error_text = 'graph_cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE graph_id = ? AND organization_id = ? AND status IN ('pending', 'failed')`,
    [input.graphId, input.organizationId]
  );
  await projectWorkGraphTransition({
    graphId: input.graphId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId || 'system:work-graph',
    reason: 'Multi-agent work graph cancelled.',
  });
}

export async function executeReadyWorkGraphBranches(input: {
  graphId: string;
  organizationId: string;
  userId: string;
  workerId: string;
  limit?: number;
}): Promise<
  Array<{ taskId: string; status: 'completed' | 'failed'; runId?: string; error?: string }>
> {
  const graph = await dbGet(
    `SELECT g.execution_run_id, c.project_id
       FROM v8_agent_work_graphs g
       LEFT JOIN transformation_cases c
         ON c.execution_run_id = g.execution_run_id AND c.organization_id = g.organization_id
      WHERE g.graph_id = ? AND g.organization_id = ?`,
    [input.graphId, input.organizationId]
  );
  if (!graph?.execution_run_id) throw new Error('work_graph_not_found');
  if (!graph.project_id) throw new Error('work_graph_resource_project_scope_missing');
  const claimed = await claimReadyBranchTasks(input);
  return Promise.all(
    claimed.map(async (task: any) => {
      const taskId = String(task.task_id);
      let resourceReservation:
        | Awaited<ReturnType<typeof reserveAgentResource>>
        | null = null;
      try {
        const budget = JSON.parse(task.budget_json || '{}') as { timeoutSeconds?: number };
        const requestedTools = JSON.parse(task.tool_scope_json || '[]') as string[];
        const timeoutMs =
          Math.max(1, Math.min(Number(budget.timeoutSeconds || 900), 86_400)) * 1000;
        resourceReservation = await reserveAgentResource({
          organizationId: input.organizationId,
          projectId: String(graph.project_id),
          runId: String(graph.execution_run_id),
          userId: input.userId,
          agentId: String(task.specialist_agent_id),
          toolName: 'work_graph.branch.launch',
          idempotencyKey: `work-graph:${graph.execution_run_id}:${input.graphId}:${taskId}:attempt:${Number(task.attempt_count || 1)}`,
          // A08 owns branch token/cost accounting. This reservation contributes
          // concurrency only; any nested Wave8 tool call is metered separately.
          estimatedCostUsd: 0,
        });
        if (!resourceReservation.allowed) {
          throw new Error(`work_graph_resource_denied:${resourceReservation.reason}`);
        }
        if (resourceReservation.idempotentReplay) {
          throw new Error(
            resourceReservation.status === 'settled'
              ? 'work_graph_resource_attempt_already_settled'
              : 'work_graph_resource_attempt_in_progress'
          );
        }
        const execution = launchWave8Agent({
          organizationId: input.organizationId,
          userId: input.userId,
          canonicalRunId: String(graph.execution_run_id),
          agentId: String(task.specialist_agent_id),
          goal: String(task.objective),
          requestedTools,
        });
        const result = await Promise.race([
          execution,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(() => reject(new Error('branch_timeout')), timeoutMs);
            timer.unref?.();
          }),
        ]);
        if (!result.allowed || !result.run?.runId) {
          throw new Error(
            String(
              result.error || result.run?.audit?.toolDecision?.reason || 'branch_execution_blocked'
            )
          );
        }
        await completeBranchTask({
          taskId,
          organizationId: input.organizationId,
          workerId: input.workerId,
          output: result.run.output || {},
          evidence: [
            { type: 'wave8_agent_run', ref: result.run.runId, schemaValid: result.run.schemaValid },
          ],
          confidence: result.run.schemaValid ? 0.85 : 0.5,
          usage: result.run.audit?.telemetry?.usage,
        });
        await settleAgentResource({
          reservationId: resourceReservation.reservationId,
          organizationId: input.organizationId,
          projectId: String(graph.project_id),
        });
        return { taskId, status: 'completed' as const, runId: result.run.runId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          resourceReservation?.allowed &&
          !resourceReservation.idempotentReplay &&
          resourceReservation.status === 'reserved'
        ) {
          await releaseAgentResource({
            reservationId: resourceReservation.reservationId,
            organizationId: input.organizationId,
            projectId: String(graph.project_id),
            reason: `work_graph_branch_failed:${message}`,
          }).catch(() => undefined);
        }
        await failBranchTask({
          taskId,
          organizationId: input.organizationId,
          workerId: input.workerId,
          error: message,
        });
        return { taskId, status: 'failed' as const, error: message };
      }
    })
  );
}

export async function getWorkGraph(graphId: string, organizationId: string): Promise<any> {
  const graph = await dbGet(
    `SELECT * FROM v8_agent_work_graphs WHERE graph_id = ? AND organization_id = ?`,
    [graphId, organizationId]
  );
  if (!graph) return null;
  const tasks = await dbAll(
    `SELECT * FROM v8_agent_branch_tasks WHERE graph_id = ? AND organization_id = ? ORDER BY created_at`,
    [graphId, organizationId]
  );
  return { graph, tasks };
}

export interface BranchClaim {
  key: string;
  value: unknown;
  evidenceRefs?: string[];
}

export async function synthesizeWorkGraph(input: {
  graphId: string;
  organizationId: string;
}): Promise<{ status: 'completed' | 'blocked'; outputs: unknown[]; contradictions: unknown[] }> {
  const graph = await getWorkGraph(input.graphId, input.organizationId);
  if (!graph) throw new Error('work_graph_not_found');
  if (graph.tasks.some((task: any) => task.status !== 'completed')) {
    throw new Error('work_graph_branches_incomplete');
  }

  const outputs = graph.tasks.map((task: any) => ({
    taskId: task.task_id,
    specialistAgentId: task.specialist_agent_id,
    confidence: task.confidence,
    evidence: JSON.parse(task.evidence_json || '[]'),
    output: JSON.parse(task.output_json || '{}'),
  }));
  const claims = new Map<string, Array<{ taskId: string; value: unknown }>>();
  for (const branch of outputs) {
    const branchClaims = Array.isArray((branch.output as any)?.claims)
      ? ((branch.output as any).claims as BranchClaim[])
      : [];
    for (const claim of branchClaims) {
      if (!claim?.key) continue;
      const entries = claims.get(claim.key) || [];
      entries.push({ taskId: branch.taskId, value: claim.value });
      claims.set(claim.key, entries);
    }
  }
  const contradictions = [...claims.entries()]
    .filter(([, entries]) => new Set(entries.map((entry) => JSON.stringify(entry.value))).size > 1)
    .map(([key, entries]) => ({ key, entries, resolution: 'human_or_lead_review_required' }));
  const status = contradictions.length > 0 ? 'blocked' : 'completed';
  await dbRun(
    `UPDATE v8_agent_work_graphs SET status = ?, synthesis_json = ?, contradictions_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE graph_id = ? AND organization_id = ?`,
    [
      status,
      JSON.stringify({ outputs }),
      JSON.stringify(contradictions),
      input.graphId,
      input.organizationId,
    ]
  );
  await projectWorkGraphTransition({
    graphId: input.graphId,
    organizationId: input.organizationId,
    actorUserId: 'system:work-graph-synthesis',
    reason: `Multi-agent work graph synthesis produced status ${status}.`,
  });
  return { status, outputs, contradictions };
}

export async function resolveWorkGraphContradiction(input: {
  graphId: string;
  organizationId: string;
  actorUserId: string;
  claimKey: string;
  resolutionType: 'choose_branch' | 'human_judgement';
  sourceTaskId?: string;
  selectedValue: unknown;
  rationale: string;
}): Promise<{ graphStatus: 'blocked' | 'completed'; unresolvedCount: number }> {
  const graph = await dbGet(
    `SELECT * FROM v8_agent_work_graphs WHERE graph_id = ? AND organization_id = ?`,
    [input.graphId, input.organizationId]
  );
  if (!graph) throw new Error('work_graph_not_found');
  if (graph.status !== 'blocked') throw new Error(`work_graph_not_blocked:${graph.status}`);
  const contradictions = JSON.parse(graph.contradictions_json || '[]') as Array<{
    key: string;
    entries: Array<{ taskId: string; value: unknown }>;
  }>;
  const contradiction = contradictions.find((item) => item.key === input.claimKey);
  if (!contradiction) throw new Error('contradiction_not_found');
  if (!input.rationale.trim()) throw new Error('contradiction_rationale_required');
  if (input.resolutionType === 'choose_branch') {
    const source = contradiction.entries.find((entry) => entry.taskId === input.sourceTaskId);
    if (!source) throw new Error('contradiction_source_branch_not_found');
    if (JSON.stringify(source.value) !== JSON.stringify(input.selectedValue)) {
      throw new Error('contradiction_selected_value_mismatch');
    }
  }
  const resolutionId = `resolution-${uuidv4()}`;
  const existingResolutions = await dbAll(
    `SELECT * FROM v8_agent_contradiction_resolutions WHERE graph_id = ? AND organization_id = ? ORDER BY resolved_at`,
    [input.graphId, input.organizationId]
  );
  if (existingResolutions.some((row: any) => row.claim_key === input.claimKey)) {
    throw new Error('contradiction_already_resolved');
  }
  const resolvedAt = new Date().toISOString();
  const resolutions = [
    ...existingResolutions,
    {
      resolution_id: resolutionId,
      claim_key: input.claimKey,
      resolution_type: input.resolutionType,
      source_task_id: input.sourceTaskId || null,
      selected_value_json: JSON.stringify(input.selectedValue),
      rationale: input.rationale.trim(),
      resolved_by: input.actorUserId,
      resolved_at: resolvedAt,
    },
  ];
  const resolvedKeys = new Set(resolutions.map((row: any) => row.claim_key));
  const unresolvedCount = contradictions.filter((item) => !resolvedKeys.has(item.key)).length;
  const graphStatus = unresolvedCount === 0 ? 'completed' : 'blocked';
  const synthesis = JSON.parse(graph.synthesis_json || '{}') as Record<string, unknown>;
  const resolutionAudit = resolutions.map((row: any) => ({
    resolutionId: row.resolution_id,
    claimKey: row.claim_key,
    resolutionType: row.resolution_type,
    sourceTaskId: row.source_task_id || null,
    selectedValue: JSON.parse(row.selected_value_json),
    rationale: row.rationale,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
  }));
  const transactionResult = await dbTransaction([
    {
      sql: `INSERT INTO v8_agent_contradiction_resolutions
        (resolution_id, graph_id, organization_id, claim_key, resolution_type, source_task_id,
         selected_value_json, rationale, resolved_by, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        resolutionId,
        input.graphId,
        input.organizationId,
        input.claimKey,
        input.resolutionType,
        input.sourceTaskId || null,
        JSON.stringify(input.selectedValue),
        input.rationale.trim(),
        input.actorUserId,
        resolvedAt,
      ],
    },
    {
      sql: `UPDATE v8_agent_work_graphs SET status = ?, synthesis_json = ?, contradictions_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE graph_id = ? AND organization_id = ? AND status = 'blocked'`,
      params: [
        graphStatus,
        JSON.stringify({ ...synthesis, resolutions: resolutionAudit }),
        JSON.stringify(
          contradictions.map((item) => ({
            ...item,
            resolution:
              resolutionAudit.find((resolution) => resolution.claimKey === item.key) ||
              'human_or_lead_review_required',
          }))
        ),
        input.graphId,
        input.organizationId,
      ],
    },
  ]);
  if (!transactionResult.success) throw new Error('contradiction_resolution_conflict');
  await projectWorkGraphTransition({
    graphId: input.graphId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    reason: `Multi-agent contradiction resolved; graph status is ${graphStatus}.`,
  });
  return { graphStatus, unresolvedCount };
}

export async function proposeWorkGraphSynthesis(input: {
  graphId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<{ proposalId: string; runState: 'waiting_for_review' }> {
  const workGraph = await getWorkGraph(input.graphId, input.organizationId);
  if (!workGraph) throw new Error('work_graph_not_found');
  if (workGraph.graph.status !== 'completed') throw new Error('work_graph_not_synthesized');
  if (workGraph.graph.synthesis_proposal_id)
    throw new Error('work_graph_synthesis_already_proposed');
  const runId = String(workGraph.graph.execution_run_id);
  const run = await executionSpineService.getRun(runId, input.organizationId);
  if (!run) throw new Error('execution_run_not_found');
  if (run.state !== 'planning') throw new Error(`execution_run_not_planning:${run.state}`);
  const synthesis = JSON.parse(workGraph.graph.synthesis_json || '{}') as Record<string, unknown>;
  const proposal = await executionSpineService.createProposal({
    executionRunId: runId,
    contextSnapshotRef: run.contextSnapshotId,
    proposalType: 'generate_structured_output',
    targetRef: {
      artifactId: input.graphId,
      artifactType: 'multi_agent_synthesis',
      artifactModule: 'agent',
      relationship: 'target',
    },
    summary: 'Review multi-agent synthesis',
    reason: 'Specialist results require one accountable human review before downstream execution.',
    mutationDescription: {
      operation: 'create',
      targetFields: null,
      payloadSummary: { graphId: input.graphId },
      reversibility: 'reversible',
      estimatedImpact:
        'Creates a reviewed synthesis; no downstream mutation is applied by this proposal.',
    },
    riskClass: 'sensitive_update',
    approvalClass: 'requires_human_approval',
    previewPayload: {
      diff: null,
      beforeState: null,
      afterState: synthesis,
      createdObjects: ['multi_agent_synthesis'],
      updatedFields: [],
      destructiveImpact: null,
      followupEffects: ['Approved synthesis may unlock separately governed downstream proposals.'],
    },
  });
  await executionSpineService.transitionRunState(
    runId,
    input.organizationId,
    'proposals_ready',
    input.actorUserId,
    'Multi-agent synthesis ready for review'
  );
  await executionSpineService.submitForReview(runId, input.organizationId, input.actorUserId);
  await dbRun(
    `UPDATE v8_agent_work_graphs SET synthesis_proposal_id = ?, updated_at = CURRENT_TIMESTAMP WHERE graph_id = ? AND organization_id = ?`,
    [proposal.proposalId, input.graphId, input.organizationId]
  );
  return { proposalId: proposal.proposalId, runState: 'waiting_for_review' };
}
