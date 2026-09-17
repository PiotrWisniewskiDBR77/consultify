#!/usr/bin/env tsx
/**
 * D-19 (Wpis 60 · STAGE-1 · DEC-539) — align the canonical initiative aggregate
 * (`ie_aggregate_state.payload_json.lifecycleState`) with the seven-code
 * `initiatives.status` column, for SHOWCASE organizations ONLY.
 *
 * WHY THIS SCRIPT EXISTS (measured on a copy of the staging dump, 2026-09-17)
 * --------------------------------------------------------------------------
 * The demo-session seed writes the legacy `initiatives.status` column directly
 * (`demoSeedService.ts:2306`, the "USPOJNIENIE A3" exception) and registers the
 * canonical twin via `writeSeedInitiativeToCanon` — which only runs
 * source-proposal.submit -> initiative.register, landing the aggregate at
 * `REGISTERED_DRAFT`. NOTHING then advances the aggregate, because the only
 * runtime path that does (`initiativeTransitionService.ts:1262-1274`, writing
 * `lifecycleState = nextStage` in the same transaction as the status) is the
 * gated status-transition engine the seed deliberately bypasses. Result: 2272 of
 * 2888 initiatives on the staging copy carry an aggregate stage whose 7-code
 * group disagrees with the column status (2267 = Atelier Toys demo-session orgs,
 * 3 = DBR77, 2 = Northwind). STAGE-1's migration
 * (`20262260_initiatives_lifecycle_stage.sql`) backfills `initiatives.lifecycle_stage`
 * FROM the aggregate ("the most precise source"), so once `VITE_INITIATIVES_STAGES_12`
 * is enabled the register (`resolveInitiativeRegisterDisplayStatus`, which reads
 * `lifecycle_stage` first) would show 1284 "in execution" initiatives as
 * "Draft registered". This script repairs the aggregate so that backfill lands on
 * the stage the column already asserts.
 *
 * WHAT IT DOES
 * ------------
 * For each initiative that HAS a canonical aggregate row, it derives the target
 * stage from the column status with the SAME canonical mapping the runtime write
 * path uses (`resolveInitiativeStageWriteTarget`, server/src/constants/
 * initiativeLifecycleStages.ts) — never a locally copied 7->12 table — and, when
 * the aggregate's current stage belongs to a DIFFERENT 7-code group, merges
 * `{ lifecycleState: <target> }` into the aggregate payload (version bumped, the
 * exact merge shape the engine uses). Rows already in the right group are left
 * alone (so a more precise SCHEDULED aggregate is never downgraded to
 * APPROVED_BACKLOG). Dispositions (REJECTED) and pre-registration (PROPOSED) have
 * no engine stage and short-circuit in the register on the raw column status, so
 * they are reported and SKIPPED, never overwritten (canon §5.3 / H1d: a rejected
 * initiative keeps the stage at which it died).
 *
 * SAFETY
 * ------
 * - DRY-RUN by default: prints before/after counts per org and per status and
 *   makes ZERO writes. Writes happen only with `--apply`.
 * - `--apply` requires at least one explicit `--org <id>`; there is no "all orgs"
 *   write mode.
 * - HARD allow-list = showcase orgs only (Atelier Toys demo-session orgs and
 *   "Northwind Manufacturing Ltd."). Any other org — DBR77 in particular, whose 3
 *   divergent rows are the reverse case (aggregate AHEAD of status) and must not
 *   be downgraded — is REFUSED. DBR77's divergent rows are printed for the CTO's
 *   decision, never written.
 * - No migration, no DDL. Only `ie_aggregate_state.payload_json` is touched.
 * - Idempotent: a second `--apply` finds every row already in the right group and
 *   changes 0 rows.
 * - The connection guard `resolveReachableDatabaseUrl()` refuses a loopback
 *   (localhost/127.0.0.1) DATABASE_URL unless `NODE_ENV=test`, so an operator
 *   pointing this script at a local dump copy must run it under `NODE_ENV=test`
 *   (or pass an explicitly reachable non-loopback URL); there is no
 *   `allowLocalHost` escape hatch in this script.
 * - ZERO writes to staging/demo from this task: running it there is the CTO's
 *   deployment-22 runbook. The proof below is dry-run + apply on a local copy.
 *
 * Usage:
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts                 # dry run, all orgs (read-only)
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts --org=<id>      # dry run, one org
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts --apply --org=<id> [--org=<id2>]  # write (showcase orgs only)
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 */
import pg from 'pg';

import {
  INITIATIVE_STAGE_TO_STATUS,
  resolveInitiativeStageWriteTarget,
  type InitiativeLifecycleStage,
} from '../src/constants/initiativeLifecycleStages.js';
import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import logger from '../src/utils/Logger.js';

/**
 * Dispositions / pre-registration codes that have NO engine stage and that the
 * register resolves straight from the raw column status
 * (`resolveInitiativeRegisterLifecycle` short-circuits on PROPOSED/REJECTED when
 * the 12-stage flag is on). They are never alignable and must never be
 * overwritten — see canon §5.3 / H1d.
 */
const SHORT_CIRCUIT_STATUSES = new Set(['REJECTED', 'PROPOSED']);

/** Showcase orgs this script is allowed to write. Everything else is refused. */
const SHOWCASE_ORG_NAMES = new Set(['Atelier Toys', 'Northwind Manufacturing Ltd.']);
const ATELIER_DEMO_SESSION_PATTERN = /^ateliertoys-demo-session-/;

export type AlignAction = 'align' | 'skip-aligned' | 'skip-short-circuit' | 'skip-no-stage';

export interface AlignPlan {
  action: AlignAction;
  /** Engine stage to merge into the aggregate, or null when nothing is written. */
  targetStage: InitiativeLifecycleStage | null;
}

/** 7-code group a 12-stage belongs to, or null when the value is not a stage. */
export function stageGroup(stage: string | null | undefined): string | null {
  const raw = String(stage ?? '').trim();
  if (!raw) return null;
  return (INITIATIVE_STAGE_TO_STATUS as Record<string, string>)[raw] ?? null;
}

/** True when `orgId`/`orgName` is a showcase org this script may write. */
export function isShowcaseOrg(orgId: string, orgName: string | null | undefined): boolean {
  if (ATELIER_DEMO_SESSION_PATTERN.test(String(orgId || ''))) return true;
  return SHOWCASE_ORG_NAMES.has(String(orgName ?? '').trim());
}

/**
 * PURE decision (unit-tested, no I/O): given the column status and the
 * aggregate's current lifecycleState, decide whether to align and to what stage.
 * Uses the canonical write-target mapping — never a locally copied 7->12 table.
 */
export function planAggregateAlignment(
  status: string | null | undefined,
  currentStage: string | null | undefined
): AlignPlan {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();

  if (SHORT_CIRCUIT_STATUSES.has(normalizedStatus)) {
    return { action: 'skip-short-circuit', targetStage: null };
  }

  const target = resolveInitiativeStageWriteTarget(normalizedStatus);
  if (!target || target.stage === null) {
    return { action: 'skip-no-stage', targetStage: null };
  }

  // Already in the right 7-code group — leave it (never downgrade a more precise
  // stage within the same group, e.g. SCHEDULED -> APPROVED_BACKLOG).
  if (stageGroup(currentStage) === normalizedStatus) {
    return { action: 'skip-aligned', targetStage: target.stage };
  }

  return { action: 'align', targetStage: target.stage };
}

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

interface OrgRow {
  id: string;
  status: string;
  currentStage: string | null;
}

/** Read every initiative that HAS a canonical aggregate row for one org. */
async function readAggregateRows(client: pg.Client, orgId: string): Promise<OrgRow[]> {
  const res = await client.query<{ id: string; status: string; current_stage: string | null }>(
    `SELECT i.id,
            UPPER(COALESCE(i.status, 'DRAFT')) AS status,
            a.payload_json->>'lifecycleState' AS current_stage
       FROM initiatives i
       JOIN ie_aggregate_state a
         ON a.aggregate_type = 'initiative'
        AND a.aggregate_id = i.id
        AND a.organization_id = i.organization_id
      WHERE i.organization_id = $1`,
    [orgId]
  );
  return res.rows.map((r) => ({ id: r.id, status: r.status, currentStage: r.current_stage }));
}

async function readOrgName(client: pg.Client, orgId: string): Promise<string | null> {
  const res = await client.query<{ name: string | null }>(
    `SELECT name FROM organizations WHERE id = $1 LIMIT 1`,
    [orgId]
  );
  return res.rows[0]?.name ?? null;
}

/** All org ids that own at least one initiative with a canonical aggregate. */
async function readOrgIdsWithAggregates(client: pg.Client): Promise<string[]> {
  const res = await client.query<{ organization_id: string }>(
    `SELECT DISTINCT i.organization_id
       FROM initiatives i
       JOIN ie_aggregate_state a
         ON a.aggregate_type = 'initiative'
        AND a.aggregate_id = i.id
        AND a.organization_id = i.organization_id
      ORDER BY i.organization_id`
  );
  return res.rows.map((r) => r.organization_id);
}

/**
 * DBR77's divergent rows, printed for the CTO's decision and NEVER written.
 * These are the reverse case: the aggregate (APPROVED_BACKLOG) is AHEAD of the
 * column (PENDING_APPROVAL), so aligning them would downgrade a more precise
 * stage. DBR77 is not a showcase org and is refused by the allow-list anyway;
 * this section makes the 3 rows explicit.
 */
async function reportDbr77ForDecision(client: pg.Client): Promise<void> {
  const res = await client.query<{ id: string; name: string | null }>(
    `SELECT id, name FROM organizations WHERE name = 'DBR77' ORDER BY id`
  );
  if (res.rows.length === 0) {
    logger.info('[align-initiative-aggregate] DBR77: no such org on this DB — nothing to list.');
    return;
  }
  for (const org of res.rows) {
    const rows = await readAggregateRows(client, org.id);
    const divergent = rows.filter(
      (r) => planAggregateAlignment(r.status, r.currentStage).action === 'align'
    );
    logger.info(
      `[align-initiative-aggregate] DBR77 (org=${org.id}) — NOT TOUCHED (not a showcase org). ` +
        `Divergent rows for CTO decision: ${divergent.length}`
    );
    for (const r of divergent) {
      logger.info(
        `[align-initiative-aggregate]   DBR77 id=${r.id} status=${r.status} aggregate=${r.currentStage ?? '<none>'}`
      );
    }
  }
}

export interface OrgCounts {
  align: number;
  'skip-aligned': number;
  'skip-short-circuit': number;
  'skip-no-stage': number;
  alignByStatus: Record<string, number>;
}

function emptyCounts(): OrgCounts {
  return {
    align: 0,
    'skip-aligned': 0,
    'skip-short-circuit': 0,
    'skip-no-stage': 0,
    alignByStatus: {},
  };
}

export async function processOrg(
  client: pg.Client,
  orgId: string,
  apply: boolean
): Promise<{ counts: OrgCounts; wrote: number; name: string | null; allowed: boolean }> {
  const name = await readOrgName(client, orgId);
  const allowed = isShowcaseOrg(orgId, name);
  const rows = await readAggregateRows(client, orgId);
  const counts = emptyCounts();
  let wrote = 0;

  for (const row of rows) {
    const plan = planAggregateAlignment(row.status, row.currentStage);
    counts[plan.action] += 1;
    if (plan.action !== 'align' || plan.targetStage === null) continue;
    counts.alignByStatus[row.status] = (counts.alignByStatus[row.status] || 0) + 1;

    if (!apply || !allowed) continue;
    const patch = JSON.stringify({ lifecycleState: plan.targetStage });
    const res = await client.query(
      `UPDATE ie_aggregate_state
          SET version = ie_aggregate_state.version + 1,
              payload_json = ie_aggregate_state.payload_json || CAST($1 AS jsonb),
              updated_at = NOW()
        WHERE organization_id = $2
          AND aggregate_type = 'initiative'
          AND aggregate_id = $3
          AND COALESCE(payload_json->>'lifecycleState', '') IS DISTINCT FROM $4`,
      [patch, orgId, row.id, plan.targetStage]
    );
    wrote += res.rowCount ?? 0;
  }

  logger.info(
    `[align-initiative-aggregate] org=${orgId} name=${name ?? '<none>'} ` +
      `allowed=${allowed ? 'YES' : 'NO (refused)'} mode=${apply ? 'APPLY' : 'DRY-RUN'} :: ` +
      `would-align=${counts.align} already-aligned=${counts['skip-aligned']} ` +
      `short-circuit(REJECTED/PROPOSED)=${counts['skip-short-circuit']} no-stage=${counts['skip-no-stage']}` +
      (apply && allowed ? ` WROTE=${wrote}` : '')
  );
  const byStatus = Object.entries(counts.alignByStatus)
    .map(([status, n]) => `${status}:${n}`)
    .join(', ');
  if (byStatus) {
    logger.info(`[align-initiative-aggregate]   org=${orgId} align-by-status → ${byStatus}`);
  }
  if (apply && !allowed) {
    logger.warn(
      `[align-initiative-aggregate]   org=${orgId} REFUSED — not a showcase org; 0 rows written.`
    );
  }

  return { counts, wrote, name, allowed };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const orgIds: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg.startsWith('--org=')) {
      const value = arg.slice('--org='.length).trim();
      if (value) orgIds.push(value);
    } else if (arg === '--org') {
      const value = String(process.argv[i + 1] || '').trim();
      if (value) orgIds.push(value);
      i += 1;
    }
  }

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for align-initiative-aggregate-state');
  }
  if (resolvedDb.reason) {
    logger.warn(`[align-initiative-aggregate] ${resolvedDb.reason}`);
  }

  if (apply && orgIds.length === 0) {
    throw new Error('--apply requires at least one explicit --org <id> (no all-orgs write mode)');
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    logger.info(
      `[align-initiative-aggregate] mode=${apply ? 'APPLY' : 'DRY-RUN'} ` +
        `orgs=${orgIds.length > 0 ? orgIds.join(',') : '<all orgs, read-only>'}`
    );

    // Always surface the DBR77 rows for the CTO, in every mode.
    await reportDbr77ForDecision(client);

    const targetOrgs = orgIds.length > 0 ? orgIds : await readOrgIdsWithAggregates(client);
    const totals = emptyCounts();
    let totalWrote = 0;
    let alignedOrgs = 0;

    for (const orgId of targetOrgs) {
      const { counts, wrote, allowed } = await processOrg(client, orgId, apply);
      totals.align += counts.align;
      totals['skip-aligned'] += counts['skip-aligned'];
      totals['skip-short-circuit'] += counts['skip-short-circuit'];
      totals['skip-no-stage'] += counts['skip-no-stage'];
      for (const [status, n] of Object.entries(counts.alignByStatus)) {
        totals.alignByStatus[status] = (totals.alignByStatus[status] || 0) + n;
      }
      totalWrote += wrote;
      if (apply && allowed && wrote > 0) alignedOrgs += 1;
    }

    const totalByStatus = Object.entries(totals.alignByStatus)
      .map(([status, n]) => `${status}:${n}`)
      .join(', ');
    logger.info(
      `[align-initiative-aggregate] TOTAL would-align=${totals.align} ` +
        `already-aligned=${totals['skip-aligned']} ` +
        `short-circuit=${totals['skip-short-circuit']} no-stage=${totals['skip-no-stage']}` +
        (totalByStatus ? ` :: align-by-status → ${totalByStatus}` : '') +
        (apply ? ` :: WROTE=${totalWrote} across ${alignedOrgs} org(s)` : ' (DRY-RUN — pass --apply --org <id> to write)')
    );
  } finally {
    await client.end();
  }
}

// Run only when invoked directly (tsx server/scripts/...), never on import — the
// pure planner above is unit-tested from tests/backend without touching a DB.
const invokedDirectly = String(process.argv[1] || '')
  .replace(/\\/g, '/')
  .endsWith('align-initiative-aggregate-state.ts');
if (invokedDirectly) {
  main().catch((error) => {
    logger.error('[align-initiative-aggregate] Failed:', (error as Error)?.message || error);
    process.exit(1);
  });
}
