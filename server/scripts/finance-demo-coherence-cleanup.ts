#!/usr/bin/env tsx
/**
 * FIN-005 — tenant-scoped quarantine of foreign Finance records in the demo org.
 *
 * PROBLEM
 * -------
 * The 2026-08-01 staging probe of `demo.consultify.ai` found the Atelier Toys
 * demo workspace showing other people's Finance records: `DBR77 Manufacturing`
 * (the only approved statement), `DBR77 Staging Financial Analysis`, and eight
 * models including Apator, an M16 seed and four identical
 * `DBR77 Staging Finance Model (kopia)` rows.
 *
 * PROVENANCE — stated honestly, because it changes what is safe to do.
 * No script in this repository at `c522a861` produces those names.
 * `seed-finance-surface.ts` targets a hard-coded `dbr77` org,
 * `reset-and-seed-finance-demo.ts` seeds `Fabryka Alfa` / `Nova Energia`, and
 * nothing emits the string `DBR77 Staging`. The `(kopia)` suffix is the PL
 * translation of `finance.preview.copySuffix`, i.e. the UI "Duplikuj" action.
 * The records were therefore created by an operator (UI or an unversioned
 * script) directly inside the demo tenant during earlier Finance probes.
 *
 * Because the provenance is not reproducible from code, this script does NOT
 * assume what should go. It reports what is actually there and lets a human
 * approve the list before anything moves.
 *
 * MECHANISM — quarantine, never delete.
 * Every Finance read is organization-scoped, so re-pointing a row's
 * `organization_id` at a quarantine organization removes it from the demo
 * workspace while preserving the row, its children and its history byte for
 * byte. Rollback is the same UPDATE in reverse.
 *
 * Setting `status = 'archived'` was considered and REJECTED: `listModels()` and
 * `listStatementPacks()` do not filter on status, so an "archived" row would
 * still render in the demo lists. And `financial_analyses.status` has a CHECK
 * constraint of ('DRAFT','REVIEW','APPROVED') with no archive value at all.
 *
 * ---------------------------------------------------------------------------
 * SAFETY MODEL (rewritten 2026-08-01 after the FIN-005 adversarial review)
 * ---------------------------------------------------------------------------
 *
 * 1. CANONICAL = EXACT WHITELIST, NOT A PREFIX. Canonical ids come from
 *    `getAtelierFinanceCanonicalIds()`, the contract the seed writes against.
 *    The old `id.startsWith('<org>--')` rule blessed every old technical
 *    fixture that happened to be minted with the same helper
 *    (`<org>--financial-model--m16-seed`, `<org>--statement--staging-probe`,
 *    `<org>--analysis--fixture-01`). Those are FOREIGN. Name flags are
 *    advisory reporting only and never decide anything.
 *
 * 2. HARD TARGET ALLOWLIST. The Railway project/environment/service AND the
 *    database fingerprint (host, port, database) AND the organization id must
 *    all be declared explicitly and must match exactly one entry of
 *    `FIN005_APPROVED_DEMO_TARGETS`. There are no defaults. Production is
 *    refused by FINGERPRINT before the allowlist is even consulted, so a
 *    `DEMO`-typed organization in production cannot let it through.
 *
 *    The OBSERVED port must exist and be exactly the approved one. A connection
 *    string with no port is refused rather than assumed to be the default: the
 *    approved target is a proxy port (28146), and `host/db` with no port lands
 *    on 5432 — a different server entirely.
 *
 *    Independently, the demo tenant must carry `organization_type = 'DEMO'`
 *    EXACTLY (case-sensitive). A missing column, NULL, `''`, `TRIAL`, `PAID` or
 *    lower-case `demo` all refuse.
 *
 * 3. NO `--force-org`. The escape hatch is GONE, deliberately and with no
 *    replacement in this script. Anything the allowlist refuses is out of band:
 *    it gets its own packet, its own review and its own tooling. If you are
 *    reading this because you need to clean a tenant that is not on the
 *    allowlist, do not add a flag — write the packet.
 *
 * 4. RUN-SPECIFIC QUARANTINE TENANT, FAIL CLOSED. Each run creates
 *    `<demo-org>-fin005-quarantine-<run-id>`. If that organization already
 *    exists it is reused ONLY when it is inactive, `organization_type='DEMO'`,
 *    carries this run's marker name and has ZERO users and ZERO
 *    organization_members. Rows are never moved into a tenant that has people
 *    in it.
 *
 * 5. SEED BEFORE QUARANTINE, AND STILL SEEDED AT COMMIT. `--write` first reads
 *    back the exact canonical ids and refuses unless it finds 1 pack, 3
 *    statements, the full statement value set, 1 analysis, 1 model and valid
 *    lineage between them. Quarantine without the seed leaves the demo Finance
 *    module empty. That precondition runs OUTSIDE the transaction, so it is not
 *    enough on its own: inside the transaction the same fixture is re-read with
 *    `SELECT … FOR UPDATE` (which also locks it against concurrent writers),
 *    re-checked for completeness and coherence, and compared byte for byte
 *    against what the precondition saw. Any difference ⇒ `ROLLBACK`, nothing
 *    moves.
 *
 *    COMPLETE IS NOT ENOUGH — THE FIXTURE MUST BE **READY**. The seed writes the
 *    id graph in phase 1 and promotes it in phase 2, so a crashed seed leaves
 *    every id present in `draft`/`imported`/`pending` state: complete, coherent
 *    and not a demo anybody can show. `--write` therefore also requires the
 *    promotion columns (`pack_status`/`pack_readiness_status`,
 *    `status`/`readiness_status`, analysis `status`), and those same columns are
 *    part of the digest — otherwise a demotion between the precondition and
 *    COMMIT would hash identically and be waved through. Dry runs are exempt:
 *    reporting on a half-seeded tenant is what a dry run is for.
 *
 * 6. DURABLE, AUTHENTICATED ROLLBACK. A manifest carrying the FULL prior state
 *    of every row (all columns, plus a SHA-256 per-row fingerprint and an
 *    HMAC-SHA256 signature over the whole file) is written, fsync'd and
 *    atomically renamed into place BEFORE `COMMIT`. A crash between `COMMIT`
 *    and the final manifest write is recoverable: the `PREPARED` manifest on
 *    disk already contains everything the rollback needs (`plannedEntries`).
 *
 *    The signature is KEYED. `--write` and `--rollback` both require
 *    `FIN005_MANIFEST_HMAC_KEY` (+ `FIN005_MANIFEST_HMAC_KEY_ID`). The earlier
 *    unkeyed SHA-256 proved only that the file had not been truncated by
 *    accident — anybody who could edit the manifest could recompute it, and the
 *    manifest is what `--rollback` writes into the database. Manifests carrying
 *    the old `checksum` field are refused outright.
 *
 *    NOT DONE — flagged, not implemented: persisting the prior state to a
 *    durable DB audit/outbox table inside the same transaction. That would need
 *    a new table (`fin005_quarantine_audit`) and therefore a MIGRATION, and
 *    this packet is forbidden from adding one. See
 *    `DURABLE_AUDIT_TABLE_PROPOSAL` below.
 *
 * 7. DEPENDENCY POSTCONDITIONS. Before `COMMIT` (and again after a rollback)
 *    the object graph of both tenants is re-read and checked for references
 *    that cross the tenant boundary — pack→statement, statement→values,
 *    ingest→statement, analysis→pack/statements, model→pack/analysis. Any
 *    inconsistency ⇒ `ROLLBACK`.
 *
 * 8. ROLLBACK REFUSES ON DRIFT. The manifest HMAC must verify, and every
 *    row must still carry the fingerprint it had immediately after quarantine.
 *    A row edited in the meantime is refused rather than silently overwritten.
 *    A restored `statement_pack_id` must point at a pack that exists, belongs
 *    to the demo tenant, and equals the recorded prior value.
 *
 * Unchanged good properties: dry-run by default, `--write` additionally requires
 * `FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE`, a single
 * transaction, `ESCAPE` on every LIKE, SQL-escaped literals in the generated
 * report, and clear-and-restore of the tenant-pointing link columns.
 *
 * USAGE
 *   # 1. dry run — read-only, produces the report
 *   DATABASE_URL=... npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     --railway-project consultify --railway-environment demo \
 *     --railway-service Postgres \
 *     --expect-host trolley.proxy.rlwy.net --expect-port 28146 \
 *     --expect-database railway --demo-org-id demo-org
 *
 *   # 2. after the printed list is approved (seed must already be materialized).
 *   #    The manifest key is REQUIRED here and must be the same one used for the
 *   #    rollback. Keep it out of shell history (e.g. read it from a file).
 *   DATABASE_URL=... FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
 *     FIN005_MANIFEST_HMAC_KEY="$(cat ~/.fin005-manifest-key)" \
 *     FIN005_MANIFEST_HMAC_KEY_ID=fin005-2026-08-a \
 *     npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     <same target flags> --run-id 2026-08-01a --write
 *
 *   # 3. rollback (from the manifest written by step 2, same key + key id)
 *   DATABASE_URL=... FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
 *     FIN005_MANIFEST_HMAC_KEY="$(cat ~/.fin005-manifest-key)" \
 *     FIN005_MANIFEST_HMAC_KEY_ID=fin005-2026-08-a \
 *     npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     <same target flags> --rollback server/exports/<manifest>.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  assertCanonicalFixtureMaterialized,
  assertCanonicalFixtureUnchanged,
  assertApprovedDemoTarget,
  assertDemoOrganizationMarker,
  assertManifestEntriesConsistent,
  assertManifestIntegrity,
  assertNoCrossOrgDependencies,
  assertQuarantineOrganizationReusable,
  assertRecordUnchangedSinceQuarantine,
  assertStatementPackRestorable,
  buildQuarantineOrgId,
  buildQuarantineOrgName,
  classifyFinanceDemoRows,
  computeRowFingerprint,
  projectQuarantinedRow,
  resolveRollbackEntries,
  signManifest,
  MANIFEST_VERSION,
  type CanonicalFixtureReadback,
  type CleanupManifest,
  type DependencyGraph,
  type FinanceDemoClassification,
  type ManifestEntry,
  type ManifestSigningKey,
  type QuarantineOrganizationRow,
} from '../src/services/demo/financeDemoCoherencePolicy.js';
import { resolveManifestSigningKey } from '../src/services/demo/financeDemoManifestSignature.js';
import { getAtelierFinanceCanonicalIds } from '../src/services/demo/atelierFinanceSeed.js';
import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

export const LABEL = 'finance-demo-cleanup';
const CONFIRM_ENV = 'FINANCE_DEMO_CLEANUP_CONFIRM';
const CONFIRM_VALUE = 'QUARANTINE_FOREIGN_FINANCE';

/**
 * FLAGGED, NOT IMPLEMENTED — needs a migration this packet may not write.
 *
 * A durable DB copy of the prior state, written inside the SAME transaction as
 * the quarantine, would remove the last remaining dependency on the local
 * filesystem (a manifest lost with the operator's laptop is unrecoverable). The
 * shape would be:
 *
 *   CREATE TABLE fin005_quarantine_audit (
 *     id            TEXT PRIMARY KEY,
 *     run_id        TEXT NOT NULL,
 *     table_name    TEXT NOT NULL,
 *     row_id        TEXT NOT NULL,
 *     from_org_id   TEXT NOT NULL,
 *     to_org_id     TEXT NOT NULL,
 *     prior_state   JSONB NOT NULL,
 *     prior_fingerprint TEXT NOT NULL,
 *     quarantined_fingerprint TEXT NOT NULL,
 *     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 * Do NOT create it from this script. It belongs in `server/migrations/` and
 * must go through the normal migration review.
 */
export const DURABLE_AUDIT_TABLE_PROPOSAL = 'fin005_quarantine_audit (NEEDS MIGRATION)';

/**
 * Organization-scoped Finance tables carrying customer-visible rows.
 *
 * `clearedLinkColumns` are the columns that point INTO the tenant a row is
 * being removed from. They are read, recorded and set to NULL on quarantine,
 * and restored on rollback, so a quarantined row keeps no reference into the
 * demo tenant (and the dependency postcondition can pass).
 *
 * `financial_statement_ingest_runs.statement_id` is NOT NULL and therefore
 * cannot be cleared: an ingest run must be quarantined together with its
 * statement, and the dependency postcondition refuses the run if it is not.
 */
export const SCOPED_TABLES = [
  {
    table: 'financial_statement_packs',
    nameColumns: ['entity_name', 'period_label'],
    clearedLinkColumns: [] as string[],
  },
  {
    table: 'financial_statements',
    nameColumns: ['entity_name', 'period_label'],
    clearedLinkColumns: ['statement_pack_id'],
  },
  {
    table: 'financial_statement_ingest_runs',
    nameColumns: ['source_file_name'],
    clearedLinkColumns: [] as string[],
  },
  {
    table: 'financial_analyses',
    nameColumns: ['title'],
    clearedLinkColumns: ['source_statement_pack_id', 'source_statement_ids'],
  },
  {
    table: 'financial_models',
    nameColumns: ['name'],
    clearedLinkColumns: ['source_statement_pack_id', 'source_analysis_id'],
  },
] as const;

export const SCOPED_TABLE_NAMES: ReadonlySet<string> = new Set(
  SCOPED_TABLES.map((spec) => spec.table)
);

/** Reported for visibility, never written by this script. */
const OBSERVE_ONLY_TABLES = ['budgets', 'valuations'] as const;

type Args = Record<string, string>;

export function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current?.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

/**
 * Absolute path to `<repo>/server/exports`, whatever the caller's cwd is.
 *
 * `path.resolve(process.cwd(), 'server/exports')` doubled the segment when the
 * script was run from inside `server/`, producing `server/server/exports/` —
 * outside the `server/exports/` ignore rule, so twelve generated reports and
 * manifests were committed by accident. Anchor on this module's own location
 * instead: `server/scripts/<file>` -> up two -> `server/`.
 */
function exportsDir(): string {
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(serverRoot, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Single-quoted SQL literal with quotes doubled. */
export function sqlLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function stamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Escape LIKE metacharacters so an org id cannot alter the pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

// ---------------------------------------------------------------------------
// Durable file writes
// ---------------------------------------------------------------------------

/**
 * Write JSON so that a crash can never leave a half-written manifest:
 * write to a temp file in the SAME directory → `fsync` the file → `rename`
 * (atomic within a filesystem) → `fsync` the directory so the rename itself
 * survives a power loss.
 */
export function writeJsonFileAtomically(filePath: string, payload: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2), 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);

  let dirFd: number | null = null;
  try {
    dirFd = fs.openSync(dir, 'r');
    fs.fsyncSync(dirFd);
  } catch {
    // Directory fsync is unsupported on some platforms; the rename is still atomic.
  } finally {
    if (dirFd !== null) {
      try {
        fs.closeSync(dirFd);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Read the manifest, branded refusal on anything unreadable or unparsable.
 *
 * PARSE ONLY. Verification (HMAC, shape, drift) happens in the caller, AFTER
 * this returns — parse-then-verify, never the reverse. The failure text names the
 * path but never the file contents: a manifest carries full prior row state.
 */
export function readManifest(filePath: string): CleanupManifest {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `[${LABEL}] Refusing to run: the manifest "${filePath}" could not be read (${(error as NodeJS.ErrnoException)?.code || 'read error'}).`
    );
  }
  try {
    return JSON.parse(raw) as CleanupManifest;
  } catch {
    throw new Error(
      `[${LABEL}] Refusing to run: the manifest "${filePath}" is not valid JSON. It is corrupt or truncated — ` +
        `do not hand-edit it; the signature would not verify anyway. Restore the file written by the --write run.`
    );
  }
}

// ---------------------------------------------------------------------------
// Gateway — every SQL statement lives here, so the orchestration above is
// testable against an in-memory fake instead of a live database.
// ---------------------------------------------------------------------------

export interface CleanupTransaction {
  ensureQuarantineOrganization(id: string, name: string): Promise<void>;
  readQuarantineOrganization(id: string): Promise<QuarantineOrganizationRow | null>;
  /**
   * Re-read the EXACT canonical fixture with `SELECT … FOR UPDATE`, inside the
   * transaction. The lock is the point: after this call no other session can
   * change the fixture until we commit or roll back.
   */
  lockCanonicalFixture(organizationId: string): Promise<CanonicalFixtureReadback>;
  /** `SELECT * … FOR UPDATE` — every column, so the prior state is complete. */
  lockRows(table: string, ids: string[], organizationId: string): Promise<Array<Record<string, unknown>>>;
  moveRows(params: {
    table: string;
    ids: string[];
    fromOrganizationId: string;
    toOrganizationId: string;
    clearColumns: string[];
    canonicalIds: string[];
  }): Promise<string[]>;
  restoreRow(params: {
    table: string;
    id: string;
    toOrganizationId: string;
    fromOrganizationId: string;
    restore: Record<string, unknown>;
  }): Promise<number>;
  readRow(table: string, id: string): Promise<Record<string, unknown> | null>;
  readPack(id: string): Promise<{ id: string; organizationId: string } | null>;
  readDependencyGraph(organizationIds: string[]): Promise<DependencyGraph>;
}

export interface CleanupGateway {
  organizationExists(
    id: string
  ): Promise<
    { id: string; organizationTypeColumnPresent: boolean; organizationType: string | null } | null
  >;
  currentDatabase(): Promise<string>;
  listScopedRows(organizationId: string): Promise<Array<{ table: string; id: string; displayName: string }>>;
  countObserveOnly(organizationId: string): Promise<Array<{ table: string; count: number }>>;
  readCanonicalFixture(organizationId: string): Promise<CanonicalFixtureReadback>;
  readDependencyGraph(organizationIds: string[]): Promise<DependencyGraph>;
  withTransaction<T>(
    run: (tx: CleanupTransaction) => Promise<T>,
    hooks?: { afterCommit?: () => void }
  ): Promise<T>;
  close(): Promise<void>;
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    [table]
  );
  return Boolean(result.rows?.[0]?.present);
}

async function existingColumns(
  runner: pg.Pool | pg.PoolClient,
  table: string
): Promise<Set<string>> {
  const result = await runner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set((result.rows || []).map((row) => String(row.column_name)));
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export function createPgGateway(pool: pg.Pool): CleanupGateway {
  const columnCache = new Map<string, string[]>();

  /** Which of `wanted` actually exist on `table` in this schema (cached). */
  async function presentColumns(
    runner: pg.Pool | pg.PoolClient,
    table: string,
    wanted: readonly string[]
  ): Promise<string[]> {
    const cacheKey = table;
    if (!columnCache.has(cacheKey)) {
      const columns = await existingColumns(runner, table);
      columnCache.set(cacheKey, [...columns]);
    }
    const present = new Set(columnCache.get(cacheKey) || []);
    return wanted.filter((column) => present.has(column));
  }

  /**
   * Read the exact canonical fixture — ids, lineage AND state.
   *
   * `lock: true` appends `FOR UPDATE` and MUST be used inside the quarantine
   * transaction: it both re-reads the fixture and holds it against concurrent
   * writers until COMMIT/ROLLBACK. `lock: false` is the read-only precondition
   * pass on the pool.
   *
   * THE STATE COLUMNS ARE NOT OPTIONAL EXTRAS. Without `pack_status`,
   * `pack_readiness_status`, the statements' `status`/`readiness_status` and the
   * analysis `status`, the digest covers the ID GRAPH only — and a demotion from
   * `ready` to `pending` between the precondition and COMMIT (exactly what a
   * crashed re-seed leaves behind) would hash identically and be waved through.
   *
   * Each column is selected only if it exists in this schema; an absent column
   * comes back as `undefined`, which the policy treats as "READY cannot be
   * proven" (a refusal) and digests as its own token.
   */
  async function fixture(
    runner: pg.Pool | pg.PoolClient,
    organizationId: string,
    options: { lock: boolean }
  ): Promise<CanonicalFixtureReadback> {
    const canonical = getAtelierFinanceCanonicalIds(organizationId);
    // `FOR UPDATE` is only legal on a plain row-returning SELECT, which every
    // query below is.
    const forUpdate = options.lock ? ' FOR UPDATE' : '';
    const pick = async (sql: string, ids: string[]) =>
      ids.length ? (await runner.query(`${sql}${forUpdate}`, [ids, organizationId])).rows || [] : [];

    /**
     * `undefined` when the column is absent from this schema, otherwise the
     * value (`null` included). The two are deliberately distinguishable.
     */
    const stateOf = (
      row: Record<string, unknown>,
      column: string,
      present: readonly string[]
    ): string | null | undefined => {
      if (!present.includes(column)) return undefined;
      const value = row[column];
      return value === null || value === undefined ? null : String(value);
    };
    const projection = (columns: readonly string[]) =>
      columns.map((column) => `, "${column}"::text AS "${column}"`).join('');

    const packStateColumns = await presentColumns(runner, 'financial_statement_packs', [
      'pack_status',
      'pack_readiness_status',
    ]);
    const statementStateColumns = await presentColumns(runner, 'financial_statements', [
      'status',
      'readiness_status',
    ]);
    const analysisStateColumns = await presentColumns(runner, 'financial_analyses', ['status']);

    const packs = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id${projection(packStateColumns)}
         FROM financial_statement_packs WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [canonical.packId]
    );
    const statements = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              statement_pack_id::text AS statement_pack_id${projection(statementStateColumns)}
         FROM financial_statements WHERE id = ANY($1::text[]) AND organization_id = $2`,
      canonical.statementIds
    );
    const values = canonical.statementValueIds.length
      ? (
          await runner.query(
            `SELECT id::text AS id, statement_id::text AS statement_id
               FROM financial_statement_values WHERE id = ANY($1::text[])${forUpdate}`,
            [canonical.statementValueIds]
          )
        ).rows || []
      : [];
    const analyses = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id,
              source_statement_ids${projection(analysisStateColumns)}
         FROM financial_analyses WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [canonical.analysisId]
    );
    const models = await pick(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id
         FROM financial_models WHERE id = ANY($1::text[]) AND organization_id = $2`,
      [canonical.modelId]
    );

    return {
      packs: packs.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        packStatus: stateOf(row, 'pack_status', packStateColumns),
        packReadinessStatus: stateOf(row, 'pack_readiness_status', packStateColumns),
      })),
      statements: statements.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        statementPackId: row.statement_pack_id ?? null,
        status: stateOf(row, 'status', statementStateColumns),
        readinessStatus: stateOf(row, 'readiness_status', statementStateColumns),
      })),
      values: values.map((row) => ({
        id: String(row.id),
        statementId: String(row.statement_id),
      })),
      analyses: analyses.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
        sourceStatementIds: parseJsonArray(row.source_statement_ids),
        status: stateOf(row, 'status', analysisStateColumns),
      })),
      models: models.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
      })),
    };
  }

  async function graph(
    runner: pg.Pool | pg.PoolClient,
    organizationIds: string[]
  ): Promise<DependencyGraph> {
    const orgs = organizationIds.filter(Boolean);
    const q = async (sql: string) => (await runner.query(sql, [orgs])).rows || [];

    const packs = await q(
      `SELECT id::text AS id, organization_id::text AS organization_id
         FROM financial_statement_packs WHERE organization_id = ANY($1::text[])`
    );
    const statements = await q(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              statement_pack_id::text AS statement_pack_id
         FROM financial_statements WHERE organization_id = ANY($1::text[])`
    );
    const statementIds = statements.map((row) => String(row.id));
    const values = statementIds.length
      ? (
          await runner.query(
            `SELECT id::text AS id, statement_id::text AS statement_id
               FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
            [statementIds]
          )
        ).rows || []
      : [];
    const ingestRuns = await q(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              statement_id::text AS statement_id
         FROM financial_statement_ingest_runs WHERE organization_id = ANY($1::text[])`
    );
    const analyses = await q(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id,
              source_statement_ids
         FROM financial_analyses WHERE organization_id = ANY($1::text[])`
    );
    const modelColumns = await existingColumns(runner, 'financial_models');
    const models = await q(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              source_statement_pack_id::text AS source_statement_pack_id
              ${modelColumns.has('source_analysis_id') ? ', source_analysis_id::text AS source_analysis_id' : ''}
         FROM financial_models WHERE organization_id = ANY($1::text[])`
    );

    return {
      packs: packs.map((row) => ({ id: String(row.id), organizationId: String(row.organization_id) })),
      statements: statements.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        statementPackId: row.statement_pack_id ?? null,
      })),
      values: values.map((row) => ({ id: String(row.id), statementId: String(row.statement_id) })),
      ingestRuns: ingestRuns.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        statementId: row.statement_id ?? null,
      })),
      analyses: analyses.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
        sourceStatementIds: parseJsonArray(row.source_statement_ids),
      })),
      models: models.map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        sourceStatementPackId: row.source_statement_pack_id ?? null,
        sourceAnalysisId: (row as Record<string, unknown>).source_analysis_id
          ? String((row as Record<string, unknown>).source_analysis_id)
          : null,
      })),
    };
  }

  return {
    async organizationExists(id) {
      const columns = await existingColumns(pool, 'organizations');
      const columnPresent = columns.has('organization_type');
      const result = await pool.query(
        `SELECT id::text AS id${
          columnPresent ? ', organization_type::text AS organization_type' : ''
        } FROM organizations WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!result.rowCount) return null;
      const raw = (result.rows[0] as Record<string, unknown>).organization_type;
      return {
        id: String(result.rows[0].id),
        organizationTypeColumnPresent: columnPresent,
        // NOTE the shape: `''` must survive as `''` and NULL as `null`. The
        // previous `raw ? String(raw) : null` collapsed an empty string into
        // "column absent", which the caller then waved through.
        organizationType: raw === null || raw === undefined ? null : String(raw),
      };
    },

    async currentDatabase() {
      const result = await pool.query('SELECT current_database()::text AS name');
      return String(result.rows?.[0]?.name || '');
    },

    async listScopedRows(organizationId) {
      const rows: Array<{ table: string; id: string; displayName: string }> = [];
      for (const spec of SCOPED_TABLES) {
        if (!(await tableExists(pool, spec.table))) {
          console.warn(`[${LABEL}] table ${spec.table} not present — skipped.`);
          continue;
        }
        const columns = await existingColumns(pool, spec.table);
        if (!columns.has('organization_id')) {
          console.warn(`[${LABEL}] table ${spec.table} has no organization_id — skipped.`);
          continue;
        }
        const nameColumns = spec.nameColumns.filter((column) => columns.has(column));
        const nameExpression = nameColumns.length
          ? `COALESCE(${nameColumns.map((column) => `NULLIF("${column}"::text, '')`).join(', ')}, id)`
          : 'id';
        const result = await pool.query(
          `SELECT id::text AS id, ${nameExpression} AS display_name
             FROM "${spec.table}" WHERE organization_id = $1 ORDER BY id ASC`,
          [organizationId]
        );
        for (const row of result.rows || []) {
          rows.push({
            table: spec.table,
            id: String(row.id),
            displayName: String(row.display_name ?? row.id),
          });
        }
      }
      return rows;
    },

    async countObserveOnly(organizationId) {
      const out: Array<{ table: string; count: number }> = [];
      for (const table of OBSERVE_ONLY_TABLES) {
        if (!(await tableExists(pool, table))) continue;
        const columns = await existingColumns(pool, table);
        if (!columns.has('organization_id')) continue;
        const result = await pool.query(
          `SELECT COUNT(*)::int AS count FROM "${table}" WHERE organization_id = $1`,
          [organizationId]
        );
        out.push({ table, count: Number(result.rows?.[0]?.count || 0) });
      }
      return out;
    },

    readCanonicalFixture(organizationId) {
      return fixture(pool, organizationId, { lock: false });
    },

    readDependencyGraph(organizationIds) {
      return graph(pool, organizationIds);
    },

    async withTransaction(run, hooks) {
      const client = await pool.connect();
      const tx: CleanupTransaction = {
        async ensureQuarantineOrganization(id, name) {
          const present = await existingColumns(client, 'organizations');
          const insertColumns = ['id'];
          const values: unknown[] = [id];
          if (present.has('name')) {
            insertColumns.push('name');
            values.push(name);
          }
          if (present.has('slug')) {
            insertColumns.push('slug');
            values.push(id);
          }
          // Lifecycle columns set EXPLICITLY: schema defaults would make this an
          // `active` / `TRIAL` organization, i.e. it would read as a customer org
          // in super-admin listings.
          if (present.has('organization_type')) {
            insertColumns.push('organization_type');
            values.push('DEMO');
          }
          if (present.has('status')) {
            insertColumns.push('status');
            values.push('inactive');
          }
          if (present.has('is_active')) {
            insertColumns.push('is_active');
            values.push(false);
          }
          await client.query(
            `INSERT INTO organizations (${insertColumns.map((c) => `"${c}"`).join(', ')})
             VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')})
             ON CONFLICT (id) DO NOTHING`,
            values
          );
        },

        async readQuarantineOrganization(id) {
          const present = await existingColumns(client, 'organizations');
          const result = await client.query(
            `SELECT id::text AS id
                    ${present.has('name') ? ', name::text AS name' : ''}
                    ${present.has('organization_type') ? ', organization_type::text AS organization_type' : ''}
                    ${present.has('status') ? ', status::text AS status' : ''}
                    ${present.has('is_active') ? ', is_active AS is_active' : ''}
               FROM organizations WHERE id = $1 LIMIT 1`,
            [id]
          );
          if (!result.rowCount) return null;
          const row = result.rows[0] as Record<string, unknown>;
          const users = await client.query(
            `SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1`,
            [id]
          );
          let memberCount = 0;
          try {
            const members = await client.query(
              `SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = $1`,
              [id]
            );
            memberCount = Number(members.rows?.[0]?.count || 0);
          } catch {
            // Table absent in this schema — treated as zero, and the user count
            // above is the binding check.
            memberCount = 0;
          }
          return {
            id: String(row.id),
            name: row.name === undefined || row.name === null ? null : String(row.name),
            organizationTypeColumnPresent: present.has('organization_type'),
            organizationType:
              row.organization_type === undefined || row.organization_type === null
                ? null
                : String(row.organization_type),
            status: row.status === undefined || row.status === null ? null : String(row.status),
            isActive:
              row.is_active === undefined || row.is_active === null ? null : Boolean(row.is_active),
            userCount: Number(users.rows?.[0]?.count || 0),
            memberCount,
          };
        },

        lockCanonicalFixture(organizationId) {
          return fixture(client, organizationId, { lock: true });
        },

        async lockRows(table, ids, organizationId) {
          if (!ids.length) return [];
          const result = await client.query(
            `SELECT * FROM "${table}" WHERE id = ANY($1::text[]) AND organization_id = $2
             ORDER BY id ASC FOR UPDATE`,
            [ids, organizationId]
          );
          return (result.rows || []) as Array<Record<string, unknown>>;
        },

        async moveRows(params) {
          if (!params.ids.length) return [];
          const clear = await presentColumns(client, params.table, params.clearColumns);
          const setClause = [
            'organization_id = $1',
            ...clear.map((column) => `"${column}" = NULL`),
          ].join(', ');
          const result = await client.query(
            `UPDATE "${params.table}"
                SET ${setClause}
              WHERE organization_id = $2
                AND id = ANY($3::text[])
                -- Canonical rows can never be moved, whatever the caller passed.
                AND NOT (id = ANY($4::text[]))
              RETURNING id::text AS id`,
            [
              params.toOrganizationId,
              params.fromOrganizationId,
              params.ids,
              params.canonicalIds,
            ]
          );
          return (result.rows || []).map((row) => String(row.id));
        },

        async restoreRow(params) {
          const columns = Object.keys(params.restore);
          const assignments = ['organization_id = $1'];
          const values: unknown[] = [params.toOrganizationId];
          for (const column of columns) {
            values.push(params.restore[column]);
            assignments.push(`"${column}" = $${values.length}`);
          }
          values.push(params.id);
          const idIndex = values.length;
          values.push(params.fromOrganizationId);
          const orgIndex = values.length;
          const result = await client.query(
            `UPDATE "${params.table}" SET ${assignments.join(', ')}
              WHERE id = $${idIndex} AND organization_id = $${orgIndex}`,
            values
          );
          return result.rowCount ?? 0;
        },

        async readRow(table, id) {
          const result = await client.query(`SELECT * FROM "${table}" WHERE id = $1 LIMIT 1`, [id]);
          if (!result.rowCount) return null;
          return result.rows[0] as Record<string, unknown>;
        },

        async readPack(id) {
          const result = await client.query(
            `SELECT id::text AS id, organization_id::text AS organization_id
               FROM financial_statement_packs WHERE id = $1 LIMIT 1`,
            [id]
          );
          if (!result.rowCount) return null;
          return {
            id: String(result.rows[0].id),
            organizationId: String(result.rows[0].organization_id),
          };
        },

        readDependencyGraph(organizationIds) {
          return graph(client, organizationIds);
        },
      };

      try {
        await client.query('BEGIN');
        const outcome = await run(tx);
        await client.query('COMMIT');
        hooks?.afterCommit?.();
        return outcome;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* the connection may already be gone */
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function buildReport(params: {
  demoOrgId: string;
  quarantineOrgId: string;
  dryRun: boolean;
  host: string;
  database: string;
  candidates: FinanceDemoClassification[];
  observeOnly: Array<{ table: string; count: number }>;
  generatedAt?: string;
}): string {
  const foreign = params.candidates.filter((row) => !row.canonical);
  const canonical = params.candidates.filter((row) => row.canonical);
  const legacyPrefixed = foreign.filter((row) => row.legacyPrefixed);
  const lines: string[] = [];

  lines.push('# FIN-005 — Finance demo coherence report');
  lines.push('');
  lines.push(`- Generated: \`${params.generatedAt || new Date().toISOString()}\``);
  lines.push(`- Mode: \`${params.dryRun ? 'dry-run' : 'write'}\``);
  lines.push(`- Host: \`${params.host}\``);
  lines.push(`- Database: \`${params.database}\``);
  lines.push(`- Demo organization: \`${params.demoOrgId}\``);
  lines.push(`- Quarantine organization: \`${params.quarantineOrgId}\``);
  lines.push('');

  lines.push('## Canonical Atelier rows (KEPT — never touched)');
  lines.push('');
  if (canonical.length === 0) {
    lines.push(
      '> **None.** The canonical Atelier Finance fixture is not materialized in this tenant. `--write` will REFUSE until the demo seed has run, otherwise Finance would be left empty.'
    );
  } else {
    for (const row of canonical) {
      lines.push(`- \`${row.table}\` · \`${row.id}\` — ${row.displayName}`);
    }
  }
  lines.push('');

  lines.push('## Foreign rows (candidates for quarantine)');
  lines.push('');
  if (foreign.length === 0) {
    lines.push('> None. The demo tenant contains only canonical Atelier Finance rows.');
  } else {
    lines.push('| table | id | name | seed-prefixed | flags |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const row of foreign) {
      lines.push(
        `| \`${row.table}\` | \`${row.id}\` | ${row.displayName} | ${
          row.legacyPrefixed ? '**yes (old fixture)**' : 'no'
        } | ${row.flags.length ? row.flags.join(', ') : '—'} |`
      );
    }
  }
  lines.push('');

  if (legacyPrefixed.length) {
    lines.push(
      `> ⚠ ${legacyPrefixed.length} foreign row(s) carry the demo seed's id prefix \`${params.demoOrgId}--\`. ` +
        'They are old technical fixtures, not part of the canonical Atelier fixture. The previous prefix-based rule protected them; the exact whitelist does not.'
    );
    lines.push('');
  }

  if (params.observeOnly.length) {
    lines.push('## Observed, NOT written by this script');
    lines.push('');
    for (const entry of params.observeOnly) {
      lines.push(`- \`${entry.table}\`: ${entry.count} row(s) in the demo tenant`);
    }
    lines.push('');
  }

  lines.push('## Validation queries (run before and after)');
  lines.push('');
  lines.push('```sql');
  // The report tells a human to paste these into psql, so every argument-derived
  // value is SQL-escaped even though this script never executes them.
  const demoLiteral = sqlLiteral(params.demoOrgId);
  const quarantineLiteral = sqlLiteral(params.quarantineOrgId);
  const prefixLiteral = sqlLiteral(`${escapeLike(params.demoOrgId)}--%`);
  const canonicalIds = getAtelierFinanceCanonicalIds(params.demoOrgId);
  for (const spec of SCOPED_TABLES) {
    const ids = (canonicalIds.byTable[spec.table] || []).map((id) => sqlLiteral(id)).join(', ');
    lines.push(
      `SELECT '${spec.table}' AS table_name, COUNT(*) AS rows_in_demo,\n` +
        `       COUNT(*) FILTER (WHERE id IN (${ids || "''"})) AS canonical_rows,\n` +
        `       COUNT(*) FILTER (WHERE id LIKE ${prefixLiteral} ESCAPE '!'\n` +
        `                          AND id NOT IN (${ids || "''"})) AS legacy_prefixed_rows\n` +
        `  FROM "${spec.table}" WHERE organization_id = ${demoLiteral};`
    );
  }
  lines.push('```');
  lines.push('');

  lines.push('## Rollback');
  lines.push('');
  lines.push(
    'Re-run this script with `--rollback <manifest.json>` (the manifest written by the write run). ' +
      'The manifest carries the full prior state of every row, a checksum, and a per-row fingerprint; ' +
      'the rollback refuses if a record changed after quarantine. A manual reverse UPDATE skips those checks — use it only if the script cannot run:'
  );
  lines.push('');
  lines.push('```sql');
  lines.push(
    `-- per table, restoring only the ids listed in the manifest\nUPDATE "financial_models" SET organization_id = ${demoLiteral}\n WHERE organization_id = ${quarantineLiteral} AND id = ANY($1);`
  );
  lines.push('```');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export interface QuarantineRunParams {
  gateway: CleanupGateway;
  demoOrgId: string;
  quarantineOrgId: string;
  quarantineOrgName: string;
  runId: string;
  foreign: FinanceDemoClassification[];
  manifestPath: string;
  host: string;
  database: string;
  /** HMAC key for the manifest. Required — there is no unsigned path. */
  signingKey: ManifestSigningKey;
  /**
   * The canonical fixture exactly as the precondition saw it, OUTSIDE the
   * transaction. Re-read under `FOR UPDATE` inside the transaction and compared
   * against this; any difference aborts before COMMIT.
   */
  preconditionFixture: CanonicalFixtureReadback;
  /** Injectable so tests can observe exactly what hit the disk and when. */
  writeManifest?: (filePath: string, manifest: CleanupManifest) => void;
  /** Fault injection: `afterCommit` throwing simulates a crash post-COMMIT. */
  hooks?: { afterCommit?: () => void };
  now?: () => Date;
}

/**
 * One transaction: lock → record full prior state → **durably persist the
 * rollback plan** → move → verify the object graph → COMMIT.
 *
 * The manifest write sits between "record" and "move" on purpose: it is on
 * disk, fsync'd and renamed into place before a single row has been committed
 * anywhere, so there is no window in which rows have moved and the plan to move
 * them back does not exist.
 */
export async function executeQuarantineRun(params: QuarantineRunParams): Promise<CleanupManifest> {
  const writeManifest = params.writeManifest || writeJsonFileAtomically;
  const now = params.now || (() => new Date());
  const canonical = getAtelierFinanceCanonicalIds(params.demoOrgId);

  let manifest: CleanupManifest = {
    label: LABEL,
    version: MANIFEST_VERSION,
    runId: params.runId,
    status: 'PREPARED',
    demoOrgId: params.demoOrgId,
    quarantineOrgId: params.quarantineOrgId,
    host: params.host,
    database: params.database,
    preparedAt: now().toISOString(),
    plannedEntries: [],
    entries: [],
  };

  const confirmed = await params.gateway.withTransaction(async (tx) => {
    // 1. Quarantine tenant — fail closed on anything that is not an empty,
    //    inactive, DEMO-typed organization carrying THIS run's marker.
    const existing = await tx.readQuarantineOrganization(params.quarantineOrgId);
    const action = assertQuarantineOrganizationReusable(existing, {
      id: params.quarantineOrgId,
      name: params.quarantineOrgName,
    });
    if (action === 'create') {
      await tx.ensureQuarantineOrganization(params.quarantineOrgId, params.quarantineOrgName);
      const created = await tx.readQuarantineOrganization(params.quarantineOrgId);
      assertQuarantineOrganizationReusable(created, {
        id: params.quarantineOrgId,
        name: params.quarantineOrgName,
      });
    }

    // 1b. TRANSACTIONAL FIXTURE GUARD.
    //
    // The precondition ran outside this transaction, so between it and now the
    // fixture could have been re-seeded, edited or partly deleted — and moving
    // every non-canonical row out of a tenant whose canonical fixture is broken
    // leaves the demo Finance module empty. Re-read it under `FOR UPDATE` (which
    // also blocks concurrent writers for the rest of the transaction), prove it
    // is STILL complete and coherent, and prove it is still the SAME fixture the
    // precondition approved. Any difference throws, and the throw rolls the
    // transaction back before a single row has moved.
    const lockedFixture = await tx.lockCanonicalFixture(params.demoOrgId);
    assertCanonicalFixtureMaterialized(lockedFixture, params.demoOrgId);
    assertCanonicalFixtureUnchanged({
      before: params.preconditionFixture,
      after: lockedFixture,
      organizationId: params.demoOrgId,
      phase: 'the locked in-transaction re-read',
    });

    // 2. Lock the rows and capture EVERY column as the prior state.
    const planned: ManifestEntry[] = [];
    for (const spec of SCOPED_TABLES) {
      const ids = params.foreign.filter((row) => row.table === spec.table).map((row) => row.id);
      if (!ids.length) continue;

      const locked = await tx.lockRows(spec.table, ids, params.demoOrgId);
      if (locked.length !== ids.length) {
        throw new Error(
          `[${LABEL}] ${spec.table}: expected to lock ${ids.length} row(s), found ${locked.length}. ` +
            `The tenant changed since the dry run — re-run the dry run. Rolled back.`
        );
      }

      for (const row of locked) {
        const id = String(row.id);
        const candidate = params.foreign.find(
          (item) => item.table === spec.table && item.id === id
        );
        const clearedColumns = spec.clearedLinkColumns.filter((column) => column in row);
        const clearedLinks: Record<string, string | null> = {};
        for (const column of clearedColumns) {
          const value = row[column];
          clearedLinks[column] =
            value === null || value === undefined
              ? null
              : typeof value === 'string'
                ? value
                : JSON.stringify(value);
        }
        planned.push({
          table: spec.table,
          id,
          fromOrganizationId: params.demoOrgId,
          toOrganizationId: params.quarantineOrgId,
          displayName: candidate?.displayName ?? id,
          statementPackId:
            spec.table === 'financial_statements'
              ? ((clearedLinks.statement_pack_id ?? null) as string | null)
              : undefined,
          clearedLinks,
          priorState: row,
          priorFingerprint: computeRowFingerprint(row),
          expectedQuarantinedFingerprint: computeRowFingerprint(
            projectQuarantinedRow(row, {
              toOrganizationId: params.quarantineOrgId,
              clearedColumns,
            })
          ),
        });
      }
    }

    // 3. Durable rollback plan on disk BEFORE anything commits.
    manifest = signManifest({ ...manifest, plannedEntries: planned }, params.signingKey);
    writeManifest(params.manifestPath, manifest);

    // 4. Move.
    const entries: ManifestEntry[] = [];
    for (const spec of SCOPED_TABLES) {
      const forTable = planned.filter((entry) => entry.table === spec.table);
      if (!forTable.length) continue;
      const moved = await tx.moveRows({
        table: spec.table,
        ids: forTable.map((entry) => entry.id),
        fromOrganizationId: params.demoOrgId,
        toOrganizationId: params.quarantineOrgId,
        clearColumns: [...spec.clearedLinkColumns],
        canonicalIds: canonical.byTable[spec.table] || [],
      });
      if (moved.length !== forTable.length) {
        throw new Error(
          `[${LABEL}] ${spec.table}: expected to quarantine ${forTable.length} row(s), updated ${moved.length}. Rolled back.`
        );
      }
      const movedIds = new Set(moved);
      for (const entry of forTable) {
        if (!movedIds.has(entry.id)) {
          throw new Error(`[${LABEL}] ${spec.table}: row "${entry.id}" was not moved. Rolled back.`);
        }
        entries.push(entry);
      }
    }

    // 5. Nothing may reference across the tenant boundary.
    const graph = await tx.readDependencyGraph([params.demoOrgId, params.quarantineOrgId]);
    assertNoCrossOrgDependencies(graph, 'pre-COMMIT');

    // 6. Final confirmation immediately before COMMIT. The rows are locked, so
    //    this is belt-and-braces against our own UPDATEs having touched the
    //    fixture — the one thing the lock cannot protect us from.
    const fixtureAtCommit = await tx.lockCanonicalFixture(params.demoOrgId);
    assertCanonicalFixtureMaterialized(fixtureAtCommit, params.demoOrgId);
    assertCanonicalFixtureUnchanged({
      before: params.preconditionFixture,
      after: fixtureAtCommit,
      organizationId: params.demoOrgId,
      phase: 'pre-COMMIT',
    });

    return entries;
  }, params.hooks);

  manifest = signManifest(
    {
      ...manifest,
      status: 'COMMITTED',
      completedAt: now().toISOString(),
      entries: confirmed,
    },
    params.signingKey
  );
  writeManifest(params.manifestPath, manifest);
  return manifest;
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

/**
 * Restore quarantined rows from a manifest.
 *
 * A manifest is a FILE, therefore UNTRUSTED input. Every guard the forward path
 * has is enforced here too, plus three the forward path does not need:
 * a checksum over the file, a per-row fingerprint that must still match, and a
 * `statement_pack_id` validation against the live pack row.
 */
export async function executeRollbackRun(params: {
  gateway: CleanupGateway;
  manifest: CleanupManifest;
  target: { host: string; database: string };
  approvedOrganizationId: string;
  /** Same HMAC key the write run used. A rotated or wrong key REFUSES. */
  signingKey: ManifestSigningKey;
}): Promise<{ restored: number; recoveredFromPlan: boolean }> {
  const manifest = params.manifest;
  assertManifestIntegrity(manifest, params.signingKey);

  const demoOrgId = String(manifest.demoOrgId || '').trim();
  const quarantineOrgId = String(manifest.quarantineOrgId || '').trim();
  if (!demoOrgId || !quarantineOrgId) {
    throw new Error(`[${LABEL}] Manifest is missing demoOrgId/quarantineOrgId — refusing to run.`);
  }
  if (demoOrgId !== params.approvedOrganizationId) {
    throw new Error(
      `[${LABEL}] Manifest restores into "${demoOrgId}", but the approved target organization is ` +
        `"${params.approvedOrganizationId}". Refusing to run.`
    );
  }
  if (manifest.host && manifest.host !== params.target.host) {
    throw new Error(
      `[${LABEL}] Manifest was produced against host "${manifest.host}" but the target is "${params.target.host}". Refusing to replay across databases.`
    );
  }
  if (manifest.database && manifest.database !== params.target.database) {
    throw new Error(
      `[${LABEL}] Manifest was produced against database "${manifest.database}" but the target is "${params.target.database}". Refusing to replay across databases.`
    );
  }

  const { entries, recoveredFromPlan } = resolveRollbackEntries(manifest);
  if (entries.length === 0) {
    return { restored: 0, recoveredFromPlan: false };
  }
  assertManifestEntriesConsistent(manifest, entries, SCOPED_TABLE_NAMES);

  const restored = await params.gateway.withTransaction(async (tx) => {
    let count = 0;
    for (const entry of entries) {
      const current = await tx.readRow(entry.table, entry.id);

      // Recovery path: after a crash between COMMIT and the final manifest
      // write we cannot know whether the row moved. A row still sitting in the
      // demo tenant, untouched, is already correct — skip it rather than fail.
      if (
        recoveredFromPlan &&
        current &&
        String(current.organization_id) === demoOrgId &&
        entry.priorFingerprint &&
        computeRowFingerprint(current) === entry.priorFingerprint
      ) {
        continue;
      }

      assertRecordUnchangedSinceQuarantine(entry, current);

      const restore: Record<string, unknown> = {};
      for (const [column, value] of Object.entries(entry.clearedLinks || {})) {
        restore[column] = value;
      }
      if (
        entry.table === 'financial_statements' &&
        !('statement_pack_id' in restore) &&
        entry.statementPackId !== undefined
      ) {
        restore.statement_pack_id = entry.statementPackId ?? null;
      }

      const packId = restore.statement_pack_id as string | null | undefined;
      if (packId) {
        const pack = await tx.readPack(packId);
        assertStatementPackRestorable({
          entryId: entry.id,
          recordedPackId: packId,
          packRow: pack,
          demoOrgId,
        });
      }

      const affected = await tx.restoreRow({
        table: entry.table,
        id: entry.id,
        toOrganizationId: demoOrgId,
        fromOrganizationId: quarantineOrgId,
        restore,
      });
      if (affected !== 1) {
        throw new Error(
          `[${LABEL}] Restoring "${entry.id}" (${entry.table}) affected ${affected} row(s), expected 1. Rolled back.`
        );
      }
      count += 1;
    }

    const graph = await tx.readDependencyGraph([demoOrgId, quarantineOrgId]);
    assertNoCrossOrgDependencies(graph, 'post-rollback');
    return count;
  });

  return { restored, recoveredFromPlan };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function requiredArg(args: Args, flag: string, envName: string): string {
  return String(args[flag] || process.env[envName] || '').trim();
}

export function resolveDeclaredTarget(args: Args): Record<string, string> {
  return {
    railwayProject: requiredArg(args, 'railway-project', 'FIN005_RAILWAY_PROJECT'),
    railwayEnvironment: requiredArg(args, 'railway-environment', 'FIN005_RAILWAY_ENVIRONMENT'),
    railwayService: requiredArg(args, 'railway-service', 'FIN005_RAILWAY_SERVICE'),
    host: requiredArg(args, 'expect-host', 'FIN005_EXPECT_DB_HOST'),
    port: requiredArg(args, 'expect-port', 'FIN005_EXPECT_DB_PORT'),
    database: requiredArg(args, 'expect-database', 'FIN005_EXPECT_DB_NAME'),
    organizationId: requiredArg(args, 'demo-org-id', 'FIN005_DEMO_ORG_ID'),
  };
}

/**
 * The fingerprint of the connection we are ACTUALLY about to open.
 *
 * The port is whatever the connection string says and NOTHING ELSE. It is not
 * defaulted to 5432, and it is not defaulted to the declared/allowlisted port:
 * a URL with no port returns `null`, and `assertApprovedDemoTarget` refuses on
 * `null`. Substituting a default here would mean the guard "confirms" a port it
 * never observed, which is the whole defect this shape exists to prevent.
 */
export function parseConnectionFingerprint(connectionString: string): {
  host: string;
  port: number | null;
  database: string;
} {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // `new URL` throws a bare `TypeError: Invalid URL` — a refusal, but an
    // unbranded one, raised before the denylist has looked at anything. Re-throw
    // it as this script's own refusal. The connection string is NEVER echoed: it
    // carries the database password.
    throw new Error(
      `[${LABEL}] Refusing to run: the connection string is not a parsable URL, so its host, port and ` +
        `database cannot be confirmed against the approved target. Check DATABASE_URL / --database-url ` +
        `(the value is not printed here — it contains the password).`
    );
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : null,
    database: url.pathname.replace(/^\/+/, ''),
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const dryRun = args.write !== 'true' && !args.rollback;

  if (args['force-org']) {
    throw new Error(
      `[${LABEL}] --force-org no longer exists. It was removed deliberately: it let a single flag ` +
        `defeat every target check. A tenant that the FIN-005 allowlist refuses is out of band for ` +
        `this script — it gets its own packet, review and tooling. Do not reintroduce the flag.`
    );
  }

  const declared = resolveDeclaredTarget(args);
  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget(LABEL, target);

  const fingerprint = parseConnectionFingerprint(target.connectionString);
  const approved = assertApprovedDemoTarget({ declared, actual: fingerprint });
  const demoOrgId = approved.organizationId;

  const runId = String(args['run-id'] || stamp()).trim();
  const quarantineOrgId = buildQuarantineOrgId(demoOrgId, runId);
  const quarantineOrgName = buildQuarantineOrgName(runId);

  const pool = new pg.Pool({ connectionString: target.connectionString });
  const gateway = createPgGateway(pool);

  try {
    // The connected database must be the approved one at the SERVER, not just in
    // the URL we were handed.
    const liveDatabase = await gateway.currentDatabase();
    if (liveDatabase && liveDatabase !== approved.database) {
      throw new Error(
        `[${LABEL}] Connected to database "${liveDatabase}", but the approved target is "${approved.database}". Refusing to run.`
      );
    }
    const org = await gateway.organizationExists(demoOrgId);
    if (!org) {
      throw new Error(
        `[${LABEL}] Organization "${demoOrgId}" does not exist in the target database.`
      );
    }
    // STRICT demo marker: the column must exist and the value must be exactly
    // "DEMO". Absent column, NULL, '' and anything else all REFUSE — the old
    // `org.organizationType && …` form waved through every one of them.
    assertDemoOrganizationMarker({
      organizationId: demoOrgId,
      observed: {
        columnPresent: org.organizationTypeColumnPresent,
        value: org.organizationType,
      },
      role: 'demo organization',
    });

    if (args.rollback) {
      requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);
      const signingKey = resolveManifestSigningKey(process.env, 'a --rollback run');
      const manifest = readManifest(String(args.rollback));
      const outcome = await executeRollbackRun({
        gateway,
        manifest,
        target: { host: target.host, database: target.database },
        approvedOrganizationId: demoOrgId,
        signingKey,
      });
      console.log(
        `✅ Rollback complete — ${outcome.restored} row(s) returned to the demo tenant` +
          (outcome.recoveredFromPlan
            ? ' (recovered from a PREPARED manifest: the previous run crashed after COMMIT).'
            : '.')
      );
      return;
    }

    const rows = await gateway.listScopedRows(demoOrgId);
    const candidates = classifyFinanceDemoRows(rows, demoOrgId).all;
    const observeOnly = await gateway.countObserveOnly(demoOrgId);
    const foreign = candidates.filter((row) => !row.canonical);

    const reportPath = path.join(
      exportsDir(),
      `fin005-finance-demo-${dryRun ? 'dry-run' : 'write'}-${stamp()}.md`
    );
    fs.writeFileSync(
      reportPath,
      buildReport({
        demoOrgId,
        quarantineOrgId,
        dryRun,
        host: target.host,
        database: target.database,
        candidates,
        observeOnly,
      }),
      'utf8'
    );

    console.log(
      `[${LABEL}] demo tenant "${demoOrgId}": ${candidates.length} Finance row(s), ${foreign.length} foreign.`
    );
    console.log(`- report: ${reportPath}`);

    if (dryRun) {
      console.log('✅ Dry run complete. Nothing was modified.');
      console.log(
        `   Review the report, then re-run with --write and ${CONFIRM_ENV}=${CONFIRM_VALUE}.`
      );
      return;
    }

    if (foreign.length === 0) {
      console.log('✅ Nothing to quarantine — the demo tenant is already coherent.');
      return;
    }

    requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);

    // Fail before anything else if the manifest cannot be signed: a write run
    // that cannot produce an authenticated rollback plan must not start.
    const signingKey = resolveManifestSigningKey(process.env, 'a --write run');

    // SEED BEFORE QUARANTINE — read back the exact canonical ids AND their state,
    // and refuse if the golden flow is not fully materialized and READY. (Dry
    // runs never reach this: reporting on a half-seeded tenant is exactly what a
    // dry run is for.) This readback is ALSO the baseline the transaction
    // re-checks under `FOR UPDATE` before COMMIT.
    const preconditionFixture = await gateway.readCanonicalFixture(demoOrgId);
    assertCanonicalFixtureMaterialized(preconditionFixture, demoOrgId);

    console.log(
      `[${LABEL}] Write mode (run ${runId}). This will:\n` +
        `  - create organization "${quarantineOrgId}" (inactive, type DEMO, zero users);\n` +
        `  - re-point ${foreign.length} Finance row(s) from "${demoOrgId}" to it;\n` +
        `  - clear the tenant-pointing link columns on those rows (recorded for rollback);\n` +
        `  - DELETE nothing.`
    );

    const manifestPath = path.join(
      exportsDir(),
      `fin005-finance-demo-manifest-${stamp()}.json`
    );
    const manifest = await executeQuarantineRun({
      gateway,
      demoOrgId,
      quarantineOrgId,
      quarantineOrgName,
      runId,
      foreign,
      manifestPath,
      host: target.host,
      database: target.database,
      signingKey,
      preconditionFixture,
    });

    console.log(
      `✅ Quarantined ${manifest.entries.length} foreign Finance row(s). Nothing was deleted.`
    );
    console.log(`- manifest (rollback plan): ${manifestPath}`);
  } finally {
    await gateway.close();
  }
}

/**
 * Only the CLI entry auto-runs. Importing this module (tests, other scripts)
 * must never execute anything.
 */
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
    console.error(`❌ ${LABEL} failed:`, error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
