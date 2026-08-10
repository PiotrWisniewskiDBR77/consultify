#!/usr/bin/env tsx
/**
 * Finance v3 — WP-C03 deterministic legacy→canonical backfill (DRY RUN).
 *
 * Scope / hard rules (see task brief + CLAUDE.md golden rules):
 *   - NEVER touches a shared/live database. Every run of this script must be pointed at a
 *     throwaway, single-purpose ephemeral Postgres cluster (own data dir, own port, `initdb
 *     --locale=C`, torn down with `pg_ctl stop` + `rm -rf` after use). This script does not start
 *     or stop Postgres itself — that is orchestrated by the operator (see
 *     docs/validation/finance-v3/generated/gate-c/WP-C03_backfill_dryrun_report.md §1 for the exact
 *     commands used to validate this script).
 *   - `--database-url` / `DATABASE_URL` is REQUIRED and is not defaulted to anything — refusing to
 *     guess is safer than accidentally resolving to a shared instance.
 *
 * What this migrates (order, per the brief):
 *   Statements → Analysis → Models → Prediction (candidates/events) → Valuation → Exports
 *
 * Design (see the migration report for the full rationale):
 *   - Chunking is per (legacy_table, organization_id), ordered by legacy PK, fixed chunk size.
 *     Each chunk is one Postgres transaction: read source rows, classify+write, write ONE
 *     `finance_v3_backfill_checkpoints` row with status='done', COMMIT. A chunk is therefore either
 *     fully applied or (from the DB's point of view) never started — there is no partial-chunk state
 *     to reconcile on resume.
 *   - Resume = re-run with `--resume`: chunks whose checkpoint row already has status='done' are
 *     skipped; everything else (including a chunk that was merely *planned* but never committed) is
 *     (re)processed from scratch. All canonical writes are idempotent (ON CONFLICT DO NOTHING keyed
 *     by the legacy row's natural identity), so reprocessing a chunk that partially landed via a
 *     different path is safe too.
 *   - Checksums: before AND after processing a chunk, this script re-reads the exact same source
 *     rows and hashes them (sha256 over a deterministic JSON serialization). The two hashes must be
 *     identical — this is a dry-run invariant proving the backfill never mutates legacy tables, not
 *     just a resume-safety check. Both hashes are stored on the checkpoint row.
 *   - Quarantine: WP-A01's table-level classification (AUTO_MIGRATE / MIGRATE_WITH_WARNING /
 *     QUARANTINE / EXCLUDE_WITH_REASON), loaded at runtime from the actual Gate A manifest JSON (not
 *     duplicated/hardcoded), plus the row-level rules documented inline below (approved-without-
 *     snapshot, duplicate version numbers, ambiguous/event-only financial_model_events, orphaned
 *     tenant references). Quarantined/excluded rows are NEVER written into any canonical
 *     finance_artifacts/finance_business_versions row.
 *   - ORCH-DEC-001 (`docs/validation/finance-v3/generated/gate-b/ORCHESTRATOR_DECISIONS_LOG.md`):
 *     unambiguous decisional `financial_model_events` (debt_drawdown/debt_repayment/
 *     equity_injection/dividend) are migrated into a new PREDICTION_SCENARIO
 *     finance_business_version per source Baseline model, `mapping_reason` tagged
 *     `source=migrated_legacy_event`. Ambiguous ones (zero amount, exact duplicates) are quarantined,
 *     not silently dropped or silently migrated.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> tsx server/scripts/finance-v3-backfill-dry-run.ts seed
 *   DATABASE_URL=... tsx server/scripts/finance-v3-backfill-dry-run.ts run [--resume] [--crash-after N] [--chunk-size N]
 *   DATABASE_URL=... tsx server/scripts/finance-v3-backfill-dry-run.ts verify
 */

import crypto from 'crypto';

import { Pool, type PoolClient } from 'pg';

// ---------------------------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------------------------

type Args = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const command = argv[0] || '';
  const args: Args = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return { command, args };
}

function num(args: Args, key: string, fallback: number): number {
  const v = args[key];
  if (v === undefined) return fallback;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------------------------

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Deterministic sha256 over an array of rows, sorted by `id` so hashing is order-independent. */
function hashRows(rows: Array<Record<string, unknown>>): string {
  const sorted = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const normalized = sorted.map((r) => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(r).sort()) {
      const v = (r as any)[k];
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  });
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * FC-02.2 determinism fix (W2, 2026-08-10): `seed()` previously called bare `Math.random()` for
 * synthetic statement-value amounts, which made the *seed data itself* non-reproducible across two
 * independent invocations — a prerequisite for proving backfill determinism ("same input twice ->
 * same output") is a same, byte-identical input. Fixed-seed mulberry32 PRNG: same seed constant ->
 * same output sequence on every process/machine, no wall-clock or OS entropy involved.
 * See docs/validation/finance-v3/generated/gate-d/W2_BACKFILL_DETERMINISM_report.md.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTOR = 'finance-v3-backfill-dry-run:WP-C03';
const NOW = () => new Date();

// ---------------------------------------------------------------------------------------------
// WP-A01 classification (loaded at runtime from the real Gate A manifest — not re-hardcoded)
// ---------------------------------------------------------------------------------------------

type MappingConfidence = 'AUTO_MIGRATE' | 'MIGRATE_WITH_WARNING' | 'QUARANTINE' | 'EXCLUDE_WITH_REASON';

async function loadClassification(): Promise<Map<string, { classification: MappingConfidence; reason: string }>> {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(here, '../../docs/validation/finance-v3/generated/gate-a/WP-A01_inventory_manifest.json');
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const map = new Map<string, { classification: MappingConfidence; reason: string }>();
  for (const t of raw.tables as Array<{ name: string; classification: MappingConfidence; reason: string }>) {
    map.set(t.name, { classification: t.classification, reason: t.reason });
  }
  return map;
}

// ---------------------------------------------------------------------------------------------
// Bookkeeping tables (dry-run infra only — NOT shipped product migrations; the real WP-C03
// productionization would fold the checkpoint/quarantine/excluded ledgers into the job/observability
// tables from WP-B04/B07, but that requires a live orchestrator process this dry run doesn't have).
// ---------------------------------------------------------------------------------------------

async function ensureBookkeeping(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_v3_backfill_checkpoints (
      phase                   TEXT NOT NULL,
      legacy_table            TEXT NOT NULL,
      organization_id         TEXT NOT NULL,
      chunk_index             INTEGER NOT NULL,
      chunk_size              INTEGER NOT NULL,
      id_range_start          TEXT,
      id_range_end            TEXT,
      source_checksum_before  TEXT,
      source_checksum_after   TEXT,
      migrated_count          INTEGER NOT NULL DEFAULT 0,
      quarantined_count       INTEGER NOT NULL DEFAULT 0,
      excluded_count          INTEGER NOT NULL DEFAULT 0,
      total_count             INTEGER NOT NULL DEFAULT 0,
      status                  TEXT NOT NULL DEFAULT 'done',
      run_batch                TEXT NOT NULL,
      started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at               TIMESTAMPTZ,
      duration_ms                INTEGER,
      PRIMARY KEY (phase, legacy_table, organization_id, chunk_index)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_v3_backfill_quarantine_log (
      id                BIGSERIAL PRIMARY KEY,
      run_batch          TEXT NOT NULL,
      phase               TEXT NOT NULL,
      legacy_table          TEXT NOT NULL,
      legacy_id               TEXT NOT NULL,
      legacy_version            TEXT,
      organization_id             TEXT,
      reason_code                   TEXT NOT NULL,
      detail                          JSONB,
      created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (legacy_table, legacy_id, legacy_version)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_v3_backfill_excluded_log (
      id                BIGSERIAL PRIMARY KEY,
      run_batch          TEXT NOT NULL,
      phase               TEXT NOT NULL,
      legacy_table          TEXT NOT NULL,
      legacy_id               TEXT NOT NULL,
      organization_id_raw       TEXT,
      reason_code                  TEXT NOT NULL,
      detail                          JSONB,
      created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (legacy_table, legacy_id)
    );
  `);
}

// ---------------------------------------------------------------------------------------------
// Canonical-schema helpers (finance_artifacts / finance_business_versions / ... from WP-C01)
// ---------------------------------------------------------------------------------------------

type Queryable = { query: Pool['query'] };

let legacyEngineManifestId: string | null = null;
async function getLegacyEngineManifestId(pool: Queryable): Promise<string> {
  if (legacyEngineManifestId) return legacyEngineManifestId;
  const res = await pool.query(
    `SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN'`
  );
  if (!res.rows[0]) throw new Error('finance_engine_manifests LEGACY_UNKNOWN sentinel not found — did WP-C01 migrations run?');
  legacyEngineManifestId = res.rows[0].engine_manifest_id;
  return legacyEngineManifestId!;
}

// ---------------------------------------------------------------------------------------------
// F-2 fix — single-writer guard (docs/validation/finance-v3/generated/gate-d/
// W3_BACKFILL_LOCK_EXPORT_HASH_report.md). `getOrCreateArtifact()` below is a check-then-act
// (SELECT, then INSERT) race: two concurrent `seed`/`run` invocations against the same database
// can both miss each other's uncommitted row and each insert their own `finance_artifacts` row
// for the same (organization_id, natural_key) — reproduced directly at the SQL level in the
// report (§ F-2b). A session-scoped Postgres advisory lock, held for the whole `seed`/`run`
// invocation (acquired on a dedicated connection kept checked out from the pool for that purpose,
// released and unlocked in `main()`'s `finally`), makes two concurrent invocations mutually
// exclusive so this race can no longer happen at all — not just "fail safely if it happens".
//
// `pg_try_advisory_lock` (immediate refusal), not `pg_advisory_lock` (blocking wait), was chosen
// deliberately: this script's only real caller is a human operator running one shell command at a
// time (see file header — no cron, no orchestrator, no route). An operator who accidentally
// double-launches the job wants to find out INSTANTLY and unambiguously ("another run is already
// in progress, refusing to start a second one") — a silent indefinite block looks exactly like a
// hang (no distinguishing symptom from a genuinely stuck run), is much harder to diagnose from a
// terminal, and offers no operational upside here since there is no queue of pending work for a
// blocked second invocation to usefully wait for. This also matches the script's existing idiom
// of failing loud and immediately rather than waiting/retrying (`process.exit(2)` for a missing
// `--database-url`, an explicit thrown error for "Refusing to silently continue a prior run"
// instead of blocking on `--resume`). If this script is ever wired into an orchestrator with a
// real job queue, that would be the moment to reconsider — a queued caller might legitimately
// prefer to block — but that is a different, not-yet-existing caller, not this one.
const BACKFILL_ADVISORY_LOCK_KEY = 'finance-v3-backfill-dry-run:single-writer';

class BackfillLockHeldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackfillLockHeldError';
  }
}

/** Attempts to acquire the single-writer advisory lock on `client`'s own session. Throws BackfillLockHeldError if another session already holds it. */
async function acquireBackfillLock(client: PoolClient): Promise<void> {
  const res = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked`,
    [BACKFILL_ADVISORY_LOCK_KEY]
  );
  if (!res.rows[0]?.locked) {
    throw new BackfillLockHeldError(
      `Another finance-v3-backfill-dry-run 'seed' or 'run' process already holds the advisory lock ` +
        `(key='${BACKFILL_ADVISORY_LOCK_KEY}') on this database. Refusing to run concurrently — two ` +
        `simultaneous invocations race on getOrCreateArtifact()/createBusinessVersion() (F-2, ` +
        `docs/validation/finance-v3/generated/gate-d/W3_BACKFILL_LOCK_EXPORT_HASH_report.md). Wait ` +
        `for the other process to finish (or confirm its PID is actually dead — the lock is session-` +
        `scoped and releases automatically if that connection drops) and retry.`
    );
  }
}

/** Releases the single-writer advisory lock. Best-effort: the lock is session-scoped and is also released automatically when the connection closes. */
async function releaseBackfillLock(client: PoolClient): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [BACKFILL_ADVISORY_LOCK_KEY]).catch(() => {});
}

let raceTestDelayFired = false;

async function getOrCreateArtifact(
  client: PoolClient,
  opts: { organizationId: string; artifactType: string; naturalKey: string }
): Promise<string> {
  const existing = await client.query(
    `SELECT artifact_id FROM finance_artifacts WHERE organization_id = $1 AND natural_key = $2`,
    [opts.organizationId, opts.naturalKey]
  );
  if (existing.rows[0]) return existing.rows[0].artifact_id;
  // TEST-ONLY hook, no-op unless BACKFILL_RACE_TEST_DELAY_MS is set: widens the check-then-act
  // window between the SELECT above and the INSERT below so the F-2b silent-duplicate race
  // (docs/validation/finance-v3/generated/gate-d/W3_BACKFILL_LOCK_EXPORT_HASH_report.md) can be
  // reproduced and re-verified on demand instead of depending on incidental process-scheduling
  // luck. Fires only on this process's FIRST missing-artifact lookup (not every call) so two
  // concurrently-launched processes hit the delay at nearly the same wall-clock instant instead of
  // drifting apart over many delayed calls. Never set in normal seed/run/verify usage.
  const raceTestDelayMs = Number(process.env.BACKFILL_RACE_TEST_DELAY_MS || 0);
  if (raceTestDelayMs > 0 && !raceTestDelayFired) {
    raceTestDelayFired = true;
    await new Promise((resolve) => setTimeout(resolve, raceTestDelayMs));
  }
  const res = await client.query(
    `INSERT INTO finance_artifacts (organization_id, artifact_type, natural_key, created_by)
     VALUES ($1, $2, $3, $4) RETURNING artifact_id`,
    [opts.organizationId, opts.artifactType, opts.naturalKey, ACTOR]
  );
  return res.rows[0].artifact_id;
}

/** Creates a working_revision + compute_snapshot pair so a business_version can legally be APPROVED. */
async function createComputeChain(
  client: PoolClient,
  opts: { artifactId: string; organizationId: string; contentHash: string }
): Promise<string> {
  const engineManifestId = await getLegacyEngineManifestId(client);
  const seqRes = await client.query(
    `SELECT COALESCE(MAX(revision_seq), 0) + 1 AS next FROM finance_working_revisions WHERE artifact_id = $1`,
    [opts.artifactId]
  );
  const revisionSeq = seqRes.rows[0].next;
  const wrRes = await client.query(
    `INSERT INTO finance_working_revisions
       (artifact_id, organization_id, revision_seq, content_semantic_hash, is_current, edited_by)
     VALUES ($1, $2, $3, $4, false, $5) RETURNING working_revision_id`,
    [opts.artifactId, opts.organizationId, revisionSeq, opts.contentHash, ACTOR]
  );
  const workingRevisionId = wrRes.rows[0].working_revision_id;
  const csRes = await client.query(
    `INSERT INTO finance_compute_snapshots
       (artifact_id, organization_id, working_revision_id, engine_manifest_id, as_of, content_semantic_hash, created_by)
     VALUES ($1, $2, $3, $4, now(), $5, $6) RETURNING compute_snapshot_id`,
    [opts.artifactId, opts.organizationId, workingRevisionId, engineManifestId, opts.contentHash, ACTOR]
  );
  return csRes.rows[0].compute_snapshot_id;
}

type TargetStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED' | 'INVALIDATED' | 'SUPERSEDED';

async function createBusinessVersion(
  client: PoolClient,
  opts: {
    artifactId: string;
    organizationId: string;
    versionNo: number;
    status: TargetStatus;
    contentHash: string;
    parentVersionId?: string | null;
    invalidatedReason?: string;
    versionKind?: 'ORIGINAL' | 'RESTATED' | 'MANAGEMENT_ADJUSTED';
  }
): Promise<string> {
  let computeSnapshotId: string | null = null;
  if (opts.status === 'APPROVED') {
    computeSnapshotId = await createComputeChain(client, {
      artifactId: opts.artifactId,
      organizationId: opts.organizationId,
      contentHash: opts.contentHash,
    });
  }
  const res = await client.query(
    `INSERT INTO finance_business_versions
       (artifact_id, organization_id, version_no, status, engine_manifest_id, content_semantic_hash,
        compute_snapshot_id, parent_version_id, created_by,
        approved_by, approved_at, archived_by, archived_at, invalidated_reason,
        version_kind, result_quality)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             $10, $11, $12, $13, $14, $15, $16)
     RETURNING business_version_id`,
    [
      opts.artifactId,
      opts.organizationId,
      opts.versionNo,
      opts.status,
      await getLegacyEngineManifestId(client),
      opts.contentHash,
      computeSnapshotId,
      opts.parentVersionId ?? null,
      ACTOR,
      opts.status === 'APPROVED' ? ACTOR : null,
      opts.status === 'APPROVED' ? NOW() : null,
      opts.status === 'ARCHIVED' ? ACTOR : null,
      opts.status === 'ARCHIVED' ? NOW() : null,
      opts.status === 'INVALIDATED' ? opts.invalidatedReason ?? 'migrated_legacy_status' : null,
      opts.versionKind ?? 'ORIGINAL',
      'PROVISIONAL', // every backfilled row is provisional until a human/adapter re-confirms it (Gate C shadow parity, WP-C04)
    ]
  );
  const businessVersionId = res.rows[0].business_version_id;
  if (opts.parentVersionId) {
    await client.query(
      `UPDATE finance_business_versions
         SET status = 'SUPERSEDED', superseded_by_version_id = $1, superseded_at = now()
       WHERE business_version_id = $2 AND status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED')`,
      [businessVersionId, opts.parentVersionId]
    );
  }
  return businessVersionId;
}

async function insertAlias(
  client: PoolClient,
  opts: {
    legacyTable: string;
    legacyId: string;
    legacyVersion?: string | null;
    artifactId: string;
    organizationId: string;
    businessVersionId?: string | null;
    mappingConfidence: MappingConfidence;
    mappingReason: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO finance_artifact_aliases
       (legacy_table, legacy_id, legacy_version, artifact_id, organization_id, business_version_id,
        mapping_confidence, mapping_reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (legacy_table, legacy_id, legacy_version) DO NOTHING`,
    [
      opts.legacyTable,
      opts.legacyId,
      // Postgres UNIQUE treats every NULL as distinct, which would defeat
      // ON CONFLICT dedup for tables with no natural "version" (packs/statements/values/analyses).
      // Use '' (not NULL) as the "no version" sentinel so the unique key — and therefore
      // resume-idempotency — is well-defined for every legacy row, not just versioned ones.
      opts.legacyVersion ?? '',
      opts.artifactId,
      opts.organizationId,
      opts.businessVersionId ?? null,
      opts.mappingConfidence,
      opts.mappingReason,
      ACTOR,
    ]
  );
}

async function logQuarantine(
  client: PoolClient,
  opts: {
    runBatch: string;
    phase: string;
    legacyTable: string;
    legacyId: string;
    legacyVersion?: string | null;
    organizationId?: string | null;
    reasonCode: string;
    detail?: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO finance_v3_backfill_quarantine_log
       (run_batch, phase, legacy_table, legacy_id, legacy_version, organization_id, reason_code, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (legacy_table, legacy_id, legacy_version) DO NOTHING`,
    [
      opts.runBatch,
      opts.phase,
      opts.legacyTable,
      opts.legacyId,
      opts.legacyVersion ?? '', // see insertAlias note: '' not NULL, so ON CONFLICT dedup is well-defined
      opts.organizationId ?? null,
      opts.reasonCode,
      JSON.stringify(opts.detail ?? {}),
    ]
  );
}

async function logExcluded(
  client: PoolClient,
  opts: {
    runBatch: string;
    phase: string;
    legacyTable: string;
    legacyId: string;
    organizationIdRaw?: string | null;
    reasonCode: string;
    detail?: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO finance_v3_backfill_excluded_log
       (run_batch, phase, legacy_table, legacy_id, organization_id_raw, reason_code, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (legacy_table, legacy_id) DO NOTHING`,
    [opts.runBatch, opts.phase, opts.legacyTable, opts.legacyId, opts.organizationIdRaw ?? null, opts.reasonCode, JSON.stringify(opts.detail ?? {})]
  );
}

// ---------------------------------------------------------------------------------------------
// Chunked-driver: generic per (phase, legacyTable, organizationId) chunk runner with
// checkpoint/resume + before/after source checksums.
// ---------------------------------------------------------------------------------------------

class CrashRequested extends Error {}

type ChunkOutcome = { migrated: number; quarantined: number; excluded: number };

async function runChunked(
  pool: Pool,
  opts: {
    phase: string;
    legacyTable: string;
    organizationId: string;
    ids: string[]; // full, sorted id list for this (table, org)
    chunkSize: number;
    runBatch: string;
    resume: boolean;
    crashState: { remaining: number };
    fetchRows: (client: PoolClient, ids: string[]) => Promise<Array<Record<string, unknown>>>;
    processChunk: (
      client: PoolClient,
      rows: Array<Record<string, unknown>>
    ) => Promise<ChunkOutcome>;
  }
): Promise<void> {
  const chunks = chunk(opts.ids, opts.chunkSize);
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const ids = chunks[chunkIndex];
    const existing = await pool.query(
      `SELECT status FROM finance_v3_backfill_checkpoints
       WHERE phase = $1 AND legacy_table = $2 AND organization_id = $3 AND chunk_index = $4`,
      [opts.phase, opts.legacyTable, opts.organizationId, chunkIndex]
    );
    if (existing.rows[0]?.status === 'done') {
      if (!opts.resume) {
        throw new Error(
          `Checkpoint already exists for ${opts.phase}/${opts.legacyTable}/${opts.organizationId}#${chunkIndex} ` +
            `but --resume was not passed. Refusing to silently continue a prior run.`
        );
      }
      continue; // already done — skip (this IS the resume mechanism)
    }

    const startedAt = Date.now();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await opts.fetchRows(client, ids);
      const checksumBefore = hashRows(before);

      const outcome = await opts.processChunk(client, before);

      const after = await opts.fetchRows(client, ids);
      const checksumAfter = hashRows(after);
      if (checksumAfter !== checksumBefore) {
        throw new Error(
          `Source-immutability violation: ${opts.legacyTable} chunk ${chunkIndex} changed during processing ` +
            `(before=${checksumBefore} after=${checksumAfter}). The dry run must never mutate legacy tables.`
        );
      }

      // NOTE: `outcome.migrated/quarantined/excluded` are informational per-chunk counters, stored
      // on the checkpoint row for timing/observability. They are intentionally NOT asserted to sum
      // to `before.length` here: for the Models/Valuation phases one source row (financial_models /
      // valuations) fans out into N version-slot outcomes (its financial_model_versions/
      // valuation_snapshots history), so "rows in this chunk" and "outcomes produced" are different
      // units within that fan-out. The authoritative "input = migrated + quarantined + excluded"
      // equation is checked per LEGACY TABLE (the correct accounting unit — matching how
      // `finance_artifact_aliases`/the quarantine/excluded logs attribute `legacy_table`) by the
      // `verify` command, against ground truth in the database, not against in-memory counters.
      const total = outcome.migrated + outcome.quarantined + outcome.excluded;

      await client.query(
        `INSERT INTO finance_v3_backfill_checkpoints
           (phase, legacy_table, organization_id, chunk_index, chunk_size, id_range_start, id_range_end,
            source_checksum_before, source_checksum_after, migrated_count, quarantined_count, excluded_count,
            total_count, status, run_batch, finished_at, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'done',$14, now(), $15)
         ON CONFLICT (phase, legacy_table, organization_id, chunk_index) DO UPDATE SET
           chunk_size = EXCLUDED.chunk_size, id_range_start = EXCLUDED.id_range_start,
           id_range_end = EXCLUDED.id_range_end, source_checksum_before = EXCLUDED.source_checksum_before,
           source_checksum_after = EXCLUDED.source_checksum_after, migrated_count = EXCLUDED.migrated_count,
           quarantined_count = EXCLUDED.quarantined_count, excluded_count = EXCLUDED.excluded_count,
           total_count = EXCLUDED.total_count, status = 'done', run_batch = EXCLUDED.run_batch,
           finished_at = now(), duration_ms = EXCLUDED.duration_ms`,
        [
          opts.phase,
          opts.legacyTable,
          opts.organizationId,
          chunkIndex,
          ids.length,
          ids[0] ?? null,
          ids[ids.length - 1] ?? null,
          checksumBefore,
          checksumAfter,
          outcome.migrated,
          outcome.quarantined,
          outcome.excluded,
          total,
          opts.runBatch,
          Date.now() - startedAt,
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    opts.crashState.remaining--;
    if (opts.crashState.remaining === 0) {
      throw new CrashRequested(
        `Simulated crash requested: exiting after committing chunk ${opts.phase}/${opts.legacyTable}/${opts.organizationId}#${chunkIndex}`
      );
    }
  }
}

async function sortedIds(pool: Pool, table: string, orgColumn: string, organizationId: string): Promise<string[]> {
  const res = await pool.query(`SELECT id FROM ${table} WHERE ${orgColumn} = $1 ORDER BY id ASC`, [organizationId]);
  return res.rows.map((r) => String(r.id));
}

// ---------------------------------------------------------------------------------------------
// SEED — synthetic legacy data, modeled on the real legacy schema (see WP-A01/A03).
// ---------------------------------------------------------------------------------------------

async function seed(pool: Pool) {
  console.log('Seeding synthetic legacy Finance data (organizations + ~1000 legacy rows)...');

  const orgs = ['org-fv3-alpha', 'org-fv3-beta', 'org-fv3-gamma'];
  const ghostOrg = 'org-fv3-ghost-unregistered'; // deliberately NEVER inserted into `organizations`

  for (const org of orgs) {
    await pool.query(
      `INSERT INTO organizations (id, name, organization_type, status) VALUES ($1, $2, 'DEMO', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [org, `Finance V3 Synthetic Org ${org}`]
    );
  }

  // analysis_financials / initiative_financials do not exist on a fresh Postgres database: their
  // migrations (067_economics_initiative_integration.sql / 068_economics_analysis_financials.sql)
  // predate the 500-numbering convention and use SQLite's `DATETIME` type, so
  // server/scripts/migrate.postgres.ts's own isSqliteOnlyMigration() filter (version < 500, not
  // `000_z_core_baseline`-prefixed) skips them entirely on a strict fresh-Postgres replay — verified
  // empirically on this dry run's own ephemeral cluster (`\d analysis_financials` -> relation does
  // not exist after a full 586-migration replay; `psql -f 068_...sql` fails with
  // `type "datetime" does not exist`). They are recreated here with the SAME shape, TIMESTAMP instead
  // of DATETIME, so this dry run can exercise WP-A01's QUARANTINE classification for them at all.
  // This is a genuine, load-bearing finding for WP-C03 productionization, not a seed-script
  // shortcut — see the migration report §2.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_financials (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL UNIQUE REFERENCES digitization_analyses(id) ON DELETE CASCADE,
      initiative_id TEXT,
      organization_id TEXT NOT NULL,
      npv REAL, irr REAL, payback_months REAL, roi_percent REAL,
      currency TEXT DEFAULT 'PLN',
      created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS initiative_financials (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
      analysis_id TEXT,
      organization_id TEXT NOT NULL,
      npv REAL, irr REAL, payback_months REAL, roi_percent REAL,
      currency TEXT DEFAULT 'PLN',
      created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  let uid = 0;
  const id = (prefix: string) => `${prefix}-${(++uid).toString(36)}`;
  // Fixed seed — see mulberry32() doc comment. Any two independent `seed` invocations against two
  // fresh databases must produce byte-identical legacy data; a bare Math.random() here would make
  // that impossible and confound determinism testing of the backfill itself with non-determinism
  // in the *test fixture*.
  const rng = mulberry32(0xf1a3ce5d);
  // Same reasoning as `rng` above: legacy `approved_at` timestamps must be reproducible across two
  // independent `seed` invocations, not wall-clock-dependent (`new Date()` would make seed run A
  // and seed run B differ by however many ms/seconds elapsed between the two invocations, polluting
  // the source-row checksums this script itself computes per chunk).
  const SEED_APPROVED_AT = new Date('2026-01-15T00:00:00.000Z');

  for (const org of orgs) {
    // ---- Statements: financial_statement_packs (AUTO_MIGRATE) + children (MIGRATE_WITH_WARNING) ----
    const packStates: Array<[string, string]> = [
      ['confirmed', 'ready'],
      ['confirmed', 'ready'],
      ['draft', 'pending'],
      ['partial', 'recoverable'],
      ['archived', 'ready'],
      ['needs_review', 'rejected'],
    ];
    for (const [packIndex, [packStatus, readiness]] of packStates.entries()) {
      const packId = id('pack');
      await pool.query(
        `INSERT INTO financial_statement_packs
           (id, organization_id, entity_name, period_start, period_end, period_label, pack_status, pack_readiness_status, pack_readiness_score)
         VALUES ($1,$2,$3,'2024-01-01','2024-12-31','FY2024',$4,$5,$6)`,
        [packId, org, `${org} Synthetic Entity`, packStatus, readiness, readiness === 'ready' ? 0.95 : 0.4]
      );
      for (const stType of ['P&L', 'BS', 'CF']) {
        const stId = id('stmt');
        // Inject one cross-org mismatch statement per org, deterministically (on the first
        // 'confirmed' pack's CF statement), to exercise the tenant-scoping risk WP-A03 flagged for
        // these child tables (financial_statements has organization_id but no FK tying it back to
        // its pack's organization_id — nothing in the schema prevents this drift).
        const crossOrgAnomaly = stType === 'CF' && packIndex === 0;
        const stOrg = crossOrgAnomaly ? orgs[(orgs.indexOf(org) + 1) % orgs.length] : org;
        await pool.query(
          `INSERT INTO financial_statements
             (id, organization_id, entity_name, statement_type, period_start, period_end, period_label, status, statement_pack_id)
           VALUES ($1,$2,$3,$4,'2024-01-01','2024-12-31','FY2024',$5,$6)`,
          [stId, stOrg, `${org} Synthetic Entity`, stType, packStatus === 'archived' ? 'archived' : 'confirmed', packId]
        );
        for (let i = 0; i < 8; i++) {
          await pool.query(
            `INSERT INTO financial_statement_values (id, statement_id, original_label, value, mapping_status)
             VALUES ($1,$2,$3,$4,'auto')`,
            [id('val'), stId, `Line ${i}`, i === 3 ? null : Math.round(rng() * 1_000_000) / 100, ]
          );
        }
        for (let v = 1; v <= 2; v++) {
          await pool.query(
            `INSERT INTO financial_statement_versions (id, statement_id, version_no, version_kind, readiness_status, snapshot_json)
             VALUES ($1,$2,$3,'confirmed',$4,'{}')`,
            [id('stmtver'), stId, v, readiness]
          );
        }
      }
    }
    // One orphan statement (no pack) -> quarantine (ORPHAN_STATEMENT_NO_PACK)
    await pool.query(
      `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, status)
       VALUES ($1,$2,'P&L','2023-01-01','2023-12-31','draft')`,
      [id('stmt-orphan'), org]
    );

    // ---- Analysis: financial_analyses (MIGRATE_WITH_WARNING) ----
    for (let i = 0; i < 8; i++) {
      const status = i % 4 === 0 ? 'APPROVED' : i % 4 === 1 ? 'REVIEW' : 'DRAFT';
      await pool.query(
        `INSERT INTO financial_analyses (id, organization_id, title, status) VALUES ($1,$2,$3,$4)`,
        [id('analysis'), org, `${org} Analysis ${i}`, status]
      );
    }

    // ---- Analysis (legacy parallel stores): analysis_financials / initiative_financials (QUARANTINE) ----
    for (let i = 0; i < 6; i++) {
      const daId = id('da');
      await pool.query(
        `INSERT INTO digitization_analyses (id, name, organization_id, created_by) VALUES ($1,$2,$3,$4)`,
        [daId, `${org} Digitization ${i}`, org, ACTOR]
      );
      // Two rows per org get a "ghost" organization_id (no FK on this table -> possible in legacy
      // reality) to exercise EXCLUDE_WITH_REASON for a second, different legacy table.
      const orgForRow = i < 2 ? ghostOrg : org;
      await pool.query(
        `INSERT INTO analysis_financials (id, analysis_id, organization_id, npv, irr) VALUES ($1,$2,$3,$4,$5)`,
        [id('af'), daId, orgForRow, 100000 + i, 0.12]
      );
    }
    for (let i = 0; i < 6; i++) {
      const initId = id('init');
      await pool.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1,$2,$3,'DRAFT')`,
        [initId, org, `${org} Initiative ${i}`]
      );
      const orgForRow = i < 2 ? ghostOrg : org;
      await pool.query(
        `INSERT INTO initiative_financials (id, initiative_id, organization_id, npv, irr) VALUES ($1,$2,$3,$4,$5)`,
        [id('if'), initId, orgForRow, 50000 + i, 0.09]
      );
    }

    // ---- Models: financial_models (MIGRATE_WITH_WARNING) + financial_model_versions + financial_model_events ----
    for (let m = 0; m < 8; m++) {
      const modelId = id('model');
      // m=0: approved WITHOUT snapshot (Gate A "approved without snapshot" bug) -> row-level quarantine.
      const approvedWithoutSnapshot = m === 0;
      const status = m % 5 === 0 ? 'archived' : approvedWithoutSnapshot ? 'approved' : m % 3 === 0 ? 'approved' : m % 3 === 1 ? 'review' : 'draft';
      const modelVersion = 3;
      await pool.query(
        `INSERT INTO financial_models
           (id, organization_id, name, start_date, status, version, approved_by, approved_at, approved_snapshot)
         VALUES ($1,$2,$3,'2024-01-01',$4,$5,$6,$7,$8)`,
        [
          modelId,
          org,
          `${org} Model ${m}`,
          status,
          modelVersion,
          status === 'approved' ? 'backfill-seed' : null,
          status === 'approved' ? SEED_APPROVED_AT : null,
          status === 'approved' && !approvedWithoutSnapshot ? JSON.stringify({ snapshot: true }) : null,
        ]
      );
      // Version history: v1, v2 always present.
      // NOTE: WP-A01 (2026-08-09) flagged financial_model_versions as missing UNIQUE(model_id,
      // version) — the same gap valuation_snapshots still has (see below). Empirically, on THIS
      // schema replay, `financial_model_versions` already carries `uq_fmver_model_version` UNIQUE
      // (model_id, version), added later by 20260801_fin003_004_case_scenario_baseline.sql — i.e.
      // that specific finding is now stale for this table (confirmed by the DB physically rejecting
      // a duplicate-version INSERT here). Documented in the migration report; the
      // DUPLICATE_VERSION_NUMBER quarantine path is kept in the backfill for defensive handling of
      // any pre-constraint historical rows, but cannot be demonstrated against financial_model_versions
      // on this schema — the valuation_snapshots case below still reproduces it.
      const versionNumbers = [1, 2];
      for (const v of versionNumbers) {
        await pool.query(
          `INSERT INTO financial_model_versions (id, model_id, version, snapshot_data, approved_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [id('modelver'), modelId, v, JSON.stringify({ v }), 'backfill-seed']
        );
      }
      // Events: mix of decisional (debt_drawdown/debt_repayment/equity_injection/dividend) and
      // non-decisional (revenue/cogs/opex/...). Includes one zero-amount and one exact-duplicate
      // decisional event on m=2 to exercise AMBIGUOUS_DECISION_EVENT.
      const nonDecisional: Array<[string, string]> = [
        ['revenue', 'operating'],
        ['cogs', 'operating'],
        ['opex', 'operating'],
        ['capex_purchase', 'investing'],
      ];
      for (const [etype, cf] of nonDecisional) {
        await pool.query(
          `INSERT INTO financial_model_events (id, model_id, event_type, name, amount, period_start, cf_classification, posting_rules)
           VALUES ($1,$2,$3,$4,$5,'2024-02-01',$6,'{}')`,
          [id('evt'), modelId, etype, `${etype} event`, 10000 + m * 10, cf]
        );
      }
      const decisional: Array<[string, string, number]> = [
        ['debt_drawdown', 'financing', 500000],
        ['equity_injection', 'financing', 250000],
      ];
      for (const [etype, cf, amount] of decisional) {
        await pool.query(
          `INSERT INTO financial_model_events (id, model_id, event_type, name, amount, period_start, cf_classification, posting_rules)
           VALUES ($1,$2,$3,$4,$5,'2024-03-01',$6,'{}')`,
          [id('evt'), modelId, etype, `${etype} event`, amount, cf]
        );
      }
      if (m === 2) {
        // zero-amount decisional event -> ambiguous
        await pool.query(
          `INSERT INTO financial_model_events (id, model_id, event_type, name, amount, period_start, cf_classification, posting_rules)
           VALUES ($1,$2,'dividend','dividend zero',0,'2024-04-01','financing','{}')`,
          [id('evt'), modelId]
        );
        // exact duplicate decisional event pair -> ambiguous
        const dupId1 = id('evt');
        const dupId2 = id('evt');
        await pool.query(
          `INSERT INTO financial_model_events (id, model_id, event_type, name, amount, period_start, cf_classification, posting_rules)
           VALUES ($1,$2,'debt_repayment','repay A',75000,'2024-05-01','financing','{}')`,
          [dupId1, modelId]
        );
        await pool.query(
          `INSERT INTO financial_model_events (id, model_id, event_type, name, amount, period_start, cf_classification, posting_rules)
           VALUES ($1,$2,'debt_repayment','repay A dup',75000,'2024-05-01','financing','{}')`,
          [dupId2, modelId]
        );
      }
    }

    // ---- Valuation: valuations (MIGRATE_WITH_WARNING) + valuation_snapshots ----
    for (let v = 0; v < 5; v++) {
      const valId = id('val_case');
      const status = v % 3 === 0 ? 'APPROVED' : v % 3 === 1 ? 'REVIEW' : 'DRAFT';
      await pool.query(
        `INSERT INTO valuations (id, organization_id, title, status, source_type, version, approved_by, approved_at)
         VALUES ($1,$2,$3,$4,'manual',$5,$6,$7)`,
        [valId, org, `${org} Valuation ${v}`, status, 2, status === 'APPROVED' ? 'backfill-seed' : null, status === 'APPROVED' ? SEED_APPROVED_AT : null]
      );
      const snapVersions = v === 1 ? [1, 2, 2] : [1, 2]; // duplicate on v=1
      for (const sv of snapVersions) {
        await pool.query(
          `INSERT INTO valuation_snapshots (id, valuation_id, version, snapshot_data, approved_by)
           VALUES ($1,$2,$3,$4,'backfill-seed')`,
          [id('valsnap'), valId, sv, JSON.stringify({ sv })]
        );
      }
    }
  }

  // One financial_statement_pack with a genuinely orphaned organization_id (no FK on this column —
  // a real, already-identified integrity gap per WP-A01) -> EXCLUDE_WITH_REASON.
  await pool.query(
    `INSERT INTO financial_statement_packs (id, organization_id, entity_name, period_start, period_end, pack_status, pack_readiness_status)
     VALUES ($1,$2,'Ghost Entity','2024-01-01','2024-12-31','draft','pending')`,
    [id('pack-ghost'), ghostOrg]
  );

  const counts = await pool.query(`
    SELECT
      (SELECT count(*) FROM financial_statement_packs) AS packs,
      (SELECT count(*) FROM financial_statements) AS statements,
      (SELECT count(*) FROM financial_statement_values) AS statement_values,
      (SELECT count(*) FROM financial_statement_versions) AS statement_versions,
      (SELECT count(*) FROM financial_analyses) AS analyses,
      (SELECT count(*) FROM analysis_financials) AS analysis_financials,
      (SELECT count(*) FROM initiative_financials) AS initiative_financials,
      (SELECT count(*) FROM financial_models) AS models,
      (SELECT count(*) FROM financial_model_versions) AS model_versions,
      (SELECT count(*) FROM financial_model_events) AS model_events,
      (SELECT count(*) FROM valuations) AS valuations,
      (SELECT count(*) FROM valuation_snapshots) AS valuation_snapshots
  `);
  console.log('Seed complete:', counts.rows[0]);
}

// ---------------------------------------------------------------------------------------------
// PHASE 1 — Statements
// ---------------------------------------------------------------------------------------------

async function phaseStatements(pool: Pool, ctx: RunCtx) {
  const cls = ctx.classification.get('financial_statement_packs')!;
  const orgs = await allOrgIds(pool);
  for (const org of orgs) {
    const ids = await sortedIds(pool, 'financial_statement_packs', 'organization_id', org);
    await runChunked(pool, {
      phase: 'statements',
      legacyTable: 'financial_statement_packs',
      organizationId: org,
      ids,
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_statement_packs WHERE id = ANY($1) ORDER BY id`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        let migrated = 0;
        let quarantined = 0;
        let excluded = 0;
        for (const pack of rows) {
          const artifactId = await getOrCreateArtifact(client, {
            organizationId: org,
            artifactType: 'STATEMENT_PACK',
            naturalKey: `financial_statement_packs:${pack.id}`,
          });
          const status = mapPackStatus(pack);
          const contentHash = sha256({ t: 'financial_statement_packs', id: pack.id, pack_status: pack.pack_status, pack_readiness_status: pack.pack_readiness_status });
          const bvId = await createBusinessVersion(client, {
            artifactId,
            organizationId: org,
            versionNo: 1,
            status,
            contentHash,
            invalidatedReason: status === 'INVALIDATED' ? 'legacy_pack_readiness_status_rejected' : undefined,
          });
          await insertAlias(client, {
            legacyTable: 'financial_statement_packs',
            legacyId: String(pack.id),
            artifactId,
            organizationId: org,
            businessVersionId: bvId,
            mappingConfidence: cls.classification,
            mappingReason: `pack_status=${pack.pack_status};pack_readiness_status=${pack.pack_readiness_status}`,
          });
          migrated++;

          // Cascade children within the same transaction/chunk (bounded fan-out per pack).
          const statements = (
            await client.query(`SELECT * FROM financial_statements WHERE statement_pack_id = $1`, [pack.id])
          ).rows;
          for (const st of statements) {
            if (st.organization_id !== org) {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'statements',
                legacyTable: 'financial_statements',
                legacyId: st.id,
                organizationId: st.organization_id,
                reasonCode: 'CROSS_ORG_STATEMENT_PACK_MISMATCH',
                detail: { pack_org: org, statement_org: st.organization_id, pack_id: pack.id },
              });
              // Cascade: children of a quarantined statement must also be accounted for in the
              // equation (their own legacy tables), not silently dropped. Their fate is tied to the
              // parent, not independently re-classified.
              const orphanedValues = (await client.query(`SELECT id FROM financial_statement_values WHERE statement_id = $1`, [st.id])).rows;
              for (const v of orphanedValues) {
                await logQuarantine(client, {
                  runBatch: ctx.runBatch,
                  phase: 'statements',
                  legacyTable: 'financial_statement_values',
                  legacyId: v.id,
                  organizationId: st.organization_id,
                  reasonCode: 'PARENT_STATEMENT_QUARANTINED',
                  detail: { statement_id: st.id, parent_reason: 'CROSS_ORG_STATEMENT_PACK_MISMATCH' },
                });
              }
              const orphanedVersions = (await client.query(`SELECT id, version_no FROM financial_statement_versions WHERE statement_id = $1`, [st.id])).rows;
              for (const sv of orphanedVersions) {
                await logQuarantine(client, {
                  runBatch: ctx.runBatch,
                  phase: 'statements',
                  legacyTable: 'financial_statement_versions',
                  legacyId: sv.id,
                  legacyVersion: String(sv.version_no),
                  organizationId: st.organization_id,
                  reasonCode: 'PARENT_STATEMENT_QUARANTINED',
                  detail: { statement_id: st.id, parent_reason: 'CROSS_ORG_STATEMENT_PACK_MISMATCH' },
                });
              }
              continue;
            }
            await insertAlias(client, {
              legacyTable: 'financial_statements',
              legacyId: st.id,
              artifactId,
              organizationId: org,
              businessVersionId: bvId,
              mappingConfidence: ctx.classification.get('financial_statements')!.classification,
              mappingReason: `child_of_pack=${pack.id}`,
            });
            const values = (await client.query(`SELECT id FROM financial_statement_values WHERE statement_id = $1`, [st.id])).rows;
            for (const v of values) {
              await insertAlias(client, {
                legacyTable: 'financial_statement_values',
                legacyId: v.id,
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('financial_statement_values')!.classification,
                mappingReason: `child_of_statement=${st.id}`,
              });
            }
            const versions = (await client.query(`SELECT id, version_no FROM financial_statement_versions WHERE statement_id = $1`, [st.id])).rows;
            for (const sv of versions) {
              await insertAlias(client, {
                legacyTable: 'financial_statement_versions',
                legacyId: sv.id,
                legacyVersion: String(sv.version_no),
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('financial_statement_versions')!.classification,
                mappingReason: `child_of_statement=${st.id}`,
              });
            }
          }
        }
        return { migrated, quarantined, excluded };
      },
    });
  }

  // Orphaned-org pack (EXCLUDE_WITH_REASON) — its own org has no row in `organizations`, so it can
  // never get a finance_artifacts row (FK). Processed as its own single-row "chunk" per org bucket
  // keyed by the raw (unregistered) org id, same checkpoint/resume mechanism.
  const ghostRes = await pool.query(
    `SELECT p.id, p.organization_id FROM financial_statement_packs p
     WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.organization_id)`
  );
  for (const row of ghostRes.rows) {
    await runChunked(pool, {
      phase: 'statements',
      legacyTable: 'financial_statement_packs',
      organizationId: `__unregistered__:${row.organization_id}`,
      ids: [row.id],
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_statement_packs WHERE id = ANY($1)`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        for (const pack of rows) {
          await logExcluded(client, {
            runBatch: ctx.runBatch,
            phase: 'statements',
            legacyTable: 'financial_statement_packs',
            legacyId: pack.id,
            organizationIdRaw: pack.organization_id,
            reasonCode: 'ORPHANED_ORG_REFERENCE',
            detail: { organization_id: pack.organization_id },
          });
        }
        return { migrated: 0, quarantined: 0, excluded: rows.length };
      },
    });
  }

  // Orphan statements (no pack at all) — quarantine, no valid parent artifact to attach to.
  const orphanStRes = await pool.query(
    `SELECT id, organization_id FROM financial_statements WHERE statement_pack_id IS NULL`
  );
  for (const org of orgs) {
    const rows = orphanStRes.rows.filter((r) => r.organization_id === org);
    if (!rows.length) continue;
    await runChunked(pool, {
      phase: 'statements',
      legacyTable: 'financial_statements_orphan',
      organizationId: org,
      ids: rows.map((r) => r.id),
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_statements WHERE id = ANY($1)`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, chunkRows) => {
        for (const st of chunkRows) {
          await logQuarantine(client, {
            runBatch: ctx.runBatch,
            phase: 'statements',
            legacyTable: 'financial_statements',
            legacyId: st.id,
            organizationId: st.organization_id,
            reasonCode: 'ORPHAN_STATEMENT_NO_PACK',
          });
        }
        return { migrated: 0, quarantined: chunkRows.length, excluded: 0 };
      },
    });
  }
}

function mapPackStatus(pack: Record<string, unknown>): TargetStatus {
  if (pack.pack_status === 'archived') return 'ARCHIVED';
  if (pack.pack_readiness_status === 'rejected') return 'INVALIDATED';
  if (pack.pack_status === 'confirmed' && pack.pack_readiness_status === 'ready') return 'APPROVED';
  return 'DRAFT';
}

// ---------------------------------------------------------------------------------------------
// PHASE 2 — Analysis
// ---------------------------------------------------------------------------------------------

async function phaseAnalysis(pool: Pool, ctx: RunCtx) {
  const orgs = await allOrgIds(pool);
  for (const org of orgs) {
    const ids = await sortedIds(pool, 'financial_analyses', 'organization_id', org);
    await runChunked(pool, {
      phase: 'analysis',
      legacyTable: 'financial_analyses',
      organizationId: org,
      ids,
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_analyses WHERE id = ANY($1) ORDER BY id`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        for (const a of rows) {
          const artifactId = await getOrCreateArtifact(client, {
            organizationId: org,
            artifactType: 'HISTORICAL_ANALYSIS',
            naturalKey: `financial_analyses:${a.id}`,
          });
          const status: TargetStatus = a.status === 'APPROVED' ? 'APPROVED' : a.status === 'REVIEW' ? 'IN_REVIEW' : 'DRAFT';
          const contentHash = sha256({ t: 'financial_analyses', id: a.id, status: a.status });
          const bvId = await createBusinessVersion(client, {
            artifactId,
            organizationId: org,
            versionNo: 1,
            status,
            contentHash,
          });
          await insertAlias(client, {
            legacyTable: 'financial_analyses',
            legacyId: a.id,
            artifactId,
            organizationId: org,
            businessVersionId: bvId,
            mappingConfidence: ctx.classification.get('financial_analyses')!.classification,
            mappingReason: `status=${a.status}; ORCH-DEC-002: financial_analyses is the sole canonical NPV/IRR/ROI source`,
          });
        }
        return { migrated: rows.length, quarantined: 0, excluded: 0 };
      },
    });
  }

  // Legacy parallel stores — whole-table QUARANTINE per WP-A01 + ORCH-DEC-002 (adapter-only,
  // outside the canonical DAG: neither maps to one of the 6 finance_artifacts.artifact_type values).
  for (const table of ['analysis_financials', 'initiative_financials']) {
    for (const org of [...orgs, '__ghost__']) {
      const orgFilter = org === '__ghost__' ? null : org;
      const rowsRes = orgFilter
        ? await pool.query(`SELECT id, organization_id FROM ${table} WHERE organization_id = $1 ORDER BY id`, [orgFilter])
        : await pool.query(
            `SELECT id, organization_id FROM ${table} WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ${table}.organization_id) ORDER BY id`
          );
      if (!rowsRes.rows.length) continue;
      await runChunked(pool, {
        phase: 'analysis',
        legacyTable: table,
        organizationId: org,
        ids: rowsRes.rows.map((r) => r.id),
        chunkSize: ctx.chunkSize,
        runBatch: ctx.runBatch,
        resume: ctx.resume,
        crashState: ctx.crashState,
        fetchRows: (client, chunkIds) => client.query(`SELECT * FROM ${table} WHERE id = ANY($1)`, [chunkIds]).then((r) => r.rows),
        processChunk: async (client, chunkRows) => {
          let quarantined = 0;
          let excluded = 0;
          for (const row of chunkRows) {
            const orgExists = (await client.query(`SELECT 1 FROM organizations WHERE id = $1`, [row.organization_id])).rows.length > 0;
            if (!orgExists) {
              await logExcluded(client, {
                runBatch: ctx.runBatch,
                phase: 'analysis',
                legacyTable: table,
                legacyId: row.id,
                organizationIdRaw: row.organization_id,
                reasonCode: 'ORPHANED_ORG_REFERENCE',
              });
              excluded++;
            } else {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'analysis',
                legacyTable: table,
                legacyId: row.id,
                organizationId: row.organization_id,
                reasonCode: 'LEGACY_PARALLEL_STORE_UNRECONCILED',
                detail: { orch_decision: 'ORCH-DEC-002' },
              });
              quarantined++;
            }
          }
          return { migrated: 0, quarantined, excluded };
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// PHASE 3 — Models (Baseline) — includes version-chain reconciliation (Gate A "duplicate version" +
// "approved without snapshot" fixes) and returns the model->artifact map for the Prediction phase.
// ---------------------------------------------------------------------------------------------

type ModelArtifactInfo = { artifactId: string; organizationId: string; currentBusinessVersionId: string | null };

async function phaseModels(pool: Pool, ctx: RunCtx): Promise<Map<string, ModelArtifactInfo>> {
  const modelArtifacts = new Map<string, ModelArtifactInfo>();
  const orgs = await allOrgIds(pool);
  for (const org of orgs) {
    const ids = await sortedIds(pool, 'financial_models', 'organization_id', org);
    await runChunked(pool, {
      phase: 'models',
      legacyTable: 'financial_models',
      organizationId: org,
      ids,
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_models WHERE id = ANY($1) ORDER BY id`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        let migrated = 0;
        let quarantined = 0;
        for (const model of rows) {
          const artifactId = await getOrCreateArtifact(client, {
            organizationId: org,
            artifactType: 'BASELINE_MODEL',
            naturalKey: `financial_models:${model.id}`,
          });

          const historyRows = (
            await client.query(`SELECT id, version, snapshot_data FROM financial_model_versions WHERE model_id = $1 ORDER BY version ASC`, [model.id])
          ).rows as Array<{ id: string; version: number; snapshot_data: string }>;

          // Detect duplicate version numbers -> quarantine every row sharing that version number.
          const byVersion = new Map<number, Array<{ id: string; version: number; snapshot_data: string }>>();
          for (const h of historyRows) {
            if (!byVersion.has(h.version)) byVersion.set(h.version, []);
            byVersion.get(h.version)!.push(h);
          }
          const cleanVersions: number[] = [];
          for (const [v, group] of byVersion) {
            if (group.length > 1) {
              for (const g of group) {
                await logQuarantine(client, {
                  runBatch: ctx.runBatch,
                  phase: 'models',
                  legacyTable: 'financial_model_versions',
                  legacyId: g.id,
                  legacyVersion: String(v),
                  organizationId: org,
                  reasonCode: 'DUPLICATE_VERSION_NUMBER',
                  detail: { model_id: model.id, version: v, sibling_count: group.length },
                });
                quarantined++;
              }
            } else {
              cleanVersions.push(v);
            }
          }
          // Ensure the model's own "current" version number is represented even if it has no
          // financial_model_versions row (common — the version bump on approve doesn't always
          // snapshot).
          if (!cleanVersions.includes(model.version) && !byVersion.has(model.version)) {
            cleanVersions.push(model.version);
          }
          cleanVersions.sort((a, b) => a - b);

          let parentBvId: string | null = null;
          let currentBvId: string | null = null;
          for (let i = 0; i < cleanVersions.length; i++) {
            const v = cleanVersions[i];
            const isCurrent = i === cleanVersions.length - 1;
            const historyRow = byVersion.get(v)?.[0];
            // Non-current (older) versions are always inserted as DRAFT and immediately flipped to
            // SUPERSEDED right after insert (see the `parentBvId` UPDATE below) — this mirrors real
            // "reopen creates vN+1, vN becomes SUPERSEDED" semantics instead of fabricating a fake
            // APPROVED history for old snapshots. `targetStatus` below only matters for the current
            // (latest) version.
            let targetStatus: TargetStatus = 'DRAFT';
            let rowQuarantinedInstead = false;
            if (!isCurrent) {
              // no-op — targetStatus stays 'DRAFT', see comment above.
            } else if (model.status === 'archived') {
              targetStatus = 'ARCHIVED';
            } else if (model.status === 'approved') {
              if (!model.approved_snapshot) {
                // Gate A finding: "Approved without snapshot" must never enter canonical as APPROVED.
                await logQuarantine(client, {
                  runBatch: ctx.runBatch,
                  phase: 'models',
                  legacyTable: 'financial_models',
                  legacyId: model.id,
                  legacyVersion: String(v),
                  organizationId: org,
                  reasonCode: 'APPROVED_WITHOUT_SNAPSHOT',
                  detail: { model_id: model.id, version: v },
                });
                quarantined++;
                rowQuarantinedInstead = true;
              } else {
                targetStatus = 'APPROVED';
              }
            } else if (model.status === 'review') {
              targetStatus = 'IN_REVIEW';
            } else {
              targetStatus = 'DRAFT';
            }

            if (rowQuarantinedInstead) continue;

            const contentHash = sha256({
              t: 'financial_models',
              id: model.id,
              version: v,
              snapshot: historyRow?.snapshot_data ?? model.approved_snapshot ?? null,
            });
            // Insert as DRAFT first for non-current rows so the immutability trigger's "cannot
            // APPROVE without compute_snapshot_id" never blocks a purely-historical row; the
            // superseding logic in createBusinessVersion flips status to SUPERSEDED once the next
            // version exists (this mirrors real "reopen creates vN+1, vN becomes SUPERSEDED"
            // semantics rather than fabricating a fake APPROVED history for old snapshots).
            const bvId = await createBusinessVersion(client, {
              artifactId,
              organizationId: org,
              versionNo: v,
              status: isCurrent ? targetStatus : 'DRAFT',
              contentHash,
              parentVersionId: parentBvId,
            });
            // `financial_model_versions` and `financial_models` are two DISTINCT legacy tables, each
            // with its own row count that the equation check (`verify`) accounts for independently.
            // A history row (when one exists for this version_no) always gets its own alias.
            // Additionally, the CURRENT version_no always also gets an alias crediting the
            // top-level `financial_models` row itself (its "live" id) — even when a
            // financial_model_versions row happens to share the same version_no — otherwise the
            // live row would never be represented in the equation for its own table (this was a
            // real bug caught by the equation check on `valuations`, same shape as this table; see
            // migration report §5).
            if (historyRow) {
              await insertAlias(client, {
                legacyTable: 'financial_model_versions',
                legacyId: String(historyRow.id),
                legacyVersion: String(v),
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('financial_model_versions')!.classification,
                mappingReason: isCurrent ? `current_version;model_status=${model.status}` : 'superseded_by_next_version',
              });
              migrated++;
            }
            if (isCurrent) {
              await insertAlias(client, {
                legacyTable: 'financial_models',
                legacyId: String(model.id),
                legacyVersion: String(v),
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('financial_models')!.classification,
                mappingReason: `current_version;model_status=${model.status}`,
              });
              migrated++;
            }
            parentBvId = bvId;
            if (isCurrent) currentBvId = bvId;
          }

          modelArtifacts.set(model.id, { artifactId, organizationId: org, currentBusinessVersionId: currentBvId });
        }
        return { migrated, quarantined, excluded: 0 };
      },
    });
  }
  return modelArtifacts;
}

// ---------------------------------------------------------------------------------------------
// PHASE 4 — Prediction (ORCH-DEC-001: decisional financial_model_events -> new PREDICTION_SCENARIO)
// ---------------------------------------------------------------------------------------------

const DECISIONAL_EVENT_TYPES = new Set(['debt_drawdown', 'debt_repayment', 'equity_injection', 'dividend']);

async function phasePrediction(pool: Pool, ctx: RunCtx, modelArtifacts: Map<string, ModelArtifactInfo>) {
  const orgs = await allOrgIds(pool);
  // financial_model_events has no organization_id column (WP-A01: org-scoped only via model_id
  // join) — chunk by (org via model join, event id).
  for (const org of orgs) {
    const evRes = await pool.query(
      `SELECT e.id FROM financial_model_events e JOIN financial_models m ON m.id = e.model_id
       WHERE m.organization_id = $1 ORDER BY e.id`,
      [org]
    );
    const ids = evRes.rows.map((r) => r.id);
    if (!ids.length) continue;

    // Duplicate-decisional-event detection MUST be scoped to the whole model's event set, not to
    // whatever happens to land in one chunk — a model's events can straddle a chunk boundary (this
    // was a real bug caught while validating this script: two exact-duplicate `debt_repayment`
    // events landed in different chunks and the duplicate was silently missed). Precompute the
    // dedup-key -> count map for every model in this org ONCE, before chunking, so the classification
    // decision for a given event is identical no matter which chunk it lands in or whether this is a
    // fresh run or a resumed one.
    const dupKeyRes = await pool.query(
      `SELECT e.model_id, e.event_type, e.period_start, e.amount, count(*)::int AS c
       FROM financial_model_events e JOIN financial_models m ON m.id = e.model_id
       WHERE m.organization_id = $1 AND e.event_type = ANY($2)
       GROUP BY e.model_id, e.event_type, e.period_start, e.amount`,
      [org, [...DECISIONAL_EVENT_TYPES]]
    );
    const dupKeyCounts = new Map<string, number>();
    for (const r of dupKeyRes.rows) {
      dupKeyCounts.set(`${r.model_id}|${r.event_type}|${r.period_start.toISOString?.() ?? r.period_start}|${r.amount}`, r.c);
    }

    await runChunked(pool, {
      phase: 'prediction',
      legacyTable: 'financial_model_events',
      organizationId: org,
      ids,
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM financial_model_events WHERE id = ANY($1) ORDER BY id`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        let migrated = 0;
        let quarantined = 0;

        const byModel = new Map<string, Array<Record<string, unknown>>>();
        for (const e of rows) {
          const mid = String(e.model_id);
          if (!byModel.has(mid)) byModel.set(mid, []);
          byModel.get(mid)!.push(e);
        }

        for (const [modelId, events] of byModel) {
          const modelInfo = modelArtifacts.get(modelId);

          const unambiguous: Array<Record<string, unknown>> = [];
          for (const e of events) {
            const etype = String(e.event_type);
            if (!DECISIONAL_EVENT_TYPES.has(etype)) {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'prediction',
                legacyTable: 'financial_model_events',
                legacyId: String(e.id),
                organizationId: org,
                reasonCode: 'EVENT_ONLY_BASELINE_ARCHITECTURE',
                detail: { model_id: modelId, event_type: etype },
              });
              quarantined++;
              continue;
            }
            const amount = Number(e.amount);
            const periodKey = e.period_start instanceof Date ? e.period_start.toISOString() : String(e.period_start);
            const key = `${modelId}|${etype}|${periodKey}|${e.amount}`;
            const isDuplicate = (dupKeyCounts.get(key) ?? 0) > 1;
            if (amount === 0) {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'prediction',
                legacyTable: 'financial_model_events',
                legacyId: String(e.id),
                organizationId: org,
                reasonCode: 'AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT',
                detail: { model_id: modelId, event_type: etype },
              });
              quarantined++;
            } else if (isDuplicate) {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'prediction',
                legacyTable: 'financial_model_events',
                legacyId: String(e.id),
                organizationId: org,
                reasonCode: 'AMBIGUOUS_DECISION_EVENT_DUPLICATE',
                detail: { model_id: modelId, event_type: etype, dedup_key: key },
              });
              quarantined++;
            } else {
              unambiguous.push(e);
            }
          }

          if (!unambiguous.length) continue;
          if (!modelInfo) {
            // Model itself wasn't migrated (shouldn't happen given phase ordering, but fail safe
            // rather than silently drop).
            for (const e of unambiguous) {
              await logQuarantine(client, {
                runBatch: ctx.runBatch,
                phase: 'prediction',
                legacyTable: 'financial_model_events',
                legacyId: String(e.id),
                organizationId: org,
                reasonCode: 'SOURCE_MODEL_NOT_MIGRATED',
                detail: { model_id: modelId },
              });
              quarantined++;
            }
            continue;
          }

          const predictionArtifactId = await getOrCreateArtifact(client, {
            organizationId: org,
            artifactType: 'PREDICTION_SCENARIO',
            naturalKey: `financial_model_events:${modelId}:legacy-decision-events`,
          });
          const contentHash = sha256({
            t: 'financial_model_events_prediction',
            model_id: modelId,
            events: unambiguous.map((e) => ({ id: e.id, type: e.event_type, amount: e.amount, period: e.period_start })),
          });
          // Idempotent: if this artifact already has a version (resume case where the artifact was
          // created but the process crashed before all aliases landed — impossible within one
          // chunk/transaction, but defensive for reruns across chunks touching the same model from
          // a different org bucket), reuse it instead of creating a second APPROVED version.
          const existingBv = await client.query(
            `SELECT business_version_id FROM finance_business_versions WHERE artifact_id = $1 ORDER BY version_no DESC LIMIT 1`,
            [predictionArtifactId]
          );
          let bvId: string;
          if (existingBv.rows[0]) {
            bvId = existingBv.rows[0].business_version_id;
          } else {
            bvId = await createBusinessVersion(client, {
              artifactId: predictionArtifactId,
              organizationId: org,
              versionNo: 1,
              status: 'APPROVED',
              contentHash,
            });
            // Lineage: Baseline Model -> Prediction Scenario (this migration's derivation).
            if (modelInfo.currentBusinessVersionId) {
              await client.query(
                `INSERT INTO finance_lineage_edges
                   (organization_id, source_version_id, source_artifact_type, target_version_id, target_artifact_type,
                    edge_type, transformation_kind, assumption_snapshot_hash, author_id)
                 VALUES ($1,$2,'BASELINE_MODEL',$3,'PREDICTION_SCENARIO','MODEL_TO_SCENARIO','MANUAL_LINK',$4,$5)
                 ON CONFLICT (source_version_id, target_version_id, edge_type) DO NOTHING`,
                [org, modelInfo.currentBusinessVersionId, bvId, contentHash, ACTOR]
              );
            }
          }
          for (const e of unambiguous) {
            await insertAlias(client, {
              legacyTable: 'financial_model_events',
              legacyId: String(e.id),
              artifactId: predictionArtifactId,
              organizationId: org,
              businessVersionId: bvId,
              mappingConfidence: 'MIGRATE_WITH_WARNING',
              mappingReason: `ORCH-DEC-001;source=migrated_legacy_event;event_type=${e.event_type};amount=${e.amount};period=${e.period_start};model_id=${modelId}`,
            });
            migrated++;
          }
        }
        return { migrated, quarantined, excluded: 0 };
      },
    });
  }
}

// ---------------------------------------------------------------------------------------------
// PHASE 5 — Valuation
// ---------------------------------------------------------------------------------------------

async function phaseValuation(pool: Pool, ctx: RunCtx, modelArtifacts: Map<string, ModelArtifactInfo>): Promise<Map<string, ModelArtifactInfo>> {
  const valuationArtifacts = new Map<string, ModelArtifactInfo>();
  const orgs = await allOrgIds(pool);
  for (const org of orgs) {
    const ids = await sortedIds(pool, 'valuations', 'organization_id', org);
    await runChunked(pool, {
      phase: 'valuation',
      legacyTable: 'valuations',
      organizationId: org,
      ids,
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: (client, chunkIds) =>
        client.query(`SELECT * FROM valuations WHERE id = ANY($1) ORDER BY id`, [chunkIds]).then((r) => r.rows),
      processChunk: async (client, rows) => {
        let migrated = 0;
        let quarantined = 0;
        for (const val of rows) {
          const artifactId = await getOrCreateArtifact(client, {
            organizationId: org,
            artifactType: 'VALUATION_CASE',
            naturalKey: `valuations:${val.id}`,
          });

          const historyRows = (
            await client.query(`SELECT id, version, snapshot_data FROM valuation_snapshots WHERE valuation_id = $1 ORDER BY version ASC`, [val.id])
          ).rows as Array<{ id: string; version: number; snapshot_data: unknown }>;
          const byVersion = new Map<number, typeof historyRows>();
          for (const h of historyRows) {
            if (!byVersion.has(h.version)) byVersion.set(h.version, []);
            byVersion.get(h.version)!.push(h);
          }
          const cleanVersions: number[] = [];
          for (const [v, group] of byVersion) {
            if (group.length > 1) {
              for (const g of group) {
                await logQuarantine(client, {
                  runBatch: ctx.runBatch,
                  phase: 'valuation',
                  legacyTable: 'valuation_snapshots',
                  legacyId: g.id,
                  legacyVersion: String(v),
                  organizationId: org,
                  reasonCode: 'DUPLICATE_VERSION_NUMBER',
                  detail: { valuation_id: val.id, version: v, sibling_count: group.length },
                });
                quarantined++;
              }
            } else {
              cleanVersions.push(v);
            }
          }
          if (!cleanVersions.includes(val.version) && !byVersion.has(val.version)) cleanVersions.push(val.version);
          cleanVersions.sort((a, b) => a - b);

          let parentBvId: string | null = null;
          let currentBvId: string | null = null;
          for (let i = 0; i < cleanVersions.length; i++) {
            const v = cleanVersions[i];
            const isCurrent = i === cleanVersions.length - 1;
            const historyRow = byVersion.get(v)?.[0];
            let targetStatus: TargetStatus = 'DRAFT';
            if (isCurrent) {
              targetStatus = val.status === 'APPROVED' ? 'APPROVED' : val.status === 'REVIEW' ? 'IN_REVIEW' : 'DRAFT';
            }
            const contentHash = sha256({ t: 'valuations', id: val.id, version: v, snapshot: historyRow?.snapshot_data ?? null });
            const bvId = await createBusinessVersion(client, {
              artifactId,
              organizationId: org,
              versionNo: v,
              status: isCurrent ? targetStatus : 'DRAFT',
              contentHash,
              parentVersionId: parentBvId,
            });
            // Same distinct-legacy-table attribution as the Models phase (see its comment): a
            // `valuation_snapshots` history row and the top-level `valuations` row are two
            // different legacy tables/row counts, both credited independently.
            if (historyRow) {
              await insertAlias(client, {
                legacyTable: 'valuation_snapshots',
                legacyId: String(historyRow.id),
                legacyVersion: String(v),
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('valuation_snapshots')!.classification,
                mappingReason: isCurrent ? `current_version;valuation_status=${val.status}` : 'superseded_by_next_version',
              });
              migrated++;
            }
            if (isCurrent) {
              await insertAlias(client, {
                legacyTable: 'valuations',
                legacyId: String(val.id),
                legacyVersion: String(v),
                artifactId,
                organizationId: org,
                businessVersionId: bvId,
                mappingConfidence: ctx.classification.get('valuations')!.classification,
                mappingReason: `current_version;valuation_status=${val.status}`,
              });
              migrated++;
            }
            parentBvId = bvId;
            if (isCurrent) currentBvId = bvId;
          }

          valuationArtifacts.set(val.id, { artifactId, organizationId: org, currentBusinessVersionId: currentBvId });

          // Lineage: source financial_model -> this valuation, when resolvable.
          if (val.source_type === 'financial_model' && val.source_id && currentBvId) {
            const srcModel = modelArtifacts.get(String(val.source_id));
            if (srcModel?.currentBusinessVersionId) {
              const hash = sha256({ t: 'valuation_lineage', valuation_id: val.id, model_id: val.source_id });
              await client.query(
                `INSERT INTO finance_lineage_edges
                   (organization_id, source_version_id, source_artifact_type, target_version_id, target_artifact_type,
                    edge_type, transformation_kind, assumption_snapshot_hash, author_id)
                 VALUES ($1,$2,'BASELINE_MODEL',$3,'VALUATION_CASE','MODEL_TO_VALUATION','MANUAL_LINK',$4,$5)
                 ON CONFLICT (source_version_id, target_version_id, edge_type) DO NOTHING`,
                [org, srcModel.currentBusinessVersionId, currentBvId, hash, ACTOR]
              );
            }
          }
        }
        return { migrated, quarantined, excluded: 0 };
      },
    });
  }
  return valuationArtifacts;
}

// ---------------------------------------------------------------------------------------------
// PHASE 6 — Exports (terminal stage: one demonstration export per org with an APPROVED Valuation)
// ---------------------------------------------------------------------------------------------

async function phaseExports(pool: Pool, ctx: RunCtx, valuationArtifacts: Map<string, ModelArtifactInfo>) {
  const orgs = await allOrgIds(pool);
  for (const org of orgs) {
    const approved = [...valuationArtifacts.values()].find(
      (v) => v.organizationId === org && v.currentBusinessVersionId
    );
    if (!approved) continue;
    const bv = await pool.query(`SELECT status FROM finance_business_versions WHERE business_version_id = $1`, [
      approved.currentBusinessVersionId,
    ]);
    if (bv.rows[0]?.status !== 'APPROVED') continue;

    await runChunked(pool, {
      phase: 'exports',
      legacyTable: 'synthetic:export_manifest',
      organizationId: org,
      ids: [org], // single synthetic "row" per org
      chunkSize: ctx.chunkSize,
      runBatch: ctx.runBatch,
      resume: ctx.resume,
      crashState: ctx.crashState,
      fetchRows: async () => [{ id: org }],
      processChunk: async (client) => {
        const hash = sha256({ t: 'export', org, bv: approved.currentBusinessVersionId });
        const res = await client.query(
          `INSERT INTO finance_export_manifests
             (organization_id, export_format, status, primary_artifact_id, primary_business_version_id,
              locale, timezone, unit, as_of, rounding_convention_used, content_semantic_hash,
              file_hash_sha256, storage_object_key, generated_by, generated_at)
           VALUES ($1,'PDF','READY',$2,$3,'pl-PL','Europe/Warsaw','PLN',now(),'BANKERS_ROUNDING_2DP',$4,$5,$6,$7,now())
           RETURNING export_manifest_id`,
          [org, approved.artifactId, approved.currentBusinessVersionId, hash, hash, `s3://dry-run/${hash}.pdf`, ACTOR]
        );
        const manifestId = res.rows[0].export_manifest_id;
        await client.query(
          `INSERT INTO finance_export_manifest_sources (export_manifest_id, business_version_id, role)
           VALUES ($1,$2,'PRIMARY') ON CONFLICT DO NOTHING`,
          [manifestId, approved.currentBusinessVersionId]
        );
        return { migrated: 1, quarantined: 0, excluded: 0 };
      },
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------------------

type RunCtx = {
  classification: Map<string, { classification: MappingConfidence; reason: string }>;
  chunkSize: number;
  runBatch: string;
  resume: boolean;
  crashState: { remaining: number };
};

async function allOrgIds(pool: Pool): Promise<string[]> {
  const res = await pool.query(`SELECT id FROM organizations WHERE id LIKE 'org-fv3-%' AND id NOT LIKE '%ghost%' ORDER BY id`);
  return res.rows.map((r) => r.id);
}

async function runBackfill(pool: Pool, opts: { chunkSize: number; runBatch: string; resume: boolean; crashAfter: number }) {
  const classification = await loadClassification();
  const ctx: RunCtx = {
    classification,
    chunkSize: opts.chunkSize,
    runBatch: opts.runBatch,
    resume: opts.resume,
    crashState: { remaining: opts.crashAfter > 0 ? opts.crashAfter : Number.POSITIVE_INFINITY },
  };

  console.log(`\n=== PHASE 1: Statements (run_batch=${opts.runBatch}, resume=${opts.resume}) ===`);
  await phaseStatements(pool, ctx);

  console.log('=== PHASE 2: Analysis ===');
  await phaseAnalysis(pool, ctx);

  console.log('=== PHASE 3: Models (Baseline) ===');
  const modelArtifacts = await rebuildModelArtifactMap(pool, await phaseModels(pool, ctx));

  console.log('=== PHASE 4: Prediction (ORCH-DEC-001) ===');
  await phasePrediction(pool, ctx, modelArtifacts);

  console.log('=== PHASE 5: Valuation ===');
  const valuationArtifacts = await phaseValuation(pool, ctx, modelArtifacts);

  console.log('=== PHASE 6: Exports ===');
  await phaseExports(pool, ctx, valuationArtifacts);

  console.log('\nBackfill run complete (no crash-after limit hit).');
}

/** No-op passthrough kept for clarity at call sites; phaseModels already returns the map. */
async function rebuildModelArtifactMap(_pool: Pool, map: Map<string, ModelArtifactInfo>) {
  return map;
}

// ---------------------------------------------------------------------------------------------
// VERIFY — equation check (input = migrated + quarantined + excluded) + checksum/resume summary
// ---------------------------------------------------------------------------------------------

async function verify(pool: Pool) {
  const sourceCounts: Record<string, number> = {};
  const tables = [
    'financial_statement_packs',
    'financial_statements',
    'financial_statement_values',
    'financial_statement_versions',
    'financial_analyses',
    'analysis_financials',
    'initiative_financials',
    'financial_models',
    'financial_model_versions',
    'financial_model_events',
    'valuations',
    'valuation_snapshots',
  ];
  for (const t of tables) {
    const res = await pool.query(`SELECT count(*)::int AS c FROM ${t}`);
    sourceCounts[t] = res.rows[0].c;
  }

  const migratedRes = await pool.query(
    `SELECT legacy_table, count(*)::int AS c FROM finance_artifact_aliases
     WHERE mapping_confidence IN ('AUTO_MIGRATE','MIGRATE_WITH_WARNING') GROUP BY legacy_table`
  );
  const quarantinedAliasRes = await pool.query(
    `SELECT legacy_table, count(*)::int AS c FROM finance_artifact_aliases WHERE mapping_confidence = 'QUARANTINE' GROUP BY legacy_table`
  );
  const quarantinedLogRes = await pool.query(
    `SELECT legacy_table, count(*)::int AS c FROM finance_v3_backfill_quarantine_log GROUP BY legacy_table`
  );
  const excludedRes = await pool.query(
    `SELECT legacy_table, count(*)::int AS c FROM finance_v3_backfill_excluded_log GROUP BY legacy_table`
  );

  const toMap = (rows: Array<{ legacy_table: string; c: number }>) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.legacy_table, (m.get(r.legacy_table) ?? 0) + r.c);
    return m;
  };
  const migrated = toMap(migratedRes.rows);
  const quarantined = toMap(quarantinedAliasRes.rows);
  const quarantinedLog = toMap(quarantinedLogRes.rows);
  const excluded = toMap(excludedRes.rows);

  console.log('\n=== EQUATION CHECK: input = migrated + quarantined + excluded ===');
  let allOk = true;
  const rowsOut: Array<Record<string, unknown>> = [];
  for (const t of tables) {
    const total = sourceCounts[t] ?? 0;
    const mig = migrated.get(t) ?? 0;
    const qua = (quarantined.get(t) ?? 0) + (quarantinedLog.get(t) ?? 0);
    const exc = excluded.get(t) ?? 0;
    const sum = mig + qua + exc;
    const ok = sum === total;
    allOk = allOk && ok;
    rowsOut.push({ table: t, total, migrated: mig, quarantined: qua, excluded: exc, sum, ok });
  }
  console.table(rowsOut);
  console.log(allOk ? '✅ Equation holds for every source table.' : '❌ Equation MISMATCH — see table above.');

  // Duplicate-alias check (belt-and-suspenders on top of the UNIQUE constraint).
  const dupRes = await pool.query(`
    SELECT legacy_table, legacy_id, legacy_version, count(*) AS c
    FROM finance_artifact_aliases GROUP BY 1,2,3 HAVING count(*) > 1
  `);
  console.log(`\nDuplicate alias rows (should be 0): ${dupRes.rows.length}`);

  // Checkpoint / resume timeline.
  const checkpointRes = await pool.query(`
    SELECT run_batch, phase, legacy_table, organization_id, chunk_index, status, migrated_count,
           quarantined_count, excluded_count, duration_ms, finished_at
    FROM finance_v3_backfill_checkpoints ORDER BY finished_at ASC
  `);
  const totalChunks = checkpointRes.rows.length;
  const doneChunks = checkpointRes.rows.filter((r) => r.status === 'done').length;
  const runBatches = new Set(checkpointRes.rows.map((r) => r.run_batch));
  console.log(`\n=== CHECKPOINT / RESUME SUMMARY ===`);
  console.log(`Total chunks recorded: ${totalChunks}, done: ${doneChunks}, distinct run_batch values: ${[...runBatches].join(', ')}`);
  if (checkpointRes.rows.length) {
    const first = checkpointRes.rows[0];
    const last = checkpointRes.rows[checkpointRes.rows.length - 1];
    console.log(`First chunk finished: ${first.finished_at} (${first.phase}/${first.legacy_table})`);
    console.log(`Last chunk finished:  ${last.finished_at} (${last.phase}/${last.legacy_table})`);
  }
  const checksumMismatch = await pool.query(
    `SELECT count(*)::int AS c FROM finance_v3_backfill_checkpoints WHERE source_checksum_before IS DISTINCT FROM source_checksum_after`
  );
  console.log(`Chunks where source checksum changed during processing (should be 0): ${checksumMismatch.rows[0].c}`);

  const timing = await pool.query(`
    SELECT phase, count(*)::int AS chunks, sum(duration_ms)::int AS total_ms, avg(duration_ms)::int AS avg_ms, max(duration_ms)::int AS max_ms
    FROM finance_v3_backfill_checkpoints GROUP BY phase ORDER BY phase
  `);
  console.log('\n=== PER-PHASE TIMING ===');
  console.table(timing.rows);

  return { allOk, dupCount: dupRes.rows.length, checksumMismatch: checksumMismatch.rows[0].c, totalChunks, doneChunks };
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  const databaseUrl = (args['database-url'] as string) || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Refusing to run without an explicit --database-url or DATABASE_URL (must point at an ephemeral, single-purpose Postgres cluster).');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  // F-2 fix: `seed`/`run` both write; hold a dedicated, checked-out connection for the advisory
  // lock's whole lifetime so it stays on the SAME Postgres session (advisory locks are
  // session-scoped — acquiring on one pool connection and later calling pool.query() again,
  // which may hand back a DIFFERENT connection, would not see/release the same lock).
  // `verify` is read-only and does not need the lock.
  let lockClient: PoolClient | null = null;

  try {
    await ensureBookkeeping(pool);

    if (command === 'seed' || command === 'run') {
      lockClient = await pool.connect();
      try {
        await acquireBackfillLock(lockClient);
      } catch (err) {
        if (err instanceof BackfillLockHeldError) {
          console.error(`\n🔒 ${err.message}`);
          process.exitCode = 3; // distinct exit code for "lock held by another process", not a data/logic error
          return;
        }
        throw err;
      }
    }

    if (command === 'seed') {
      await seed(pool);
    } else if (command === 'run') {
      const chunkSize = num(args, 'chunk-size', 20);
      const crashAfter = num(args, 'crash-after', 0);
      const resume = Boolean(args.resume);
      const runBatch = (args['run-batch'] as string) || `batch-${Date.now()}`;
      try {
        await runBackfill(pool, { chunkSize, runBatch, resume, crashAfter });
      } catch (err) {
        if (err instanceof CrashRequested) {
          console.error(`\n💥 ${err.message}`);
          process.exitCode = 42; // distinct exit code for "simulated crash", not a real failure
          return;
        }
        throw err;
      }
    } else if (command === 'verify') {
      const result = await verify(pool);
      if (!result.allOk || result.dupCount > 0 || result.checksumMismatch > 0) {
        process.exitCode = 1;
      }
    } else {
      console.error('Usage: finance-v3-backfill-dry-run.ts <seed|run|verify> [--database-url ...] [--chunk-size N] [--crash-after N] [--resume] [--run-batch NAME]');
      process.exitCode = 2;
    }
  } finally {
    if (lockClient) {
      await releaseBackfillLock(lockClient);
      lockClient.release();
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
