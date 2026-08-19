import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction, type PgTransactionClient } from '../../utils/queryHelpers.js';

type LegacyLink = {
  link_id: string;
  organization_id: string;
  initiative_id: string;
  case_id: string;
  project_id: string;
  status: string;
  version: number;
};

type AliasCandidate = {
  legacy_execution_link_id: string;
  legacy_initiative_id: string;
  legacy_case_id: string;
  canonical_execution_link_id: string | null;
  canonical_project_id: string | null;
};

export type ExecutionSpineDisposition = {
  legacyExecutionLinkId: string;
  legacyInitiativeId: string;
  legacyCaseId: string;
  projectId: string;
  sourceDigest: string;
  outcome: 'MAPPED' | 'QUARANTINED';
  canonicalExecutionLinkId?: string;
  reasonCode?:
    | 'NO_RUNTIME_V1_IDENTITY'
    | 'AMBIGUOUS_RUNTIME_V1_IDENTITY'
    | 'PROJECT_IDENTITY_MISMATCH'
    | 'DANGLING_LEGACY_IDENTITY';
};

export type ExecutionSpineBackfillPlan = {
  organizationId: string;
  sourceSha: string;
  checksum: string;
  mappedCount: number;
  quarantinedCount: number;
  dispositions: ExecutionSpineDisposition[];
};

const sha256 = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requiredSha = (value: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) throw new Error('execution_backfill_source_sha_invalid');
  return normalized;
};

function dispositionFor(link: LegacyLink, candidates: AliasCandidate[]): ExecutionSpineDisposition {
  const source = [
    link.organization_id,
    link.link_id,
    link.initiative_id,
    link.case_id,
    link.project_id,
    link.status,
    link.version,
  ];
  const base = {
    legacyExecutionLinkId: link.link_id,
    legacyInitiativeId: link.initiative_id,
    legacyCaseId: link.case_id,
    projectId: link.project_id,
    sourceDigest: sha256(source),
  };
  if (candidates.length === 0) {
    return { ...base, outcome: 'QUARANTINED', reasonCode: 'NO_RUNTIME_V1_IDENTITY' };
  }
  if (candidates.length !== 1) {
    return { ...base, outcome: 'QUARANTINED', reasonCode: 'AMBIGUOUS_RUNTIME_V1_IDENTITY' };
  }
  const candidate = candidates[0];
  if (!candidate.canonical_execution_link_id) {
    return { ...base, outcome: 'QUARANTINED', reasonCode: 'DANGLING_LEGACY_IDENTITY' };
  }
  if (candidate.canonical_project_id !== link.project_id) {
    return { ...base, outcome: 'QUARANTINED', reasonCode: 'PROJECT_IDENTITY_MISMATCH' };
  }
  return {
    ...base,
    outcome: 'MAPPED',
    canonicalExecutionLinkId: candidate.canonical_execution_link_id,
  };
}

async function buildPlan(
  tx: PgTransactionClient,
  organizationId: string,
  sourceSha: string,
  lockRows: boolean,
): Promise<ExecutionSpineBackfillPlan> {
    const legacy = await tx.query<LegacyLink>(
      `SELECT link_id,organization_id,initiative_id,case_id,project_id,status,version
         FROM execution_case_links
        WHERE organization_id=? AND source_kind='LEGACY_CASE_CORE'
        ORDER BY link_id${lockRows ? ' FOR SHARE' : ''}`,
      [organizationId],
    );
    const dispositions: ExecutionSpineDisposition[] = [];
    for (const link of legacy.rows) {
      const candidates = await tx.query<AliasCandidate>(
        `SELECT ?::uuid AS legacy_execution_link_id,
                ?::text AS legacy_initiative_id,
                ?::text AS legacy_case_id,
                a.execution_link_id AS canonical_execution_link_id,
                e.source_project_id AS canonical_project_id
           FROM execution_identity_aliases a
           LEFT JOIN execution_case_links e
             ON e.organization_id=a.organization_id
            AND e.link_id=a.execution_link_id
            AND e.source_kind='RUNTIME_V1'
          WHERE a.organization_id=?
            AND (a.legacy_initiative_id=? OR a.legacy_case_id=?)
          ORDER BY a.execution_link_id${lockRows ? ' FOR SHARE OF a' : ''}`,
        [link.link_id, link.initiative_id, link.case_id, organizationId, link.initiative_id, link.case_id],
      );
      dispositions.push(dispositionFor(link, candidates.rows));
    }
    const canonical = dispositions.map((row) => ({
      legacyExecutionLinkId: row.legacyExecutionLinkId,
      legacyInitiativeId: row.legacyInitiativeId,
      legacyCaseId: row.legacyCaseId,
      projectId: row.projectId,
      sourceDigest: row.sourceDigest,
      outcome: row.outcome,
      canonicalExecutionLinkId: row.canonicalExecutionLinkId ?? null,
      reasonCode: row.reasonCode ?? null,
    }));
    return {
      organizationId,
      sourceSha,
      checksum: sha256(canonical),
      mappedCount: dispositions.filter((row) => row.outcome === 'MAPPED').length,
      quarantinedCount: dispositions.filter((row) => row.outcome === 'QUARANTINED').length,
      dispositions,
    };
}

export async function planExecutionSpineBackfill(input: {
  organizationId: string;
  sourceSha: string;
}): Promise<ExecutionSpineBackfillPlan> {
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId) throw new Error('execution_backfill_org_required');
  const sourceSha = requiredSha(input.sourceSha);
  return withPgTransaction((tx) => buildPlan(tx, organizationId, sourceSha, false));
}

export async function applyExecutionSpineBackfill(input: {
  organizationId: string;
  sourceSha: string;
  expectedPlanChecksum: string;
  actorId: string;
}): Promise<{ runId: string; replay: boolean; plan: ExecutionSpineBackfillPlan }> {
  const actorId = String(input.actorId || '').trim();
  if (!actorId) throw new Error('execution_backfill_actor_required');
  const expectedPlanChecksum = String(input.expectedPlanChecksum || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedPlanChecksum)) {
    throw new Error('execution_backfill_checksum_invalid');
  }
  const plan = await planExecutionSpineBackfill(input);
  if (plan.checksum !== expectedPlanChecksum) throw new Error('execution_backfill_plan_changed');

  return withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `execution-spine-backfill:${plan.organizationId}`,
    ]);
    const currentPlan = await buildPlan(tx, plan.organizationId, plan.sourceSha, true);
    if (currentPlan.checksum !== expectedPlanChecksum) throw new Error('execution_backfill_plan_changed');
    const replay = await tx.query<{ run_id: string }>(
      `SELECT run_id FROM execution_spine_backfill_runs
        WHERE organization_id=? AND source_sha=? AND plan_checksum=?`,
      [plan.organizationId, plan.sourceSha, plan.checksum],
    );
    if (replay.rows[0]) return { runId: replay.rows[0].run_id, replay: true, plan };

    const runId = randomUUID();
    await tx.query(
      `INSERT INTO execution_spine_backfill_runs
        (run_id,organization_id,source_sha,plan_checksum,status,mapped_count,quarantined_count,total_count,created_by)
       VALUES (?,?,?,?, 'COMPLETED',?,?,?,?)`,
      [
        runId,
        plan.organizationId,
        plan.sourceSha,
        plan.checksum,
        currentPlan.mappedCount,
        currentPlan.quarantinedCount,
        currentPlan.dispositions.length,
        actorId,
      ],
    );
    for (const row of currentPlan.dispositions) {
      if (row.outcome === 'MAPPED') {
        await tx.query(
          `INSERT INTO execution_spine_backfill_receipts
            (organization_id,run_id,legacy_execution_link_id,legacy_initiative_id,legacy_case_id,
             canonical_execution_link_id,source_digest)
           VALUES (?,?,?,?,?,?,?)`,
          [
            plan.organizationId,
            runId,
            row.legacyExecutionLinkId,
            row.legacyInitiativeId,
            row.legacyCaseId,
            row.canonicalExecutionLinkId,
            row.sourceDigest,
          ],
        );
      } else {
        await tx.query(
          `INSERT INTO execution_spine_identity_quarantine
            (organization_id,run_id,legacy_execution_link_id,legacy_initiative_id,legacy_case_id,
             reason_code,source_digest,source_snapshot)
           VALUES (?,?,?,?,?,?,?,?::jsonb)`,
          [
            plan.organizationId,
            runId,
            row.legacyExecutionLinkId,
            row.legacyInitiativeId,
            row.legacyCaseId,
            row.reasonCode,
            row.sourceDigest,
            JSON.stringify({ projectId: row.projectId }),
          ],
        );
      }
    }
    return { runId, replay: false, plan: currentPlan };
  });
}
