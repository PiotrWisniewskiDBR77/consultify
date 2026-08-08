import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';

export interface GroundingCandidate {
  sourceRef: string;
  artifactId: string;
  module: string;
  projectId: string | null;
  content: string;
  relevance: number;
}

export interface GroundingPolicy {
  allowedModules: string[];
  allowedArtifactIds: string[];
  projectId: string | null;
  maxResults: number;
  maxWorkingMemoryChars: number;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function policyFirstRank(
  candidates: GroundingCandidate[],
  policy: GroundingPolicy
): { admitted: GroundingCandidate[]; denied: Array<GroundingCandidate & { reason: string }> } {
  const denied: Array<GroundingCandidate & { reason: string }> = [];
  const admitted = candidates.filter((candidate) => {
    let reason = '';
    if (!policy.allowedModules.includes(candidate.module)) reason = 'module_not_allowed';
    else if (
      policy.allowedArtifactIds.length > 0 &&
      !policy.allowedArtifactIds.includes(candidate.artifactId)
    )
      reason = 'artifact_not_allowed';
    else if (policy.projectId && candidate.projectId !== policy.projectId)
      reason = 'project_scope_mismatch';
    if (reason) denied.push({ ...candidate, reason });
    return !reason;
  });
  return {
    admitted: admitted.sort((a, b) => b.relevance - a.relevance).slice(0, policy.maxResults),
    denied,
  };
}

export function boundWorkingMemory(
  candidates: GroundingCandidate[],
  maxChars: number
): GroundingCandidate[] {
  const selected: GroundingCandidate[] = [];
  let used = 0;
  for (const candidate of candidates) {
    if (used + candidate.content.length > maxChars) continue;
    selected.push(candidate);
    used += candidate.content.length;
  }
  return selected;
}

export async function revalidateTransformationContext(input: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  policy: GroundingPolicy;
  candidates: GroundingCandidate[];
  retrievalFailureReason?: string;
  client?: PgTransactionClient;
}) {
  const get = async <T>(sql: string, params: unknown[]): Promise<T | undefined> =>
    input.client
      ? (await input.client.query<T>(sql, params)).rows[0]
      : ((await dbGet<T>(sql, params)) ?? undefined);
  const run = async (sql: string, params: unknown[]): Promise<void> => {
    if (input.client) await input.client.query(sql, params);
    else await dbRun(sql, params);
  };
  const row = await get<any>(
    `SELECT c.execution_run_id, c.context_snapshot_id, c.project_id, s.organization_id AS snapshot_org,
            s.project_id AS snapshot_project, s.source_context_refs, s.drift_events
       FROM transformation_cases c
       LEFT JOIN v8_context_snapshots s ON s.snapshot_id = c.context_snapshot_id
      WHERE c.transformation_case_id = ? AND c.organization_id = ?`,
    [input.transformationCaseId, input.organizationId]
  );
  if (!row || !row.context_snapshot_id || row.snapshot_org !== input.organizationId) {
    return persistDecision(
      input,
      row,
      'blocked_snapshot',
      'Snapshot missing or tenant mismatch',
      [],
      [],
      run
    );
  }
  const drift = parseArray(row.drift_events);
  const sources = parseArray(row.source_context_refs);
  const scopedProject = input.policy.projectId ?? row.project_id;
  if (row.snapshot_project && scopedProject && row.snapshot_project !== scopedProject) {
    return persistDecision(
      input,
      row,
      'blocked_scope',
      'Project scope changed since capture',
      drift,
      sources,
      run
    );
  }
  if (drift.length > 0) {
    return persistDecision(
      input,
      row,
      'blocked_drift',
      'Context drift requires a new snapshot',
      drift,
      sources,
      run
    );
  }
  if (input.retrievalFailureReason) {
    return persistDecision(
      input,
      row,
      'blocked_snapshot',
      `Production retrieval failed: ${input.retrievalFailureReason}`,
      drift,
      sources,
      run
    );
  }
  const ranked = policyFirstRank(input.candidates, { ...input.policy, projectId: scopedProject });
  const memory = boundWorkingMemory(ranked.admitted, input.policy.maxWorkingMemoryChars);
  const decision = await persistDecision(
    input,
    row,
    'allowed',
    'Context and policy revalidated',
    drift,
    sources,
    run
  );
  for (const candidate of memory) {
    await run(
      `INSERT INTO v8_agent_working_memory_bindings
        (binding_id, canonical_run_id, organization_id, memory_entry_id, source_ref, content_digest, char_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (canonical_run_id, memory_entry_id) DO NOTHING`,
      [
        uuidv4(),
        row.execution_run_id,
        input.organizationId,
        candidate.artifactId,
        candidate.sourceRef,
        digest(candidate.content),
        candidate.content.length,
      ]
    );
  }
  return { ...decision, admitted: memory, denied: ranked.denied };
}

/**
 * Worker-boundary gate for an already registered canonical run. Scheduled
 * workers must not trust tenant/case identifiers supplied by a queue payload;
 * ownership is resolved from the canonical identity and then revalidated
 * against the current snapshot. No retrieval candidates are admitted here:
 * this gate proves freshness before execution, while retrieval remains the
 * responsibility of the governed retrieval path.
 */
export async function revalidateCanonicalRunContextForWorker(input: {
  canonicalRunId: string;
  organizationId: string;
  actorUserId: string;
  workerKind: 'wave8_schedule' | 'agent_plan_scheduler' | 'work_graph_branch';
  externalId: string;
}): Promise<Awaited<ReturnType<typeof revalidateTransformationContext>>> {
  const identity = await dbGet<{
    transformation_case_id: string;
    project_id: string | null;
  }>(
    `SELECT i.transformation_case_id, c.project_id
       FROM v8_agent_run_identities i
       JOIN transformation_cases c
         ON c.transformation_case_id = i.transformation_case_id
        AND c.execution_run_id = i.canonical_run_id
        AND c.organization_id = i.organization_id
      WHERE i.canonical_run_id = ? AND i.organization_id = ?`,
    [input.canonicalRunId, input.organizationId]
  );
  if (!identity) {
    return {
      revalidationId: uuidv4(),
      decision: 'blocked_snapshot' as const,
      reason: 'Canonical run identity missing or tenant mismatch',
      canonicalRunId: input.canonicalRunId,
      snapshotId: 'missing',
      sourceDigest: digest([]),
      policyDigest: digest({ workerKind: input.workerKind, externalId: input.externalId }),
      drift: [],
    };
  }
  return revalidateTransformationContext({
    transformationCaseId: identity.transformation_case_id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    policy: {
      allowedModules: [],
      allowedArtifactIds: [],
      projectId: identity.project_id,
      maxResults: 0,
      maxWorkingMemoryChars: 0,
    },
    candidates: [],
  });
}

async function persistDecision(
  input: {
    transformationCaseId: string;
    organizationId: string;
    actorUserId: string;
    policy: GroundingPolicy;
  },
  row: any,
  decision: 'allowed' | 'blocked_drift' | 'blocked_scope' | 'blocked_snapshot',
  reason: string,
  drift: unknown[],
  sources: unknown[],
  run: (sql: string, params: unknown[]) => Promise<void>
) {
  const result = {
    revalidationId: uuidv4(),
    decision,
    reason,
    canonicalRunId: row?.execution_run_id ?? 'missing',
    snapshotId: row?.context_snapshot_id ?? 'missing',
    sourceDigest: digest(sources),
    policyDigest: digest(input.policy),
    drift,
  };
  if (row?.execution_run_id)
    await run(
      `INSERT INTO v8_agent_context_revalidations
      (revalidation_id, canonical_run_id, organization_id, transformation_case_id, snapshot_id,
       decision, reason, source_digest, policy_digest, drift_json, checked_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      [
        result.revalidationId,
        result.canonicalRunId,
        input.organizationId,
        input.transformationCaseId,
        result.snapshotId,
        decision,
        reason,
        result.sourceDigest,
        result.policyDigest,
        JSON.stringify(drift),
        input.actorUserId,
      ]
    );
  return result;
}

function parseArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getContextRevalidationHistory(
  canonicalRunId: string,
  organizationId: string
) {
  return dbAll(
    `SELECT * FROM v8_agent_context_revalidations WHERE canonical_run_id = ? AND organization_id = ? ORDER BY created_at`,
    [canonicalRunId, organizationId]
  );
}
