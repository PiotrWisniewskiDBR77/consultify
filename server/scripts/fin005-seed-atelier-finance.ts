/**
 * FIN-005 — dedicated, non-destructive seed of the Atelier Finance golden flow.
 *
 * ===========================================================================
 * WHY THIS SCRIPT EXISTS
 * ===========================================================================
 * `FIN-005_OPERATOR_PRE_RUN.md` §0 requires the canonical Atelier Finance seed
 * to run BEFORE the quarantine, and the quarantine's own `--write` refuses
 * unless the canonical fixture is materialized AND READY
 * (`assertCanonicalFixtureMaterialized`). Until now the runbook named no
 * command for that step.
 *
 * The generic entry point (`npm run db:seed:atelier` →
 * `server/scripts/build-demo-dataset.ts --write`) is the WRONG tool here:
 *
 *   - it rebuilds the WHOLE Atelier dataset (users, projects, initiatives,
 *     tasks, decisions, reports, docs, prompts, tool sessions, assessments,
 *     interviews, KPIs, rollout artifacts, deliverables, notifications,
 *     activity logs) — orders of magnitude wider than FIN-005 needs;
 *   - it has no Railway fingerprint allowlist, so nothing stops it being
 *     pointed at a tenant it was never approved for;
 *   - it leaves no recovery record of the prior state.
 *
 * This script does exactly one job: materialize the canonical FIN-005 Finance
 * golden flow — statement pack → 3 statements → statement values → approved
 * analysis → canonical ROI model bound to that pack — in ONE approved demo
 * tenant, and prove it READY afterwards.
 *
 * ===========================================================================
 * THE GUARDS, IN THE ORDER THEY FIRE
 * ===========================================================================
 *  1. escape hatches refused    — `--force*` does not exist here either;
 *  2. explicit target authority — every fingerprint field must be declared,
 *     nothing is defaulted (`assertApprovedDemoTarget`, shared with the
 *     cleanup script: production denylist → declared-vs-connected match →
 *     exact allowlist entry);
 *  3. server-side database check — the database the SERVER reports must be
 *     the approved one, not just the one in the URL;
 *  4. strict demo marker        — `organizations.organization_type` must
 *     EXIST and be exactly `'DEMO'` (`assertDemoOrganizationMarker`);
 *  5. pinned PostgreSQL         — mandatory for `--write`. If the pinned
 *     promotion path is unavailable the run REFUSES. There is no fallback
 *     here and this script must never paper over one in the seed;
 *  6. preflight                 — reads the canonical fixture and reports
 *     exactly which rows would be created / promoted / re-linked;
 *  7. confirmation token        — `FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW`,
 *     deliberately DIFFERENT from the cleanup script's
 *     `QUARANTINE_FOREIGN_FINANCE`, so a token pasted for one operation can
 *     never authorise the other;
 *  8. recovery manifest         — the full prior state of every canonical row
 *     is written, fsync'd and atomically renamed into place BEFORE the first
 *     mutation;
 *  9. post-condition            — the fixture is re-read and must pass
 *     `assertCanonicalFixtureMaterialized`, otherwise the run reports failure.
 *
 * ===========================================================================
 * WHAT THIS SCRIPT NEVER DOES
 * ===========================================================================
 * No `DELETE`, no `DROP`, no `TRUNCATE`, no `ALTER`. It never creates and
 * never removes an organization — the target tenant must already exist and
 * already be marked `DEMO`. It touches no table outside the six canonical
 * Finance tables, and no row outside the exact canonical id set from
 * `getAtelierFinanceCanonicalIds`. Every one of those claims is asserted
 * structurally by `fin005SeedAtelierFinance.test.ts`, by scanning this
 * module's source and the SQL its builders actually produce — not by trusting
 * this comment.
 *
 * DRY RUN IS THE DEFAULT. `--write` is the only way to mutate anything.
 *
 * ===========================================================================
 * USAGE
 * ===========================================================================
 *   # dry run (default, read-only, no confirmation token needed)
 *   DB_TYPE=postgres DATABASE_URL=... \
 *   npx tsx server/scripts/fin005-seed-atelier-finance.ts \
 *     --demo-org-id demo-org --locale en \
 *     --railway-project consultify --railway-environment demo \
 *     --railway-service Postgres \
 *     --expect-host trolley.proxy.rlwy.net --expect-port 28146 \
 *     --expect-database railway
 *
 *   # write
 *   DB_TYPE=postgres DATABASE_URL=... \
 *   FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW \
 *   npx tsx server/scripts/fin005-seed-atelier-finance.ts ... --write
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  assertApprovedDemoTarget,
  assertCanonicalFixtureMaterialized,
  assertDemoOrganizationMarker,
  computeCanonicalFixtureDigest,
  verifyCanonicalFixture,
  CANONICAL_FIXTURE_READY_STATE,
  type CanonicalFixtureReadback,
  type DemoTargetFingerprint,
} from '../src/services/demo/financeDemoCoherencePolicy.js';
import {
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
  ATELIER_CANONICAL_MODEL_NAME_EN,
  ATELIER_CANONICAL_MODEL_NAME_PL,
  ATELIER_FINANCE_CURRENCY,
} from '../src/services/demo/atelierFinanceSeed.js';
import { probePinnedTransactionSupport } from '../src/services/demo/atelierFinancePromotionTransaction.js';
// Reused verbatim from the cleanup script so the two operator commands cannot
// drift on target parsing, argument shape or durable-write semantics. Importing
// it executes nothing: its CLI is behind an `invokedDirectly()` check.
import {
  createPgGateway,
  parseArgs,
  parseConnectionFingerprint,
  resolveDeclaredTarget,
  stamp,
  writeJsonFileAtomically,
  type CleanupGateway,
} from './finance-demo-coherence-cleanup.js';
import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

export const LABEL = 'fin005-atelier-finance-seed';

/**
 * The confirmation token for a write.
 *
 * DELIBERATELY NOT the cleanup script's `QUARANTINE_FOREIGN_FINANCE`. The two
 * commands do different things to the same tenant in the same session; a shared
 * token would mean an operator who exported one variable has silently
 * authorised both. Distinct variable, distinct value, no overlap.
 */
export const CONFIRM_ENV = 'FIN005_SEED_CONFIRM';
export const CONFIRM_VALUE = 'SEED_ATELIER_FINANCE_GOLDEN_FLOW';

/** Flags that would defeat a guard. Present only so their use is a hard error. */
const REFUSED_FLAGS = ['force', 'force-org', 'force-target', 'skip-preflight', 'rebuild', 'all'];

/** Every table this script reads for the prior-state snapshot. */
export const CANONICAL_TABLES = [
  'financial_statement_packs',
  'financial_statements',
  'financial_statement_ingest_runs',
  'financial_statement_values',
  'financial_analyses',
  'financial_models',
] as const;

export const MANIFEST_VERSION = 1;

function fail(message: string): never {
  throw new Error(`[${LABEL}] ${message}`);
}

function exportsDir(): string {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// The canonical ROI model
// ---------------------------------------------------------------------------

/**
 * The ROI model is the fifth leg of the canonical fixture
 * (`verifyCanonicalFixture` requires it, bound to the canonical pack), but it
 * is written by `demoSeedService.upsertAtelierRoiFinancialModel`, which is part
 * of the full dataset rebuild. This is the narrow equivalent: the same id, the
 * same canonical name, the same currency, the same approved status, the same
 * `source_statement_pack_id` — and nothing else.
 *
 * INSERT-ONLY vs UPDATABLE is the point of the shape below.
 *
 * Updatable: `name`, `currency`, `status`, `source_statement_pack_id` — the
 * four fields FIN-005 is actually about (canonical name with no "(kopia)", EUR
 * not the PLN default, approved, grounded on the FY2014 pack).
 *
 * Insert-only: `project_id`, `initiative_id`, `description`, `horizon_months`,
 * `start_date`, `granularity`, `scenario`, `created_by`. A demo tenant seeded
 * by the full dataset already carries real values there; re-running this narrow
 * command must not blank them. That is also why this command does not touch
 * `financial_model_events` at all — see the runbook's note on what it does not
 * seed.
 *
 * The `WHERE` guard on the update means an unchanged re-run writes ZERO rows,
 * so `updated_at` does not churn. Idempotence is a property of the statement,
 * not of a comment.
 */
export function buildCanonicalModelUpsert(params: {
  organizationId: string;
  packId: string;
  modelId: string;
  locale: 'en' | 'pl';
  projectId: string | null;
  createdBy: string | null;
  presentColumns: ReadonlySet<string>;
}): { sql: string; params: unknown[] } {
  const isPl = params.locale === 'pl';
  const name = isPl ? ATELIER_CANONICAL_MODEL_NAME_PL : ATELIER_CANONICAL_MODEL_NAME_EN;
  const description = isPl
    ? 'Business case zarządu dla 3-letniego programu cyfryzacji: NPV, ROI i okres zwrotu.'
    : 'Board business case for the 3-year digitization program: NPV, ROI, and payback.';

  // Declared explicitly, in order. Nothing relies on a column default.
  const declaredColumns: Array<[string, unknown]> = [
    ['id', params.modelId],
    ['organization_id', params.organizationId],
    ['project_id', params.projectId],
    ['name', name],
    ['description', description],
    ['currency', ATELIER_FINANCE_CURRENCY],
    ['horizon_months', 36],
    ['start_date', '2015-01-01'],
    ['granularity', 'annual'],
    ['scenario', 'base'],
    ['status', 'approved'],
    ['created_by', params.createdBy],
    ['source_statement_pack_id', params.packId],
  ];
  const columns = declaredColumns.filter(([column]) => params.presentColumns.has(column));

  const updatable = ['name', 'currency', 'status', 'source_statement_pack_id'].filter((column) =>
    params.presentColumns.has(column)
  );
  if (!updatable.includes('source_statement_pack_id')) {
    fail(
      `financial_models has no source_statement_pack_id column in this schema. The canonical model ` +
        `cannot be bound to the FY2014 pack, so the fixture can never be READY. Migrate first; this ` +
        `script does not run DDL.`
    );
  }

  const names = columns.map(([column]) => `"${column}"`).join(', ');
  const placeholders = columns.map((_column, index) => `$${index + 1}`).join(', ');
  const setClause = [
    ...updatable.map((column) => `"${column}" = excluded."${column}"`),
    ...(params.presentColumns.has('updated_at') ? ['"updated_at" = CURRENT_TIMESTAMP'] : []),
  ].join(', ');
  const guard = updatable
    .map(
      (column) =>
        `financial_models."${column}" IS DISTINCT FROM excluded."${column}"`
    )
    .join(' OR ');

  return {
    sql:
      `INSERT INTO financial_models (${names}) VALUES (${placeholders}) ` +
      `ON CONFLICT (id) DO UPDATE SET ${setClause} WHERE ${guard}`,
    params: columns.map(([, value]) => value),
  };
}

/** The prior-state snapshot read. Read-only by construction. */
export function buildPriorStateQuery(table: string): string {
  if (!(CANONICAL_TABLES as readonly string[]).includes(table)) {
    fail(`refusing to snapshot "${table}": not a canonical FIN-005 Finance table.`);
  }
  return `SELECT * FROM "${table}" WHERE id = ANY($1::text[]) ORDER BY id`;
}

/** The schema introspection read. Read-only by construction. */
export const COLUMNS_QUERY =
  `SELECT column_name FROM information_schema.columns ` +
  `WHERE table_schema = current_schema() AND table_name = $1`;

/**
 * Every SQL statement kind this module can issue, for the structural test.
 * `buildCanonicalModelUpsert` is the ONLY writing statement in the file.
 */
export const SQL_BUILDERS_IN_THIS_MODULE = ['buildCanonicalModelUpsert', 'buildPriorStateQuery', 'COLUMNS_QUERY'];

// ---------------------------------------------------------------------------
// Pinned PostgreSQL — mandatory, never papered over
// ---------------------------------------------------------------------------

export interface PinnedVerdict {
  supported: boolean;
  reason: string;
}

/**
 * Prove that a PINNED connection to the approved database can actually be
 * checked out and run a transaction — `BEGIN` … `ROLLBACK`, writing nothing.
 *
 * WHY THIS EXISTS ON TOP OF `probePinnedTransactionSupport()`: that probe goes
 * through `DbPromise` and answers "the active driver is a real PostgreSQL". It
 * says NOTHING about whether a client can be checked out of the pool and hold a
 * transaction — and that is the part that fails in practice (pool exhausted,
 * proxy dropping the socket, a checkout helper that throws). A run was observed
 * where the driver probe said AVAILABLE and the pinned checkout then failed;
 * treating the driver probe as sufficient is exactly the paper-over this packet
 * forbids.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not call
 * `runPinnedPromotionTransaction`, and it does not import
 * `getPoolClientForPinnedTransaction` (documented as having exactly one
 * caller). It proves the CAPABILITY on the approved target using this script's
 * own pool.
 *
 * WHAT IT THEREFORE CANNOT PROVE: which internal path the seed took. Enforcing
 * "the seed itself never falls back to a non-atomic promotion" lives in
 * `atelierFinanceSeed.ts` / `atelierFinancePromotionTransaction.ts`. This
 * command's contribution is (a) refuse to write when the pinned capability is
 * absent, and (b) refuse when the seed reports anything other than `complete`
 * — which is what a fail-closed seed returns when its pinned path is refused.
 */
export async function probePinnedCapability(
  pool: pg.Pool,
  expectedDatabase: string
): Promise<PinnedVerdict> {
  let client: pg.PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    return {
      supported: false,
      reason: `could not check out a pinned connection: ${(error as Error).message}`,
    };
  }
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT current_database() AS pinned_db, pg_backend_pid() AS pinned_pid'
    );
    await client.query('ROLLBACK');
    const database = String(result.rows?.[0]?.pinned_db ?? '').trim();
    if (!database) {
      return {
        supported: false,
        reason: 'the pinned connection did not answer current_database()',
      };
    }
    if (database !== expectedDatabase) {
      return {
        supported: false,
        reason: `the pinned connection is on database "${database}", not the approved "${expectedDatabase}"`,
      };
    }
    return {
      supported: true,
      reason: `BEGIN/ROLLBACK proved on a pinned connection to "${database}" (backend pid ${String(result.rows?.[0]?.pinned_pid ?? '?')})`,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* the backend is already gone; Postgres aborts on disconnect */
    }
    return {
      supported: false,
      reason: `a transaction on the pinned connection failed: ${(error as Error).message}`,
    };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Preflight — exactly what a --write would change
// ---------------------------------------------------------------------------

export type PreflightAction = 'create' | 'promote' | 'relink' | 'unchanged';

export interface PreflightRow {
  table: string;
  id: string;
  action: PreflightAction;
  detail: string;
}

export interface SeedPreflight {
  organizationId: string;
  fixtureReady: boolean;
  violations: string[];
  rows: PreflightRow[];
  summary: Record<PreflightAction, number>;
  digest: string;
}

/**
 * Turn the canonical read-back into a per-row plan.
 *
 * `create` — the row is absent; `promote` — present but not in the terminal
 * READY state the seed writes in phase 2; `relink` — present and ready but
 * pointing at the wrong parent; `unchanged` — nothing to do.
 *
 * The plan is derived from the SAME read-back the quarantine's precondition
 * uses, so "what the seed would change" and "what the quarantine demands" can
 * never be two different pictures.
 */
export function buildSeedPreflight(
  readback: CanonicalFixtureReadback,
  organizationId: string
): SeedPreflight {
  const canonical = getAtelierFinanceCanonicalIds(organizationId);
  const rows: PreflightRow[] = [];

  const pack = (readback.packs || []).find((row) => row.id === canonical.packId);
  if (!pack) {
    rows.push({ table: 'financial_statement_packs', id: canonical.packId, action: 'create', detail: 'absent' });
  } else if (
    pack.packStatus !== CANONICAL_FIXTURE_READY_STATE.packStatus ||
    pack.packReadinessStatus !== CANONICAL_FIXTURE_READY_STATE.packReadinessStatus
  ) {
    rows.push({
      table: 'financial_statement_packs',
      id: canonical.packId,
      action: 'promote',
      detail: `pack_status=${String(pack.packStatus)} pack_readiness_status=${String(pack.packReadinessStatus)}`,
    });
  } else {
    rows.push({ table: 'financial_statement_packs', id: canonical.packId, action: 'unchanged', detail: 'ready' });
  }

  for (const id of canonical.statementIds) {
    const statement = (readback.statements || []).find((row) => row.id === id);
    if (!statement) {
      rows.push({ table: 'financial_statements', id, action: 'create', detail: 'absent' });
      continue;
    }
    if (
      statement.status !== CANONICAL_FIXTURE_READY_STATE.statementStatus ||
      statement.readinessStatus !== CANONICAL_FIXTURE_READY_STATE.statementReadinessStatus
    ) {
      rows.push({
        table: 'financial_statements',
        id,
        action: 'promote',
        detail: `status=${String(statement.status)} readiness_status=${String(statement.readinessStatus)}`,
      });
      continue;
    }
    if (statement.statementPackId !== canonical.packId) {
      rows.push({
        table: 'financial_statements',
        id,
        action: 'relink',
        detail: `statement_pack_id=${statement.statementPackId ?? '<null>'}`,
      });
      continue;
    }
    rows.push({ table: 'financial_statements', id, action: 'unchanged', detail: 'ready' });
  }

  const presentValues = new Set((readback.values || []).map((row) => row.id));
  const canonicalStatementIds = new Set(canonical.statementIds);
  for (const id of canonical.statementValueIds) {
    const value = (readback.values || []).find((row) => row.id === id);
    if (!presentValues.has(id) || !value) {
      rows.push({ table: 'financial_statement_values', id, action: 'create', detail: 'absent' });
      continue;
    }
    if (!canonicalStatementIds.has(value.statementId)) {
      rows.push({
        table: 'financial_statement_values',
        id,
        action: 'relink',
        detail: `statement_id=${value.statementId}`,
      });
      continue;
    }
    rows.push({ table: 'financial_statement_values', id, action: 'unchanged', detail: 'ok' });
  }

  const analysis = (readback.analyses || []).find((row) => row.id === canonical.analysisId);
  if (!analysis) {
    rows.push({ table: 'financial_analyses', id: canonical.analysisId, action: 'create', detail: 'absent' });
  } else if (analysis.status !== CANONICAL_FIXTURE_READY_STATE.analysisStatus) {
    rows.push({
      table: 'financial_analyses',
      id: canonical.analysisId,
      action: 'promote',
      detail: `status=${String(analysis.status)}`,
    });
  } else if (analysis.sourceStatementPackId !== canonical.packId) {
    rows.push({
      table: 'financial_analyses',
      id: canonical.analysisId,
      action: 'relink',
      detail: `source_statement_pack_id=${analysis.sourceStatementPackId ?? '<null>'}`,
    });
  } else {
    rows.push({ table: 'financial_analyses', id: canonical.analysisId, action: 'unchanged', detail: 'approved' });
  }

  const model = (readback.models || []).find((row) => row.id === canonical.modelId);
  if (!model) {
    rows.push({ table: 'financial_models', id: canonical.modelId, action: 'create', detail: 'absent' });
  } else if (model.sourceStatementPackId !== canonical.packId) {
    rows.push({
      table: 'financial_models',
      id: canonical.modelId,
      action: 'relink',
      detail: `source_statement_pack_id=${model.sourceStatementPackId ?? '<null>'}`,
    });
  } else {
    rows.push({ table: 'financial_models', id: canonical.modelId, action: 'unchanged', detail: 'bound' });
  }

  const summary: Record<PreflightAction, number> = { create: 0, promote: 0, relink: 0, unchanged: 0 };
  for (const row of rows) summary[row.action] += 1;

  const { ok, violations } = verifyCanonicalFixture(readback, organizationId);
  return {
    organizationId,
    fixtureReady: ok,
    violations,
    rows,
    summary,
    digest: computeCanonicalFixtureDigest(readback),
  };
}

export function buildPreflightReport(params: {
  preflight: SeedPreflight;
  dryRun: boolean;
  host: string;
  database: string;
  runId: string;
  pinned: { supported: boolean; reason: string };
}): string {
  const { preflight } = params;
  const lines: string[] = [];
  lines.push(`# FIN-005 — seed Atelier Finance (${params.dryRun ? 'DRY RUN' : 'WRITE'})`);
  lines.push('');
  lines.push(`- run id: \`${params.runId}\``);
  lines.push(`- host: \`${params.host}\``);
  lines.push(`- database: \`${params.database}\``);
  lines.push(`- organization: \`${preflight.organizationId}\``);
  lines.push(`- pinned PostgreSQL: ${params.pinned.supported ? 'AVAILABLE' : 'UNAVAILABLE'} — ${params.pinned.reason}`);
  lines.push(`- fixture digest (before): \`${preflight.digest}\``);
  lines.push(
    `- plan: create=${preflight.summary.create} promote=${preflight.summary.promote} ` +
      `relink=${preflight.summary.relink} unchanged=${preflight.summary.unchanged}`
  );
  lines.push('');
  lines.push('## Rows that would change');
  lines.push('');
  const changing = preflight.rows.filter((row) => row.action !== 'unchanged');
  if (!changing.length) {
    lines.push('_Nothing. The canonical fixture is already materialized and READY._');
  } else {
    lines.push('| table | id | action | observed |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of changing) {
      lines.push(`| \`${row.table}\` | \`${row.id}\` | ${row.action} | ${row.detail} |`);
    }
  }
  lines.push('');
  lines.push('## Fixture verdict (before)');
  lines.push('');
  if (preflight.fixtureReady) {
    lines.push('READY — the quarantine precondition would pass as-is.');
  } else {
    for (const violation of preflight.violations) lines.push(`- ${violation}`);
  }
  lines.push('');
  lines.push('## Not touched by this command');
  lines.push('');
  lines.push('- no organization is created, modified or removed;');
  lines.push('- no destructive statement of any kind: no row removal, no DDL;');
  lines.push('- no table outside the six canonical Finance tables;');
  lines.push('- no row outside the exact canonical id set;');
  lines.push('- `financial_model_events` / `financial_model_outputs` are NOT seeded (full dataset only).');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Recovery manifest
// ---------------------------------------------------------------------------

export interface SeedRecoveryManifest {
  version: number;
  label: string;
  status: 'PREPARED' | 'COMPLETED';
  runId: string;
  createdAt: string;
  target: {
    railwayProject: string;
    railwayEnvironment: string;
    railwayService: string;
    host: string;
    port: number | null;
    database: string;
    organizationId: string;
  };
  locale: 'en' | 'pl';
  /** The digest of the fixture as it was before the first write. */
  priorFixtureDigest: string;
  /** The full prior state of every canonical row that already existed. */
  priorRows: Record<string, Array<Record<string, unknown>>>;
  /** Canonical ids that did not exist before the run, per table. */
  absentBefore: Record<string, string[]>;
  plan: PreflightRow[];
  postFixtureDigest?: string;
  recovery: string[];
}

/**
 * Written BEFORE the first mutation, with the same durability discipline as the
 * cleanup script's rollback manifest (temp file → `fsync` → atomic `rename` →
 * directory `fsync`).
 *
 * HONEST LIMIT, stated here rather than discovered later: this manifest is NOT
 * HMAC-signed and there is no `--rollback` for it. It does not need one in the
 * same way — this command only ever inserts canonical rows and promotes them,
 * it never moves or removes anybody's data — so the manifest's job is to record
 * what the tenant looked like beforehand, so a human can restore a pre-existing
 * row by hand if a re-seed changed something they wanted kept. Treat it as
 * evidence, not as an executable undo.
 */
export function buildRecoveryManifest(params: {
  runId: string;
  createdAt: Date;
  approved: DemoTargetFingerprint;
  locale: 'en' | 'pl';
  priorFixture: CanonicalFixtureReadback;
  priorRows: Record<string, Array<Record<string, unknown>>>;
  plan: PreflightRow[];
}): SeedRecoveryManifest {
  const absentBefore: Record<string, string[]> = {};
  const canonical = getAtelierFinanceCanonicalIds(params.approved.organizationId);
  for (const table of CANONICAL_TABLES) {
    const present = new Set((params.priorRows[table] || []).map((row) => String(row.id)));
    absentBefore[table] = (canonical.byTable[table] || []).filter((id) => !present.has(id));
  }

  return {
    version: MANIFEST_VERSION,
    label: LABEL,
    status: 'PREPARED',
    runId: params.runId,
    createdAt: params.createdAt.toISOString(),
    target: {
      railwayProject: params.approved.railwayProject,
      railwayEnvironment: params.approved.railwayEnvironment,
      railwayService: params.approved.railwayService,
      host: params.approved.host,
      port: params.approved.port,
      database: params.approved.database,
      organizationId: params.approved.organizationId,
    },
    locale: params.locale,
    priorFixtureDigest: computeCanonicalFixtureDigest(params.priorFixture),
    priorRows: params.priorRows,
    absentBefore,
    plan: params.plan,
    recovery: [
      'This command never deletes and never moves rows between tenants.',
      'To undo a row this run CREATED: it is listed in `absentBefore` — remove it with a reviewed, separate operation.',
      'To undo a row this run CHANGED: its complete prior state is in `priorRows`.',
      'This manifest is unsigned evidence, not an executable rollback plan.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface SeedRunOutcome {
  dryRun: boolean;
  runId: string;
  organizationId: string;
  preflight: SeedPreflight;
  reportPath: string;
  manifestPath?: string;
  fixtureDigestAfter?: string;
  pinned: { supported: boolean; reason: string };
}

export interface SeedRunOptions {
  argv: string[];
  /**
   * TESTS ONLY. There is no CLI flag and no environment variable that reaches
   * this parameter — `main()` never passes it, so an operator cannot substitute
   * an allowlist from the command line. It exists so the DB-backed tests can
   * exercise the real code path against a local scratch database.
   */
  allowlist?: ReadonlyArray<DemoTargetFingerprint>;
  now?: Date;
  /** Injected in tests to keep assertions off the real console. */
  log?: (message: string) => void;
}

function readLocale(args: Record<string, string>): 'en' | 'pl' {
  const raw = String(args.locale || process.env.FIN005_SEED_LOCALE || '').trim();
  if (raw !== 'en' && raw !== 'pl') {
    fail(
      `Refusing to run: --locale must be declared explicitly as "en" or "pl" (got "${raw || '<unset>'}"). ` +
        `It decides the customer-visible model and analysis titles, so it is never defaulted.`
    );
  }
  return raw;
}

async function presentColumnsOf(pool: pg.Pool, table: string): Promise<Set<string>> {
  const result = await pool.query(COLUMNS_QUERY, [table]);
  return new Set((result.rows || []).map((row) => String(row.column_name)));
}

async function snapshotPriorRows(
  pool: pg.Pool,
  organizationId: string
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const canonical = getAtelierFinanceCanonicalIds(organizationId);
  const snapshot: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of CANONICAL_TABLES) {
    const ids = canonical.byTable[table] || [];
    if (!ids.length) {
      snapshot[table] = [];
      continue;
    }
    try {
      const result = await pool.query(buildPriorStateQuery(table), [ids]);
      snapshot[table] = (result.rows || []) as Array<Record<string, unknown>>;
    } catch (error) {
      // A table missing from this schema is a fact worth recording, not a crash:
      // the fixture post-condition will refuse anyway if it mattered.
      snapshot[table] = [];
      // eslint-disable-next-line no-console
      console.warn(`[${LABEL}] could not snapshot "${table}": ${(error as Error).message}`);
    }
  }
  return snapshot;
}

export async function runFin005AtelierFinanceSeed(
  options: SeedRunOptions
): Promise<SeedRunOutcome> {
  const log = options.log ?? ((message: string) => console.log(message)); // eslint-disable-line no-console
  const args = parseArgs(options.argv);
  const dryRun = args.write !== 'true';
  const now = options.now ?? new Date();

  // (1) No escape hatches. Same doctrine as the cleanup script's removed
  //     `--force-org`: a tenant this script refuses is out of band, and gets its
  //     own packet and review — not a flag.
  for (const flag of REFUSED_FLAGS) {
    if (args[flag]) {
      fail(
        `--${flag} does not exist. This command has no override: every guard it applies is the reason ` +
          `it is allowed to write to a demo tenant at all.`
      );
    }
  }

  const locale = readLocale(args);

  // (2) Explicit target authority. Nothing is defaulted; a missing field is a
  //     refusal, not a guess.
  const declared = resolveDeclaredTarget(args);
  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget(LABEL, target);

  const fingerprint = parseConnectionFingerprint(target.connectionString);
  const approved = assertApprovedDemoTarget({
    declared,
    actual: fingerprint,
    allowlist: options.allowlist,
  });
  const demoOrgId = approved.organizationId;
  const runId = String(args['run-id'] || stamp(now)).trim();

  const pool = new pg.Pool({ connectionString: target.connectionString });
  const gateway: CleanupGateway = createPgGateway(pool);

  try {
    // (3) The database the SERVER reports — not the one the URL claims.
    const liveDatabase = await gateway.currentDatabase();
    if (liveDatabase && liveDatabase !== approved.database) {
      fail(
        `Connected to database "${liveDatabase}", but the approved target is "${approved.database}". Refusing to run.`
      );
    }

    // (4) The tenant must exist and be explicitly marked as a demo tenant.
    const org = await gateway.organizationExists(demoOrgId);
    if (!org) {
      fail(
        `Organization "${demoOrgId}" does not exist in the target database. This command never creates ` +
          `a tenant — seed the demo organization through its own path first.`
      );
    }
    assertDemoOrganizationMarker({
      organizationId: demoOrgId,
      observed: {
        columnPresent: org.organizationTypeColumnPresent,
        value: org.organizationType,
      },
      role: 'demo organization',
    });

    // (5) Pinned PostgreSQL. The seed promotes the fixture inside ONE pinned
    //     transaction; without it, promotion is not atomic and a crash leaves a
    //     half-READY fixture. Reported in a dry run so the operator learns
    //     before the write; a hard REFUSAL for `--write`. There is no fallback
    //     path here, and this command must not paper over one in the seed.
    const driverProbe = await probePinnedTransactionSupport();
    if (driverProbe.supported && driverProbe.database && driverProbe.database !== approved.database) {
      fail(
        `The seed's own database connection reports database "${driverProbe.database}", but the approved ` +
          `target is "${approved.database}". The preflight and the write would hit DIFFERENT databases. Refusing.`
      );
    }
    const capability = driverProbe.supported
      ? await probePinnedCapability(pool, approved.database)
      : { supported: false, reason: 'driver probe failed first' };
    const pinned: PinnedVerdict = {
      supported: driverProbe.supported && capability.supported,
      reason: driverProbe.supported
        ? `${driverProbe.reason}; ${capability.reason}`
        : driverProbe.reason,
    };
    log(
      `[${LABEL}] pinned PostgreSQL: ${pinned.supported ? 'AVAILABLE' : 'UNAVAILABLE'} — ${pinned.reason}`
    );

    // (6) Preflight — read-only, and the same read-back the quarantine uses.
    const priorFixture = await gateway.readCanonicalFixture(demoOrgId);
    const preflight = buildSeedPreflight(priorFixture, demoOrgId);
    const reportPath = path.join(
      exportsDir(),
      `fin005-atelier-seed-${dryRun ? 'dry-run' : 'write'}-${stamp(now)}.md`
    );
    fs.writeFileSync(
      reportPath,
      buildPreflightReport({ preflight, dryRun, host: target.host, database: target.database, runId, pinned }),
      'utf8'
    );

    log(
      `[${LABEL}] preflight for "${demoOrgId}": create=${preflight.summary.create} ` +
        `promote=${preflight.summary.promote} relink=${preflight.summary.relink} ` +
        `unchanged=${preflight.summary.unchanged}`
    );
    log(`- report: ${reportPath}`);

    if (dryRun) {
      if (preflight.fixtureReady) {
        log('✅ Dry run complete. Nothing was written.');
        log('   The canonical fixture is already materialized and READY — --write would change nothing.');
      } else {
        log('✅ Dry run complete. Nothing was written.');
        log(`   Re-run with --write and ${CONFIRM_ENV}=${CONFIRM_VALUE}.`);
      }
      if (!pinned.supported) {
        log(
          `⛔ --write would REFUSE: the pinned PostgreSQL promotion path is unavailable (${pinned.reason}). ` +
            `Fix the connection; there is no non-atomic fallback.`
        );
      }
      return { dryRun, runId, organizationId: demoOrgId, preflight, reportPath, pinned };
    }

    // ---- write path --------------------------------------------------------
    if (!pinned.supported) {
      fail(
        `Refusing to write: the pinned PostgreSQL promotion path is unavailable (${pinned.reason}). ` +
          `The fixture is promoted to READY inside ONE pinned transaction; without it a crash leaves a ` +
          `partially-promoted fixture. This command never falls back to a non-atomic path.`
      );
    }

    // (7) The confirmation token — its own, not the quarantine's.
    requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);

    log(
      `[${LABEL}] Write mode (run ${runId}). This will:\n` +
        `  - upsert the canonical Atelier Toys FY2014 pack, 3 statements, ` +
        `${getAtelierFinanceCanonicalIds(demoOrgId).statementValueIds.length} statement values, the ` +
        `approved analysis and the canonical ROI model in "${demoOrgId}";\n` +
        `  - promote them to READY inside ONE pinned PostgreSQL transaction;\n` +
        `  - touch no other organization and no row outside the canonical id set;\n` +
        `  - remove nothing, drop nothing, run no DDL.`
    );

    // (8) The recovery manifest, on disk and fsync'd, BEFORE the first mutation.
    const priorRows = await snapshotPriorRows(pool, demoOrgId);
    const manifestPath = path.join(exportsDir(), `fin005-atelier-seed-manifest-${stamp(now)}.json`);
    const manifest = buildRecoveryManifest({
      runId,
      createdAt: now,
      approved,
      locale,
      priorFixture,
      priorRows,
      plan: preflight.rows,
    });
    writeJsonFileAtomically(manifestPath, manifest);
    log(`- recovery manifest (prior state, written BEFORE the first write): ${manifestPath}`);

    // ---- the only mutations in this command --------------------------------
    const seedResult = await upsertAtelierFinanceGoldenFlow({
      organizationId: demoOrgId,
      createdBy: args['created-by'] ? String(args['created-by']) : null,
      projectId: args['project-id'] ? String(args['project-id']) : null,
      locale,
    });
    if (seedResult.status !== 'complete') {
      fail(
        `The Atelier Finance golden flow did not complete: ${seedResult.reason || 'no reason reported'}` +
          (seedResult.missing?.length ? ` (missing: ${seedResult.missing.join(', ')})` : '') +
          `. Nothing was promoted to READY; the quarantine must NOT be run.`
      );
    }

    const modelColumns = await presentColumnsOf(pool, 'financial_models');
    const modelUpsert = buildCanonicalModelUpsert({
      organizationId: demoOrgId,
      packId: seedResult.packId as string,
      modelId: getAtelierFinanceCanonicalIds(demoOrgId).modelId,
      locale,
      projectId: args['project-id'] ? String(args['project-id']) : null,
      createdBy: args['created-by'] ? String(args['created-by']) : null,
      presentColumns: modelColumns,
    });
    await pool.query(modelUpsert.sql, modelUpsert.params);

    // (9) Post-condition — prove READY by reading it back, never by assuming it.
    const afterFixture = await gateway.readCanonicalFixture(demoOrgId);
    assertCanonicalFixtureMaterialized(afterFixture, demoOrgId);
    const fixtureDigestAfter = computeCanonicalFixtureDigest(afterFixture);

    writeJsonFileAtomically(manifestPath, {
      ...manifest,
      status: 'COMPLETED' as const,
      postFixtureDigest: fixtureDigestAfter,
    });

    log(`✅ Seed complete — the canonical Atelier Finance fixture is materialized and READY in "${demoOrgId}".`);
    log(`- fixture digest (after): ${fixtureDigestAfter}`);
    log(`- manifest: ${manifestPath}`);
    log('- nothing was deleted, no organization was created or removed.');

    return {
      dryRun,
      runId,
      organizationId: demoOrgId,
      preflight,
      reportPath,
      manifestPath,
      fixtureDigestAfter,
      pinned,
    };
  } finally {
    await gateway.close().catch(() => undefined);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runFin005AtelierFinanceSeed({ argv });
}

/** Only the CLI entry auto-runs; importing this module executes nothing. */
function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`❌ ${LABEL} failed:`, error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
