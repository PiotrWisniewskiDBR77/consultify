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
 *  1. escape hatches refused    — `--force*` does not exist here either, and
 *     neither does `--database-url` (see ONE TARGET below);
 *  2. explicit target authority — every fingerprint field must be declared,
 *     nothing is defaulted (`assertApprovedDemoTarget`, shared with the
 *     cleanup script: production denylist → declared-vs-connected match →
 *     exact allowlist entry);
 *  3. server-side database check — the database the SERVER reports must be
 *     the approved one, not just the one in the URL;
 *  4. CONNECTION IDENTITY       — the connection that WRITES must be PROVEN to
 *     be the connection that was AUTHORISED, by cluster identity and not by
 *     name (see ONE TARGET below);
 *  5. strict demo marker        — `organizations.organization_type` must
 *     EXIST and be exactly `'DEMO'` (`assertDemoOrganizationMarker`);
 *  6. pinned PostgreSQL         — mandatory for `--write`. If the pinned
 *     promotion path is unavailable the run REFUSES. There is no fallback
 *     here and this script must never paper over one in the seed;
 *  7. preflight                 — reads the canonical fixture and reports
 *     exactly which rows would be created / promoted / re-linked / restated;
 *  8. confirmation token        — `FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW`,
 *     deliberately DIFFERENT from the cleanup script's
 *     `QUARANTINE_FOREIGN_FINANCE`, so a token pasted for one operation can
 *     never authorise the other;
 *  9. recovery manifest         — the full prior state of every canonical row
 *     is written, fsync'd and atomically renamed into place BEFORE the first
 *     mutation;
 * 10. post-condition            — the fixture is re-read and must pass
 *     `assertCanonicalFixtureMaterialized`, otherwise the run reports failure.
 *
 * ===========================================================================
 * ONE TARGET — the connection that WRITES is the connection that was AUTHORISED
 * ===========================================================================
 * Every guard above runs on THIS module's own `pg.Pool`. The writes do not:
 * `upsertAtelierFinanceGoldenFlow` goes through `DbPromise` →
 * `PostgresDatabase.getPool()` → `databaseConfig.postgres`, which resolves
 * `process.env.DATABASE_URL` (and `DB_HOST`/`DB_PORT`/`DB_NAME`, and
 * `DB_READ_URL`/`DB_READ_HOST` for reads) INDEPENDENTLY of anything this file
 * decides. Two resolutions, one authorisation.
 *
 * The earlier cross-check compared `current_database()` — a NAME. That is worth
 * nothing on Railway, where the demo database (`trolley…:28146/railway`) and
 * the production database (`centerbeam…:37823/railway`) are BOTH called
 * `railway`. `--database-url <demo>` with `DATABASE_URL=<production>` passed the
 * production denylist, the allowlist, the DEMO marker and the post-condition —
 * all read on demo — while the rows landed in production.
 *
 * Two changes close it, and both are needed:
 *
 *   (a) `--database-url` IS GONE. It was the only way to make the two
 *       resolutions read different inputs on purpose, so `process.env.
 *       DATABASE_URL` is now the single declared target for both. Passing the
 *       flag is a hard error, not a silently ignored argument.
 *
 *   (b) `assertSameConnectionIdentity` proves IDENTITY, not name. Both
 *       connections are asked for `pg_control_system().system_identifier` — a
 *       64-bit id generated by `initdb`, unique per cluster — plus
 *       `current_database()`, the database OID, `inet_server_addr()`,
 *       `inet_server_port()` and `pg_postmaster_start_time()`. Any difference
 *       is a REFUSAL, in a dry run as much as in a write.
 *
 * (b) is what actually enforces the invariant, because (a) alone does not:
 * `DatabaseConfig` still has its own `DB_HOST`/`DB_PORT`/`DB_NAME` fallback and
 * its own read-replica resolution, `DbPromise` caches its pool at first use, and
 * `NODE_ENV=test` lets `PostgresDatabase` override the database name. Each of
 * those can move the write connection out from under a correct declaration; all
 * of them are caught by comparing cluster identity.
 *
 * Both seams are probed, because the seed uses both:
 *   - the WRITE pool, reached through `getPoolClientForPinnedTransaction()` —
 *     the very connection `runPinnedPromotionTransaction` promotes on. Every
 *     identity field must match exactly.
 *   - the READ pool, reached through `DbPromise.all` — where the seed's own
 *     SELECTs go, and which is a DIFFERENT pool whenever a read replica is
 *     configured. `system_identifier`, database name and database OID must
 *     match; a physical replica shares all three, so a legitimate replica is
 *     allowed while a foreign cluster is not.
 *
 * If `pg_control_system()` cannot be read on either connection the run REFUSES
 * rather than degrading to the weaker fields: an unproven identity is exactly
 * the state this guard exists to reject.
 *
 * ===========================================================================
 * WHAT THIS SCRIPT NEVER DOES
 * ===========================================================================
 * No `DELETE`, no `DROP`, no `TRUNCATE`, no `ALTER`. It never creates and
 * never removes an organization — the target tenant must already exist and
 * already be marked `DEMO`. It touches no table outside the seven canonical
 * Finance tables, and no row outside the exact canonical id set from
 * `getAtelierFinanceCanonicalIds` plus the three canonical ROI model events.
 * Every one of those claims is asserted structurally by
 * `fin005SeedAtelierFinance.test.ts`, by scanning this module's source, by
 * pinning the exact bindings it imports and the exact gateway METHODS it calls,
 * and by inspecting the SQL its builders actually produce — not by trusting
 * this comment.
 *
 * DRY RUN IS THE DEFAULT. `--write` is the only way to mutate anything.
 *
 * ===========================================================================
 * USAGE
 * ===========================================================================
 *   # dry run (default, read-only, no confirmation token needed)
 *   DB_TYPE=postgres DATABASE_URL=<the ONE target> \
 *   npx tsx server/scripts/fin005-seed-atelier-finance.ts \
 *     --demo-org-id demo-org --locale en \
 *     --railway-project consultify --railway-environment demo \
 *     --railway-service Postgres \
 *     --expect-host trolley.proxy.rlwy.net --expect-port 28146 \
 *     --expect-database railway
 *
 *   # write
 *   DB_TYPE=postgres DATABASE_URL=<the ONE target> \
 *   FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW \
 *   npx tsx server/scripts/fin005-seed-atelier-finance.ts ... --write
 *
 * There is no `--database-url`. `DATABASE_URL` is the target for the guards and
 * for the writes alike, and the two are proved to be the same server before
 * anything else happens.
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
import {
  probePinnedTransactionSupport,
  proveDecisiveReadsGoToPrimary,
} from '../src/services/demo/atelierFinancePromotionTransaction.js';
import {
  atelierFinanceOperatorHoldDir,
  requireDurableOperatorHoldStorage,
  type DurableStorageVerdict,
} from '../src/services/demo/atelierFinanceOperatorHold.js';
// The WRITE seam, imported for a read-only identity probe and nothing else.
// `getPoolClientForPinnedTransaction()` is `PostgresDatabase.getPool().connect()`
// — the exact pool `DbPromise` writes through and the exact connection
// `runPinnedPromotionTransaction` promotes on. Its own doc comment names
// `atelierFinancePromotionTransaction.ts` as its intended caller; this is the
// second, deliberately narrow one, and it issues nothing but the identity
// SELECT below. (That comment lives in a file this packet does not modify.)
import { getPoolClientForPinnedTransaction } from '../src/database/PostgresDatabase.js';
// The READ seam. `DbPromise.all` is where the seed's own SELECTs go, and it
// resolves to the read-replica pool when one is configured.
import * as DbPromise from '../src/utils/DbPromise.js';
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

/**
 * The tables `verifyCanonicalFixture` governs — the fixture the quarantine's
 * precondition demands.
 */
export const CANONICAL_TABLES = [
  'financial_statement_packs',
  'financial_statements',
  'financial_statement_ingest_runs',
  'financial_statement_values',
  'financial_analyses',
  'financial_models',
] as const;

/**
 * The ROI model's economics. Not part of `verifyCanonicalFixture` (the fixture
 * verdict predates it), but part of what the demo run-sheet promises, so this
 * command seeds it, snapshots it and reports it exactly like the rest.
 */
export const MODEL_ECONOMICS_TABLES = ['financial_model_events'] as const;

/** Every table this script reads for the prior-state snapshot. */
export const SNAPSHOT_TABLES = [...CANONICAL_TABLES, ...MODEL_ECONOMICS_TABLES] as const;

export const MANIFEST_VERSION = 2;

function fail(message: string): never {
  throw new Error(`[${LABEL}] ${message}`);
}

function exportsDir(): string {
  // Anchored on this module's own location, NOT on the caller's cwd. Running
  // from inside `server/` used to resolve `server/server/exports/`, which the
  // `server/exports/` ignore rule does not match — that is how twelve generated
  // reports and manifests were committed by accident. `server/scripts/<file>`
  // -> up one -> `server/`.
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(serverRoot, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Connection identity — the write connection IS the authorised connection
// ---------------------------------------------------------------------------

/**
 * Everything a PostgreSQL backend can tell us about WHICH server and WHICH
 * database it is, without needing a table to exist.
 *
 * `systemIdentifier` is the discriminator that matters: `initdb` generates it
 * once per cluster from the wall clock and the postmaster pid, and it is what
 * WAL/replication uses to refuse a stream from a foreign cluster. Two Railway
 * services both serving a database called `railway` have different ones.
 */
export interface ConnectionIdentity {
  systemIdentifier: string | null;
  database: string;
  databaseOid: string;
  serverAddr: string;
  serverPort: string;
  postmasterStartEpoch: string;
  backendPid: string;
}

/**
 * Read-only, table-free, and deliberately free of `= 0` / `= 1` comparisons so
 * `PostgresDatabase.adaptQuery`'s boolean-flag rewriting cannot touch it.
 *
 * `pg_postmaster_start_time()` is compared as an epoch, not as text: the two
 * connections may carry different `TimeZone` settings, and a formatted
 * timestamp would then differ for a reason that has nothing to do with identity.
 */
export const CONNECTION_IDENTITY_SQL =
  `SELECT current_database() AS identity_database, ` +
  `(SELECT oid::text FROM pg_database WHERE datname = current_database()) AS identity_database_oid, ` +
  `COALESCE(host(inet_server_addr()), '<unix-socket>') AS identity_server_addr, ` +
  `COALESCE(inet_server_port()::text, '<none>') AS identity_server_port, ` +
  `extract(epoch from pg_postmaster_start_time())::text AS identity_postmaster_start, ` +
  `pg_backend_pid()::text AS identity_backend_pid`;

/**
 * Split out because it is the ONLY part an ordinary role may be refused:
 * `pg_control_system()` is superuser-only unless `EXECUTE` has been granted. A
 * failure here must not take the rest of the tuple down with it — it has to be
 * reported as "unreadable", which is itself a refusal, not a silent pass.
 */
export const CONNECTION_SYSTEM_IDENTIFIER_SQL =
  'SELECT system_identifier::text AS identity_system_identifier FROM pg_control_system()';

/** A row as either seam returns it. Both seams answer the same two statements. */
type IdentityRow = Record<string, unknown>;

function identityFromRows(base: IdentityRow | undefined, systemIdentifier: string | null): ConnectionIdentity {
  if (!base) fail('the connection did not answer the identity probe at all.');
  const read = (key: string): string => String((base as IdentityRow)[key] ?? '').trim();
  const database = read('identity_database');
  if (!database) {
    fail('the connection answered the identity probe without current_database(); it is not PostgreSQL.');
  }
  return {
    systemIdentifier,
    database,
    databaseOid: read('identity_database_oid'),
    serverAddr: read('identity_server_addr'),
    serverPort: read('identity_server_port'),
    postmasterStartEpoch: read('identity_postmaster_start'),
    backendPid: read('identity_backend_pid'),
  };
}

/** Probe an arbitrary `pg` pool — used for the AUTHORISED connection. */
export async function probePoolIdentity(pool: pg.Pool): Promise<ConnectionIdentity> {
  const base = (await pool.query(CONNECTION_IDENTITY_SQL)).rows?.[0] as IdentityRow | undefined;
  let systemIdentifier: string | null = null;
  try {
    const rows = (await pool.query(CONNECTION_SYSTEM_IDENTIFIER_SQL)).rows;
    systemIdentifier = String(rows?.[0]?.identity_system_identifier ?? '').trim() || null;
  } catch {
    systemIdentifier = null;
  }
  return identityFromRows(base, systemIdentifier);
}

/**
 * Probe the WRITE pool — `PostgresDatabase.getPool()`, the pool `DbPromise`
 * writes through. Checked out and released like any other borrower; it issues
 * two SELECTs and no transaction.
 */
export async function probeWritePathIdentity(): Promise<ConnectionIdentity> {
  const client = await getPoolClientForPinnedTransaction();
  try {
    const base = (await client.query(CONNECTION_IDENTITY_SQL)).rows?.[0] as IdentityRow | undefined;
    let systemIdentifier: string | null = null;
    try {
      const rows = (await client.query(CONNECTION_SYSTEM_IDENTIFIER_SQL)).rows;
      systemIdentifier = String(rows?.[0]?.identity_system_identifier ?? '').trim() || null;
    } catch {
      systemIdentifier = null;
    }
    return identityFromRows(base, systemIdentifier);
  } finally {
    client.release();
  }
}

/**
 * Probe the READ pool — `DbPromise.all`, which is the read-replica pool when
 * one is configured and the write pool otherwise.
 *
 * `fallback: false` matters: with the default, a timeout resolves to `[]` and
 * the probe would report "no identity" as if it were an answer.
 */
export async function probeReadPathIdentity(): Promise<ConnectionIdentity> {
  const base = (await DbPromise.all<IdentityRow>(CONNECTION_IDENTITY_SQL, [], { fallback: false }))?.[0];
  let systemIdentifier: string | null = null;
  try {
    const rows = await DbPromise.all<IdentityRow>(CONNECTION_SYSTEM_IDENTIFIER_SQL, [], {
      fallback: false,
    });
    systemIdentifier = String(rows?.[0]?.identity_system_identifier ?? '').trim() || null;
  } catch {
    systemIdentifier = null;
  }
  return identityFromRows(base, systemIdentifier);
}

export type IdentityField = keyof Omit<ConnectionIdentity, 'backendPid'>;

/**
 * The write connection must be the SAME BACKEND ADDRESS, the same cluster and
 * the same database. Nothing here is negotiable.
 */
export const WRITE_PATH_IDENTITY_FIELDS: readonly IdentityField[] = [
  'systemIdentifier',
  'database',
  'databaseOid',
  'serverAddr',
  'serverPort',
  'postmasterStartEpoch',
];

/**
 * The read connection must be the same CLUSTER and the same database. A
 * physical standby shares `system_identifier`, the database name and the
 * database OID with its primary, and legitimately differs on address, port and
 * postmaster start time — so those three are reported, not enforced. A foreign
 * cluster differs on `system_identifier` and is refused.
 */
export const READ_PATH_IDENTITY_FIELDS: readonly IdentityField[] = [
  'systemIdentifier',
  'database',
  'databaseOid',
];

export interface IdentityVerdict {
  proven: boolean;
  differences: string[];
  reason: string;
}

/**
 * Compare two identities over the given fields.
 *
 * `system_identifier` is mandatory on BOTH sides. Unreadable on one side only
 * is a difference in its own right (different privileges usually means a
 * different server, and in any case the strongest discriminator is missing on a
 * connection we are being asked to trust). Unreadable on both is a REFUSAL:
 * without it, two freshly created clusters can share a database name AND a
 * database OID — `initdb` hands out oid 16384 for the first user database on
 * every cluster there is — so the remaining fields do not add up to proof.
 */
export function compareConnectionIdentity(params: {
  authorised: ConnectionIdentity;
  observed: ConnectionIdentity;
  fields: readonly IdentityField[];
  role: string;
}): IdentityVerdict {
  const { authorised, observed, fields, role } = params;
  const differences: string[] = [];

  for (const field of fields) {
    const left = authorised[field];
    const right = observed[field];
    if (left === right) continue;
    differences.push(
      `${field}: authorised=${left === null ? '<unreadable>' : `"${left}"`} ` +
        `${role}=${right === null ? '<unreadable>' : `"${right}"`}`
    );
  }

  if (fields.includes('systemIdentifier') && !authorised.systemIdentifier && !observed.systemIdentifier) {
    differences.push(
      'systemIdentifier: unreadable on BOTH connections. pg_control_system() is superuser-only by ' +
        'default; grant EXECUTE on it to the role in DATABASE_URL, or connect as a role that has it. ' +
        'Identity cannot be proven from the remaining fields (a fresh cluster reproduces both the ' +
        'database name and the database OID), so this run refuses rather than guessing.'
    );
  }

  if (differences.length) {
    return {
      proven: false,
      differences,
      reason: `the ${role} connection is NOT the authorised connection`,
    };
  }
  return {
    proven: true,
    differences: [],
    reason:
      `${role} proved identical to the authorised connection ` +
      `(system_identifier ${observed.systemIdentifier}, database "${observed.database}" oid ${observed.databaseOid})`,
  };
}

/**
 * The guard itself. A mismatch is a hard failure in a DRY RUN too: a preflight
 * computed on one server while the writes would land on another is not a
 * preflight, it is a misleading report.
 */
export function assertSameConnectionIdentity(params: {
  authorised: ConnectionIdentity;
  observed: ConnectionIdentity;
  fields: readonly IdentityField[];
  role: string;
}): IdentityVerdict {
  const verdict = compareConnectionIdentity(params);
  if (verdict.proven) return verdict;
  fail(
    `Refusing to run: ${verdict.reason}. Every guard in this command (production denylist, allowlist, ` +
      `DEMO marker, preflight, post-condition) runs on the AUTHORISED connection, so a mismatch means ` +
      `the guards and the writes would hit DIFFERENT servers — the exact failure a database NAME check ` +
      `cannot see, because every Railway database is called "railway".\n` +
      verdict.differences.map((line) => `  - ${line}`).join('\n') +
      `\nThere is no --database-url to reconcile: set DATABASE_URL to the one approved target and re-run.`
  );
}

export interface ConnectionIdentityReport {
  proven: boolean;
  reason: string;
  authorised?: ConnectionIdentity;
  writePath?: ConnectionIdentity;
  readPath?: ConnectionIdentity;
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
 * command must not blank them.
 *
 * `assumptions_json` is deliberately NOT declared — not an omission. The full
 * dataset does not set it either (`upsertAtelierRoiFinancialModel` lists twelve
 * columns and `assumptions_json` is not among them), so declaring one here would
 * invent economics the canonical fixture does not have. The model's balance-sheet
 * openers stay at the compute engine's zero defaults, exactly as on a
 * fully-seeded tenant, and `getModelAssumptionsStatus` already reports the model
 * as GROUNDED off `source_statement_pack_id`, which this command does set.
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

// ---------------------------------------------------------------------------
// The canonical ROI model's economics
// ---------------------------------------------------------------------------

/**
 * The three economic events that make the ROI model an ROI model.
 *
 * TRANSCRIBED, NOT INVENTED. Every field below is copied from
 * `demoSeedService.upsertAtelierRoiFinancialModel`, which is the only other
 * writer of these rows; `fin005SeedAtelierFinance.test.ts` reads that function's
 * source and asserts the two agree, so a change there fails here.
 *
 * WHY THIS COMMAND SEEDS THEM AT ALL. `buildCanonicalModelUpsert` writes an
 * `approved` model. On a tenant that never ran the full dataset that model had
 * no events, and could never get any: `FinancialModelWorkspace` shows "no
 * forecast events yet", `POST /models/:id/compute` is blocked by the demo
 * read-only guard, and `reseedModelFromSource` refuses an `approved` model. The
 * state was permanent — no NPV, no ROI, no payback — while §8 of the runbook
 * passed, because §8 only checked the model's NAME and SOURCE. The packet's GO
 * criterion is that the calculation has a reproducible INPUT, RESULT and SOURCE;
 * these events are the input.
 *
 * `growth_rate: 0.08` is transcribed verbatim including its quirk: the compute
 * engine reads it as a percentage (`event.growth_rate / 100`), so 0.08 means
 * 0.08%/yr, not 8%. Changing it here would make the narrow command disagree with
 * the full dataset — a different bug from the one being fixed, and not this
 * packet's to make.
 */
export const CANONICAL_MODEL_EVENTS = [
  {
    slug: 'revenue-uplift',
    eventType: 'revenue',
    nameEn: 'Revenue uplift (digitized lines)',
    namePl: 'Wzrost przychodów (zdigitalizowane linie)',
    amount: 2_400_000,
    periodStart: '2015-01-01',
    recurrence: 'annual',
    growthRate: 0.08,
    cfClassification: 'operating',
    sortOrder: 1,
  },
  {
    slug: 'digital-capex',
    eventType: 'capex_purchase',
    nameEn: 'Digital transformation capex',
    namePl: 'Capex transformacji cyfrowej',
    amount: 800_000,
    periodStart: '2015-01-01',
    recurrence: 'one_time',
    growthRate: 0,
    cfClassification: 'investing',
    sortOrder: 2,
  },
  {
    slug: 'opex-reduction',
    eventType: 'opex',
    nameEn: 'OpEx reduction (automation)',
    namePl: 'Redukcja OpEx (automatyzacja)',
    amount: -400_000,
    periodStart: '2016-01-01',
    recurrence: 'annual',
    growthRate: 0,
    cfClassification: 'operating',
    sortOrder: 3,
  },
] as const;

export type CanonicalModelEvent = (typeof CANONICAL_MODEL_EVENTS)[number];

/** Same id convention as everything else in the canonical set. */
export function canonicalModelEventId(organizationId: string, slug: string): string {
  return `${organizationId}--financial-model-event--${slug}`;
}

export function canonicalModelEventIds(organizationId: string): string[] {
  return CANONICAL_MODEL_EVENTS.map((event) => canonicalModelEventId(organizationId, event.slug));
}

/** The canonical id set this command may touch, per snapshot table. */
export function canonicalIdsByTable(organizationId: string): Record<string, string[]> {
  const canonical = getAtelierFinanceCanonicalIds(organizationId);
  const byTable: Record<string, string[]> = {};
  for (const table of CANONICAL_TABLES) byTable[table] = canonical.byTable[table] || [];
  byTable.financial_model_events = canonicalModelEventIds(organizationId);
  return byTable;
}

/**
 * One event upsert. Same INSERT-ONLY vs UPDATABLE split as the model:
 * `name`, `amount`, `currency` and `is_active` are the fields FIN-005 is about,
 * everything else is written once and never overwritten. The `WHERE … IS
 * DISTINCT FROM` guard means an unchanged re-run writes ZERO rows.
 *
 * `demoSeedService` updates exactly the same four columns; the only deliberate
 * difference is that this statement also refreshes `updated_at` when — and only
 * when — it really changes something.
 */
export function buildCanonicalModelEventUpsert(params: {
  organizationId: string;
  modelId: string;
  event: CanonicalModelEvent;
  locale: 'en' | 'pl';
  createdBy: string | null;
  presentColumns: ReadonlySet<string>;
}): { sql: string; params: unknown[] } {
  const { event } = params;
  const declaredColumns: Array<[string, unknown]> = [
    ['id', canonicalModelEventId(params.organizationId, event.slug)],
    ['model_id', params.modelId],
    ['event_type', event.eventType],
    ['name', params.locale === 'pl' ? event.namePl : event.nameEn],
    ['amount', event.amount],
    ['currency', ATELIER_FINANCE_CURRENCY],
    ['period_start', event.periodStart],
    ['recurrence', event.recurrence],
    ['growth_rate', event.growthRate],
    ['cf_classification', event.cfClassification],
    ['posting_rules', '{}'],
    ['sort_order', event.sortOrder],
    ['is_active', true],
    ['created_by', params.createdBy],
  ];
  const columns = declaredColumns.filter(([column]) => params.presentColumns.has(column));

  const required = ['id', 'model_id', 'event_type', 'name', 'amount', 'cf_classification'];
  const missing = required.filter((column) => !params.presentColumns.has(column));
  if (missing.length) {
    fail(
      `financial_model_events is missing required column(s) ${missing.join(', ')} in this schema. ` +
        `The ROI model cannot carry its economics. Migrate first; this script does not run DDL.`
    );
  }

  const updatable = ['name', 'amount', 'currency', 'is_active'].filter((column) =>
    params.presentColumns.has(column)
  );
  const names = columns.map(([column]) => `"${column}"`).join(', ');
  const placeholders = columns.map((_column, index) => `$${index + 1}`).join(', ');
  const setClause = [
    ...updatable.map((column) => `"${column}" = excluded."${column}"`),
    ...(params.presentColumns.has('updated_at') ? ['"updated_at" = CURRENT_TIMESTAMP'] : []),
  ].join(', ');
  const guard = updatable
    .map((column) => `financial_model_events."${column}" IS DISTINCT FROM excluded."${column}"`)
    .join(' OR ');

  return {
    sql:
      `INSERT INTO financial_model_events (${names}) VALUES (${placeholders}) ` +
      `ON CONFLICT (id) DO UPDATE SET ${setClause} WHERE ${guard}`,
    params: columns.map(([, value]) => value),
  };
}

/** Read-only: what the canonical events look like right now. */
export const MODEL_EVENTS_READBACK_QUERY =
  `SELECT id, model_id, name, amount, currency, is_active ` +
  `FROM financial_model_events WHERE id = ANY($1::text[]) ORDER BY id`;

/** The prior-state snapshot read. Read-only by construction. */
export function buildPriorStateQuery(table: string): string {
  if (!(SNAPSHOT_TABLES as readonly string[]).includes(table)) {
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
 * `buildCanonicalModelUpsert` and `buildCanonicalModelEventUpsert` are the ONLY
 * writing statements in the file; everything else is a SELECT.
 */
export const SQL_BUILDERS_IN_THIS_MODULE = [
  'buildCanonicalModelUpsert',
  'buildCanonicalModelEventUpsert',
  'buildPriorStateQuery',
  'COLUMNS_QUERY',
  'MODEL_EVENTS_READBACK_QUERY',
  'CONNECTION_IDENTITY_SQL',
  'CONNECTION_SYSTEM_IDENTIFIER_SQL',
];

/**
 * The exact bindings this module imports from the cleanup script, pinned so the
 * structural test can assert them rather than trusting a prose claim. The
 * cleanup gateway also exposes `withTransaction` and a destructive transaction
 * type; this list is what proves they are not reachable from here.
 */
export const CLEANUP_IMPORTS = [
  'createPgGateway',
  'parseArgs',
  'parseConnectionFingerprint',
  'resolveDeclaredTarget',
  'stamp',
  'writeJsonFileAtomically',
  'CleanupGateway',
];

/** The only gateway methods this module calls. Every one of them is a read. */
export const GATEWAY_METHODS_USED = [
  'currentDatabase',
  'organizationExists',
  'readCanonicalFixture',
  'close',
];

// ---------------------------------------------------------------------------
// Hosted or local? (FIN-005 P1-A #4, P1-B #1)
// ---------------------------------------------------------------------------

/**
 * A HOSTED target is one where the process running this command is not the
 * machine holding the database — i.e. anything that is not a loopback address.
 *
 * Two guards key off this and only this:
 *   - the operator hold must live on a mounted volume, because a hosted
 *     container's filesystem is ephemeral and NEEDS_OPERATOR must survive a
 *     redeploy;
 *   - the decisive reads must be PROVED to reach the primary, because a hosted
 *     deployment is where a read replica actually exists.
 *
 * A local scratch database (the DB-backed suites, a developer's laptop) has
 * neither hazard: there is no volume to mount and no replica to lag. The
 * decisive-read proof still RUNS there — it is just not a hard refusal, because
 * the run cannot reach a replica it does not have.
 */
export function isHostedTarget(host: string): boolean {
  const normalized = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized) return false;
  return !['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal'].includes(normalized);
}

export interface DecisiveReadReport {
  proven: boolean;
  reason: string;
}

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

export type PreflightAction = 'create' | 'promote' | 'relink' | 'restate' | 'unchanged';

/** One canonical ROI model event, as the database currently holds it. */
export interface ModelEventReadback {
  id: string;
  modelId: string | null;
  name: string | null;
  amount: number | null;
  currency: string | null;
  isActive: boolean | null;
}

export interface PreflightRow {
  table: string;
  id: string;
  action: PreflightAction;
  detail: string;
}

export interface SeedPreflight {
  organizationId: string;
  /** `verifyCanonicalFixture`'s verdict — the quarantine's precondition. */
  fixtureReady: boolean;
  /** The three canonical ROI model events, present with canonical values. */
  economicsReady: boolean;
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
 * pointing at the wrong parent; `restate` — present but carrying non-canonical
 * values (used for the ROI model events, which have no readiness state to
 * promote); `unchanged` — nothing to do.
 *
 * The fixture part of the plan is derived from the SAME read-back the
 * quarantine's precondition uses, so "what the seed would change" and "what the
 * quarantine demands" can never be two different pictures. The economics part
 * sits alongside it: `verifyCanonicalFixture` predates the ROI model's events
 * and says nothing about them, so `fixtureReady` and `economicsReady` are
 * reported separately and neither is inferred from the other.
 */
export function buildSeedPreflight(
  readback: CanonicalFixtureReadback,
  organizationId: string,
  modelEvents: ModelEventReadback[] = []
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

  // ---- the ROI model's economics ------------------------------------------
  // Compared on exactly the four fields the upsert may change, so "unchanged"
  // here means "the upsert's WHERE guard would write nothing".
  const expectedName = (event: CanonicalModelEvent, locale: 'en' | 'pl'): string =>
    locale === 'pl' ? event.namePl : event.nameEn;
  for (const event of CANONICAL_MODEL_EVENTS) {
    const id = canonicalModelEventId(organizationId, event.slug);
    const observed = modelEvents.find((row) => row.id === id);
    if (!observed) {
      rows.push({ table: 'financial_model_events', id, action: 'create', detail: 'absent' });
      continue;
    }
    const drift: string[] = [];
    // Locale is not known to the preflight (it is a CLI argument, and the
    // preflight is a read); either canonical name counts as canonical.
    if (observed.name !== expectedName(event, 'en') && observed.name !== expectedName(event, 'pl')) {
      drift.push(`name=${observed.name ?? '<null>'}`);
    }
    if (Number(observed.amount) !== event.amount) drift.push(`amount=${String(observed.amount)}`);
    if (observed.currency !== ATELIER_FINANCE_CURRENCY) drift.push(`currency=${observed.currency ?? '<null>'}`);
    if (observed.isActive === false) drift.push('is_active=false');
    if (observed.modelId !== canonical.modelId) drift.push(`model_id=${observed.modelId ?? '<null>'}`);
    if (drift.length) {
      rows.push({ table: 'financial_model_events', id, action: 'restate', detail: drift.join(' ') });
      continue;
    }
    rows.push({ table: 'financial_model_events', id, action: 'unchanged', detail: 'canonical' });
  }

  const summary: Record<PreflightAction, number> = {
    create: 0,
    promote: 0,
    relink: 0,
    restate: 0,
    unchanged: 0,
  };
  for (const row of rows) summary[row.action] += 1;

  const { ok, violations } = verifyCanonicalFixture(readback, organizationId);
  const economicsReady = rows
    .filter((row) => row.table === 'financial_model_events')
    .every((row) => row.action === 'unchanged');
  return {
    organizationId,
    fixtureReady: ok,
    economicsReady,
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
  identity: ConnectionIdentityReport;
  decisiveReads: DecisiveReadReport;
  durableHoldStorage: DurableStorageVerdict;
}): string {
  const { preflight } = params;
  const lines: string[] = [];
  lines.push(`# FIN-005 — seed Atelier Finance (${params.dryRun ? 'DRY RUN' : 'WRITE'})`);
  lines.push('');
  lines.push(`- run id: \`${params.runId}\``);
  lines.push(`- host: \`${params.host}\``);
  lines.push(`- database: \`${params.database}\``);
  lines.push(`- organization: \`${preflight.organizationId}\``);
  lines.push(
    `- connection identity: ${params.identity.proven ? 'PROVEN' : 'UNPROVEN'} — ${params.identity.reason}`
  );
  if (params.identity.authorised) {
    lines.push(
      `  - authorised: system_identifier \`${params.identity.authorised.systemIdentifier ?? '<unreadable>'}\`, ` +
        `\`${params.identity.authorised.serverAddr}:${params.identity.authorised.serverPort}/` +
        `${params.identity.authorised.database}\` (oid ${params.identity.authorised.databaseOid})`
    );
  }
  lines.push(`- pinned PostgreSQL: ${params.pinned.supported ? 'AVAILABLE' : 'UNAVAILABLE'} — ${params.pinned.reason}`);
  lines.push(
    `- decisive reads: ${params.decisiveReads.proven ? 'PRIMARY PROVEN' : 'UNPROVEN'} — ${params.decisiveReads.reason}`
  );
  lines.push(
    `- durable operator hold: ${params.durableHoldStorage.ok ? 'OK' : 'REFUSED'} (${params.durableHoldStorage.source}) — ${params.durableHoldStorage.reason}`
  );
  lines.push(`- fixture digest (before): \`${preflight.digest}\``);
  lines.push(
    `- plan: create=${preflight.summary.create} promote=${preflight.summary.promote} ` +
      `relink=${preflight.summary.relink} restate=${preflight.summary.restate} ` +
      `unchanged=${preflight.summary.unchanged}`
  );
  lines.push('');
  lines.push('## Rows that would change');
  lines.push('');
  const changing = preflight.rows.filter((row) => row.action !== 'unchanged');
  if (!changing.length) {
    lines.push(
      '_Nothing. The canonical fixture is already materialized and READY, and the ROI model carries its canonical economics._'
    );
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
  lines.push('## ROI model economics (before)');
  lines.push('');
  lines.push(
    preflight.economicsReady
      ? 'CANONICAL — the three forecast events are present with canonical values.'
      : 'NOT CANONICAL — see the `financial_model_events` rows above.'
  );
  lines.push('');
  lines.push('## Not touched by this command');
  lines.push('');
  lines.push('- no organization is created, modified or removed;');
  lines.push('- no destructive statement of any kind: no row removal, no DDL;');
  lines.push('- no table outside the seven canonical Finance tables;');
  lines.push('- no row outside the exact canonical id set;');
  lines.push(
    '- `financial_model_outputs` / `financial_model_validations` are NOT written: their only writer ' +
      'is `persistComputeResult`, which starts by deleting every existing output row. Importing it ' +
      'would put a destructive statement inside this command, which is the one thing it may never ' +
      'contain. The computed RESULT is therefore an operator step, not a seed step — runbook §8.'
  );
  lines.push(
    '- `analysis_financials` / `digitization_analyses` are NOT written: the full dataset only writes ' +
      'them when the `line-3-digital-twin` initiative exists, which is a spine object outside this ' +
      "command's scope. On a tenant without it the full dataset writes nothing there either."
  );
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
    /**
     * The proof that the connection which wrote is the connection that was
     * authorised — not just its name. Recorded so the evidence survives the run.
     */
    systemIdentifier: string | null;
    databaseOid: string | null;
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
  identity?: ConnectionIdentity;
}): SeedRecoveryManifest {
  const absentBefore: Record<string, string[]> = {};
  const byTable = canonicalIdsByTable(params.approved.organizationId);
  for (const table of SNAPSHOT_TABLES) {
    const present = new Set((params.priorRows[table] || []).map((row) => String(row.id)));
    absentBefore[table] = (byTable[table] || []).filter((id) => !present.has(id));
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
      systemIdentifier: params.identity?.systemIdentifier ?? null,
      databaseOid: params.identity?.databaseOid ?? null,
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
  identity: ConnectionIdentityReport;
  /** FIN-005 P1-A #4 — are the decisive reads proved to reach the primary? */
  decisiveReads: DecisiveReadReport;
  /** FIN-005 P1-B #1 — can a NEEDS_OPERATOR hold survive a redeploy? */
  durableHoldStorage: DurableStorageVerdict;
  hosted: boolean;
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

/** Read the canonical ROI model events. Read-only by construction. */
export async function readModelEvents(
  pool: pg.Pool,
  organizationId: string
): Promise<ModelEventReadback[]> {
  try {
    const result = await pool.query(MODEL_EVENTS_READBACK_QUERY, [
      canonicalModelEventIds(organizationId),
    ]);
    return (result.rows || []).map((row) => ({
      id: String(row.id),
      modelId: row.model_id === null || row.model_id === undefined ? null : String(row.model_id),
      name: row.name === null || row.name === undefined ? null : String(row.name),
      amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
      currency: row.currency === null || row.currency === undefined ? null : String(row.currency),
      isActive: row.is_active === null || row.is_active === undefined ? null : Boolean(row.is_active),
    }));
  } catch (error) {
    // A schema without the table is a fact the preflight should show as
    // "everything absent", not a crash. The upsert refuses later if it matters.
    // eslint-disable-next-line no-console
    console.warn(`[${LABEL}] could not read financial_model_events: ${(error as Error).message}`);
    return [];
  }
}

async function snapshotPriorRows(
  pool: pg.Pool,
  organizationId: string
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const byTable = canonicalIdsByTable(organizationId);
  const snapshot: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of SNAPSHOT_TABLES) {
    const ids = byTable[table] || [];
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

  // (1b) `--database-url` is gone, and its absence is enforced rather than
  //      assumed. It was the one input that could make the guards read one
  //      server while `DbPromise` wrote to another — the two resolve
  //      independently, and every Railway database is called "railway", so a
  //      name comparison never noticed. DATABASE_URL is now the single target
  //      for both, and guard (4) proves they really are the same server.
  if (args['database-url']) {
    fail(
      `--database-url does not exist. It selected the target for this command's GUARDS only; the seed ` +
        `writes through DbPromise, which resolves DATABASE_URL on its own. Passing a different value to ` +
        `each is how a run guarded against demo writes to production — both are named "railway". Set ` +
        `DATABASE_URL to the one approved target and pass no URL flag.`
    );
  }

  const locale = readLocale(args);

  // (2) Explicit target authority. Nothing is defaulted; a missing field is a
  //     refusal, not a guess.
  const declared = resolveDeclaredTarget(args);
  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: process.env.DATABASE_URL,
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
  const hosted = isHostedTarget(target.host);

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

    // (4) CONNECTION IDENTITY — the whole point of this guard is that it fires
    //     BEFORE anything reads the tenant. If the writes would land somewhere
    //     else, every later read is describing the wrong server, so there is
    //     nothing worth reading yet.
    //
    //     The driver probe comes first only because it answers "is DbPromise
    //     even talking to PostgreSQL"; on a mocked seam there is no identity to
    //     compare, the run is marked UNPROVEN, and `--write` refuses below
    //     (a mocked driver also fails the pinned-capability guard).
    const driverProbe = await probePinnedTransactionSupport();
    const identity: ConnectionIdentityReport = { proven: false, reason: 'not probed' };
    if (!driverProbe.supported) {
      identity.reason =
        `UNPROVEN — the seed's own database module is not a live PostgreSQL driver (${driverProbe.reason}), ` +
        `so its connection identity cannot be read. --write refuses.`;
    } else {
      const authorised = await probePoolIdentity(pool);
      identity.authorised = authorised;

      const writePath = await probeWritePathIdentity();
      identity.writePath = writePath;
      assertSameConnectionIdentity({
        authorised,
        observed: writePath,
        fields: WRITE_PATH_IDENTITY_FIELDS,
        role: 'write-path (DbPromise → PostgresDatabase.getPool)',
      });

      const readPath = await probeReadPathIdentity();
      identity.readPath = readPath;
      assertSameConnectionIdentity({
        authorised,
        observed: readPath,
        fields: READ_PATH_IDENTITY_FIELDS,
        role: 'read-path (DbPromise.all → read pool)',
      });

      identity.proven = true;
      identity.reason =
        `PROVEN — the authorised pool, the write pool and the read pool are all cluster ` +
        `${authorised.systemIdentifier}, database "${authorised.database}" (oid ${authorised.databaseOid}) ` +
        `at ${authorised.serverAddr}:${authorised.serverPort}`;
    }
    log(`[${LABEL}] connection identity: ${identity.reason}`);

    // (5) The tenant must exist and be explicitly marked as a demo tenant.
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

    // (6) Pinned PostgreSQL. The seed promotes the fixture inside ONE pinned
    //     transaction; without it, promotion is not atomic and a crash leaves a
    //     half-READY fixture. Reported in a dry run so the operator learns
    //     before the write; a hard REFUSAL for `--write`. There is no fallback
    //     path here, and this command must not paper over one in the seed.
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

    // (6b) DECISIVE READS FROM THE PRIMARY — FIN-005 P1-A #4.
    //
    //     Guard (4) proves the read pool is on the same CLUSTER and the same
    //     DATABASE as the primary. It cannot prove more than that, and it is
    //     right not to try: a physical standby shares `system_identifier`, the
    //     database name AND the database OID with its primary, so those fields
    //     are exactly what a legitimate replica reproduces. What a standby does
    //     NOT reproduce is the WAL position — it lags — and a post-write
    //     verification served by a lagging standby reads the PRE-write rows and
    //     concludes the write failed. The seed's answer to "the write failed" is
    //     to compensate.
    //
    //     So this asks a different question: does the connection the seed's
    //     DECISIVE reads are bound to answer `pg_is_in_recovery() = false`? That
    //     is the one field a standby cannot fake. A hosted `--write` refuses
    //     without the proof.
    const decisiveProof = await proveDecisiveReadsGoToPrimary();
    const decisiveReads: DecisiveReadReport = {
      proven: decisiveProof.proven,
      reason: decisiveProof.reason,
    };
    log(
      `[${LABEL}] decisive reads: ${decisiveReads.proven ? 'PRIMARY PROVEN' : 'UNPROVEN'} — ${decisiveReads.reason}`
    );

    // (6c) DURABLE OPERATOR HOLD — FIN-005 P1-B #1-#4.
    //
    //     The hold is the record that says "a COMMIT is in doubt, do not touch
    //     this tenant". Without a mounted volume it lands on the container's own
    //     filesystem and dies with the next redeploy — which is precisely when a
    //     NEEDS_OPERATOR run is followed by a redeploy. Durability is PROVED
    //     here by performing the whole fsync/rename sequence, not by observing
    //     that an environment variable exists.
    const durableHoldStorage = hosted
      ? requireDurableOperatorHoldStorage()
      : {
          ok: true,
          dir: atelierFinanceOperatorHoldDir(),
          source: 'none' as const,
          reason:
            `local target (${target.host}) — the hold lands in ${atelierFinanceOperatorHoldDir()} and the ` +
            `mounted-volume requirement does not apply; the seed still proves the directory is writable ` +
            `and fsync-able before its first mutation`,
        };
    log(
      `[${LABEL}] durable operator hold: ${durableHoldStorage.ok ? 'OK' : 'REFUSED'} — ${durableHoldStorage.reason}`
    );

    // (7) Preflight — read-only, and the same read-back the quarantine uses.
    const priorFixture = await gateway.readCanonicalFixture(demoOrgId);
    const priorEvents = await readModelEvents(pool, demoOrgId);
    const preflight = buildSeedPreflight(priorFixture, demoOrgId, priorEvents);
    const reportPath = path.join(
      exportsDir(),
      `fin005-atelier-seed-${dryRun ? 'dry-run' : 'write'}-${stamp(now)}.md`
    );
    fs.writeFileSync(
      reportPath,
      buildPreflightReport({
        preflight,
        dryRun,
        host: target.host,
        database: target.database,
        runId,
        pinned,
        identity,
        decisiveReads,
        durableHoldStorage,
      }),
      'utf8'
    );

    log(
      `[${LABEL}] preflight for "${demoOrgId}": create=${preflight.summary.create} ` +
        `promote=${preflight.summary.promote} relink=${preflight.summary.relink} ` +
        `restate=${preflight.summary.restate} unchanged=${preflight.summary.unchanged}`
    );
    log(`- report: ${reportPath}`);

    if (dryRun) {
      const nothingToDo =
        preflight.fixtureReady &&
        preflight.economicsReady &&
        preflight.rows.every((row) => row.action === 'unchanged');
      log('✅ Dry run complete. Nothing was written.');
      if (nothingToDo) {
        log(
          '   The canonical fixture is already materialized and READY, and the ROI model carries its ' +
            'canonical economics — --write would change nothing.'
        );
      } else {
        log(`   Re-run with --write and ${CONFIRM_ENV}=${CONFIRM_VALUE}.`);
      }
      if (!pinned.supported) {
        log(
          `⛔ --write would REFUSE: the pinned PostgreSQL promotion path is unavailable (${pinned.reason}). ` +
            `Fix the connection; there is no non-atomic fallback.`
        );
      }
      if (!identity.proven) {
        log(
          `⛔ --write would REFUSE: the connection that writes was not proved to be the connection that ` +
            `was authorised (${identity.reason}).`
        );
      }
      if (hosted && !decisiveReads.proven) {
        log(
          `⛔ --write would REFUSE: the seed's decisive reads were not proved to reach the PRIMARY ` +
            `(${decisiveReads.reason}). A lagging replica turns a successful write into a compensation.`
        );
      }
      if (!durableHoldStorage.ok) {
        log(
          `⛔ --write would REFUSE: ${durableHoldStorage.reason} A NEEDS_OPERATOR hold that does not ` +
            `survive a redeploy is not a hold.`
        );
      }
      return {
        dryRun,
        runId,
        organizationId: demoOrgId,
        preflight,
        reportPath,
        pinned,
        identity,
        decisiveReads,
        durableHoldStorage,
        hosted,
      };
    }

    // ---- write path --------------------------------------------------------
    // Belt and braces. `assertSameConnectionIdentity` already threw for a real
    // mismatch; this catches the remaining case — a seam where identity could
    // not be read at all — and states the rule at the point of the write.
    if (!identity.proven) {
      fail(
        `Refusing to write: ${identity.reason} The connection that writes must be PROVEN to be the ` +
          `connection that was authorised, and an unproven identity is not a proof.`
      );
    }
    if (!pinned.supported) {
      fail(
        `Refusing to write: the pinned PostgreSQL promotion path is unavailable (${pinned.reason}). ` +
          `The fixture is promoted to READY inside ONE pinned transaction; without it a crash leaves a ` +
          `partially-promoted fixture. This command never falls back to a non-atomic path.`
      );
    }

    // FIN-005 P1-A #4. Every SQL write below this line is still un-issued.
    if (hosted && !decisiveReads.proven) {
      fail(
        `Refusing to write: the seed's DECISIVE reads were not proved to reach the primary ` +
          `(${decisiveReads.reason}). Promotion verification, the post-condition, reconciliation, the ` +
          `decision to compensate and the complete/incomplete verdict are all computed from those reads. ` +
          `A read replica shares system_identifier, database name and database OID with its primary — the ` +
          `identity guard above cannot tell them apart — but it LAGS, so a verification served by one sees ` +
          `the pre-write rows and concludes the write failed. On a hosted target that proof is mandatory.`
      );
    }

    // FIN-005 P1-B #1-#4. Also still before the first SQL write.
    if (!durableHoldStorage.ok) {
      fail(
        `Refusing to write: ${durableHoldStorage.reason} The seed can end in NEEDS_OPERATOR (a COMMIT ` +
          `whose answer was lost), and that verdict is a FILE. If the file cannot outlive the container, ` +
          `the next run erases the only evidence of an in-doubt COMMIT — which is the exact failure this ` +
          `guard exists to prevent. Attach a volume and set STORAGE_DIR to its mount path.`
      );
    }

    // (8) The confirmation token — its own, not the quarantine's.
    requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);

    log(
      `[${LABEL}] Write mode (run ${runId}). This will:\n` +
        `  - upsert the canonical Atelier Toys FY2014 pack, 3 statements, ` +
        `${getAtelierFinanceCanonicalIds(demoOrgId).statementValueIds.length} statement values, the ` +
        `approved analysis, the canonical ROI model and its ${CANONICAL_MODEL_EVENTS.length} forecast ` +
        `events in "${demoOrgId}";\n` +
        `  - promote them to READY inside ONE pinned PostgreSQL transaction;\n` +
        `  - touch no other organization and no row outside the canonical id set;\n` +
        `  - remove nothing, drop nothing, run no DDL.`
    );

    // (9) The recovery manifest, on disk and fsync'd, BEFORE the first mutation.
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
      identity: identity.authorised,
    });
    writeJsonFileAtomically(manifestPath, manifest);
    log(`- recovery manifest (prior state, written BEFORE the first write): ${manifestPath}`);

    // ---- the only mutations in this command --------------------------------
    const seedResult = await upsertAtelierFinanceGoldenFlow({
      organizationId: demoOrgId,
      createdBy: args['created-by'] ? String(args['created-by']) : null,
      projectId: args['project-id'] ? String(args['project-id']) : null,
      locale,
      // Stamped into the PROMOTION_IN_PROGRESS marker, so a marker found by a
      // LATER run names the operator run that wrote it — and so that later run
      // is structurally unable to remove it (FIN-005 P1-B #10).
      runId,
    });
    if (seedResult.status !== 'complete') {
      fail(
        `The Atelier Finance golden flow did not complete: ${seedResult.reason || 'no reason reported'}` +
          (seedResult.missing?.length ? ` (missing: ${seedResult.missing.join(', ')})` : '') +
          `. Nothing was promoted to READY; the quarantine must NOT be run.`
      );
    }

    const modelId = getAtelierFinanceCanonicalIds(demoOrgId).modelId;
    const createdBy = args['created-by'] ? String(args['created-by']) : null;
    const modelColumns = await presentColumnsOf(pool, 'financial_models');
    const modelUpsert = buildCanonicalModelUpsert({
      organizationId: demoOrgId,
      packId: seedResult.packId as string,
      modelId,
      locale,
      projectId: args['project-id'] ? String(args['project-id']) : null,
      createdBy,
      presentColumns: modelColumns,
    });
    await pool.query(modelUpsert.sql, modelUpsert.params);

    // The ROI model's economics. AFTER the model upsert: `financial_model_events`
    // carries a foreign key to `financial_models(id)`, so the parent has to
    // exist first. Insert-only, guarded, and one statement per event so a
    // schema that is missing the table fails loudly instead of half-writing.
    const eventColumns = await presentColumnsOf(pool, 'financial_model_events');
    for (const event of CANONICAL_MODEL_EVENTS) {
      const eventUpsert = buildCanonicalModelEventUpsert({
        organizationId: demoOrgId,
        modelId,
        event,
        locale,
        createdBy,
        presentColumns: eventColumns,
      });
      await pool.query(eventUpsert.sql, eventUpsert.params);
    }

    // (10) Post-condition — prove it by reading it back, never by assuming it.
    const afterFixture = await gateway.readCanonicalFixture(demoOrgId);
    assertCanonicalFixtureMaterialized(afterFixture, demoOrgId);
    const fixtureDigestAfter = computeCanonicalFixtureDigest(afterFixture);

    // The economics are not part of `verifyCanonicalFixture`, so they get their
    // own read-back. A model that is "approved" but carries no forecast events
    // is precisely the state the demo run-sheet cannot show.
    const afterEvents = await readModelEvents(pool, demoOrgId);
    const afterPlan = buildSeedPreflight(afterFixture, demoOrgId, afterEvents);
    if (!afterPlan.economicsReady) {
      const outstanding = afterPlan.rows
        .filter((row) => row.table === 'financial_model_events' && row.action !== 'unchanged')
        .map((row) => `${row.id} (${row.action}: ${row.detail})`);
      fail(
        `The canonical fixture is READY, but the ROI model's economics are not: ${outstanding.join('; ')}. ` +
          `The model would show no forecast events and no NPV / ROI / payback.`
      );
    }

    writeJsonFileAtomically(manifestPath, {
      ...manifest,
      status: 'COMPLETED' as const,
      postFixtureDigest: fixtureDigestAfter,
    });

    log(`✅ Seed complete — the canonical Atelier Finance fixture is materialized and READY in "${demoOrgId}".`);
    log(`- fixture digest (after): ${fixtureDigestAfter}`);
    log(
      `- ROI model economics: ${CANONICAL_MODEL_EVENTS.length} canonical forecast events present ` +
        `(compute has not been run — see the runbook's Models check).`
    );
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
      identity,
      decisiveReads,
      durableHoldStorage,
      hosted,
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
