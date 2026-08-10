#!/usr/bin/env tsx
/*
 * Finance v3 - W2 (FC-02.2): deterministic-backfill comparator.
 *
 * Compares the FULL content of every table the WP-C03 backfill dry-run script
 * (server/scripts/finance-v3-backfill-dry-run.ts) touches, across two databases (typically two
 * independent `seed` + `run` invocations against two fresh Postgres databases), or the same
 * database at two points in time (idempotency check: run backfill once, snapshot, run --resume
 * again, snapshot, diff the two snapshots via two separate invocations of this script pointed at
 * the same URL twice, with dumps taken in between by the caller).
 *
 * Why a naive "SELECT * ... ORDER BY id" diff does NOT work here (see
 * docs/validation/finance-v3/generated/gate-d/W2_BACKFILL_DETERMINISM_report.md section 3 for the
 * full writeup):
 *   1. Every canonical primary key in this schema is TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text
 *      (finance_artifacts.artifact_id, finance_business_versions.business_version_id,
 *      finance_working_revisions.working_revision_id, finance_compute_snapshots.compute_snapshot_id,
 *      finance_lineage_edges.id, finance_artifact_aliases.alias_id,
 *      finance_export_manifests.export_manifest_id) - these are NEVER equal across two independent
 *      runs, by design, and comparing them directly would make every run look "different" even
 *      when business content is identical.
 *   2. Every FK to one of those PKs (current_business_version_id, artifact_id, business_version_id,
 *      working_revision_id, compute_snapshot_id, parent_version_id, superseded_by_version_id,
 *      source_version_id/target_version_id, primary_artifact_id/primary_business_version_id, ...)
 *      inherits the same problem transitively.
 *   3. created_at/updated_at/approved_at/archived_at/superseded_at/edited_at/as_of/generated_at/
 *      finished_at/duration_ms and friends are wall-clock-derived (DEFAULT now() or Date.now()),
 *      and are legitimately different between two runs that started at different real-world
 *      instants - this is not a determinism bug, it is what a timestamp column is for.
 *   4. finance_export_manifests.content_semantic_hash / file_hash_sha256 / storage_object_key are
 *      computed by the dry-run script as sha256({t:'export', org, bv: <random business_version_id>})
 *      - i.e. hashed from the random UUID itself, not from any content-stable value. This is a real
 *      finding (documented in the W2 report as F-1, not fixed here - see report for scope/severity)
 *      and these three columns are EXCLUDED from the pass/fail comparison for that reason, not
 *      because they are legitimately variable in a well-designed system.
 *
 * Strategy: resolve every generated-UUID FK to the business key of the row it points to (the
 * legacy-derived natural_key for artifacts, (natural_key, version_no) for business versions,
 * (natural_key, revision_seq) for working revisions, engine_name for engine manifests) before
 * comparing, and exclude wall-clock/non-reproducible columns explicitly (listed per table below,
 * with reasons in comments). Everything else - every business-meaningful column - IS compared, and
 * a mismatch is reported with the exact key and the exact differing field(s), not just "not equal".
 *
 * Usage:
 *   tsx server/scripts/finance-v3-backfill-determinism-check.ts \
 *     --url-a postgresql://... --url-b postgresql://... [--label-a A] [--label-b B]
 */

import { Pool } from 'pg';

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

type Row = Record<string, unknown>;

function normalizeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v;
}

// Key parts are joined with a literal, visible separator (" | ") so that e.g. artifact key
// "org::financial_statement_packs:pack-1" + version_no 1 can never collide, in the printed key or
// in the underlying Map key, with a different artifact "org::financial_statement_packs:pack-11".
// (An earlier version of this script joined with '' and produced exactly that false-positive
// collision - see the W2 report section 3 for the full incident writeup: it looked like a
// determinism failure in finance_business_versions/finance_artifact_aliases/
// finance_export_manifests until traced back to this comparator bug, not the backfill.)
function stableKey(parts: Array<unknown>): string {
  return parts.map((p) => (p === null || p === undefined ? '(NULL)' : String(p))).join(' | ');
}

function diffRows(a: Row, b: Row): string[] {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  const diffs: string[] = [];
  for (const k of keys) {
    const av = normalizeValue(a[k]);
    const bv = normalizeValue(b[k]);
    const aStr = JSON.stringify(av);
    const bStr = JSON.stringify(bv);
    if (aStr !== bStr) diffs.push(k + ': ' + aStr + ' != ' + bStr);
  }
  return diffs;
}

interface TableReport {
  table: string;
  onlyInA: string[];
  onlyInB: string[];
  mismatched: Array<{ key: string; diffs: string[] }>;
  matched: number;
  totalA: number;
  totalB: number;
}

function compare(table: string, a: Map<string, Row>, b: Map<string, Row>): TableReport {
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const mismatched: Array<{ key: string; diffs: string[] }> = [];
  let matched = 0;
  for (const [k, rowA] of a) {
    const rowB = b.get(k);
    if (!rowB) {
      onlyInA.push(k);
      continue;
    }
    const diffs = diffRows(rowA, rowB);
    if (diffs.length > 0) mismatched.push({ key: k, diffs });
    else matched++;
  }
  for (const k of b.keys()) {
    if (!a.has(k)) onlyInB.push(k);
  }
  return { table, onlyInA, onlyInB, mismatched, matched, totalA: a.size, totalB: b.size };
}

// -------------------------------------------------------------------------------------------
// Business-key resolvers, built once per database.
// -------------------------------------------------------------------------------------------

interface Resolvers {
  artifactKeyById: Map<string, string>;
  versionKeyById: Map<string, string>;
  workingRevisionKeyById: Map<string, string>;
  engineNameById: Map<string, string>;
}

async function buildResolvers(pool: Pool): Promise<Resolvers> {
  const artifacts = await pool.query('SELECT artifact_id, organization_id, natural_key FROM finance_artifacts');
  const artifactKeyById = new Map<string, string>();
  for (const r of artifacts.rows) {
    artifactKeyById.set(r.artifact_id, r.organization_id + '::' + (r.natural_key ?? '(null-natural-key)'));
  }

  const versions = await pool.query(
    'SELECT bv.business_version_id, bv.version_no, bv.artifact_id FROM finance_business_versions bv'
  );
  const versionKeyById = new Map<string, string>();
  for (const r of versions.rows) {
    const artifactKey = artifactKeyById.get(r.artifact_id) ?? '(unknown-artifact:' + r.artifact_id + ')';
    versionKeyById.set(r.business_version_id, artifactKey + '#v' + r.version_no);
  }

  const revisions = await pool.query('SELECT working_revision_id, revision_seq, artifact_id FROM finance_working_revisions');
  const workingRevisionKeyById = new Map<string, string>();
  for (const r of revisions.rows) {
    const artifactKey = artifactKeyById.get(r.artifact_id) ?? '(unknown-artifact:' + r.artifact_id + ')';
    workingRevisionKeyById.set(r.working_revision_id, artifactKey + '#r' + r.revision_seq);
  }

  const engines = await pool.query('SELECT engine_manifest_id, engine_name FROM finance_engine_manifests');
  const engineNameById = new Map<string, string>();
  for (const r of engines.rows) engineNameById.set(r.engine_manifest_id, r.engine_name);

  return { artifactKeyById, versionKeyById, workingRevisionKeyById, engineNameById };
}

function remapArtifactId(r: Resolvers, id: unknown): unknown {
  if (id === null || id === undefined) return null;
  return r.artifactKeyById.get(String(id)) ?? '(unresolved-artifact:' + id + ')';
}
function remapVersionId(r: Resolvers, id: unknown): unknown {
  if (id === null || id === undefined) return null;
  return r.versionKeyById.get(String(id)) ?? '(unresolved-version:' + id + ')';
}
function remapEngineId(r: Resolvers, id: unknown): unknown {
  if (id === null || id === undefined) return null;
  return r.engineNameById.get(String(id)) ?? '(unresolved-engine:' + id + ')';
}

// -------------------------------------------------------------------------------------------
// Legacy (seed / source) tables - business key = the app-generated deterministic `id` string
// (e.g. "pack-3", "model-7"). Excluded: created_at/updated_at, the two DB-default audit
// timestamps every legacy table carries (DEFAULT now() / DEFAULT CURRENT_TIMESTAMP), which
// legitimately differ between two independent `seed` invocations run at different wall-clock
// instants - the row's business content (all other columns) is fixed-seed deterministic
// (see the mulberry32 PRNG and SEED_APPROVED_AT constant in finance-v3-backfill-dry-run.ts).
// -------------------------------------------------------------------------------------------

const LEGACY_TABLES = [
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

async function loadLegacyTable(pool: Pool, table: string): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM ' + table);
  const out = new Map<string, Row>();
  for (const row of res.rows) {
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (k === 'created_at' || k === 'updated_at') continue;
      rest[k] = row[k];
    }
    out.set(stableKey([row.id]), rest);
  }
  return out;
}

// -------------------------------------------------------------------------------------------
// Canonical tables.
// -------------------------------------------------------------------------------------------

async function loadFinanceArtifacts(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_artifacts');
  const out = new Map<string, Row>();
  for (const row of res.rows) {
    const key = stableKey([row.organization_id, row.natural_key]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (k === 'artifact_id' || k === 'created_at') continue;
      rest[k] = row[k];
    }
    rest.current_business_version_id = remapVersionId(r, row.current_business_version_id);
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceBusinessVersions(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_business_versions');
  const out = new Map<string, Row>();
  const excluded = new Set([
    'business_version_id', // own PK, random
    'artifact_id', // FK, random -> not part of rest, used only to build the key
    'created_at',
    'updated_at', // DEFAULT now() bookkeeping column, present on this table (verified via \d)
    'approved_at',
    'archived_at',
    'superseded_at',
    'submitted_at',
    'reopened_at',
    'immutable_since', // set to now() when a version becomes immutable; wall-clock
    'compute_snapshot_id', // FK, random; presence/absence handled separately below
    'parent_version_id', // FK, random -> remapped below
    'superseded_by_version_id', // FK, random -> remapped below
    'engine_manifest_id', // FK, random -> remapped below
    'source_working_revision_id', // FK, random; not populated by this dry run (NULL on both sides) but excluded defensively
  ]);
  for (const row of res.rows) {
    const artifactKey = r.artifactKeyById.get(String(row.artifact_id)) ?? '(unresolved-artifact:' + row.artifact_id + ')';
    const key = stableKey([artifactKey, row.version_no]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    rest.compute_snapshot_id_present = row.compute_snapshot_id != null; // business-meaningful: was a compute chain created
    rest.parent_version_id = remapVersionId(r, row.parent_version_id);
    rest.superseded_by_version_id = remapVersionId(r, row.superseded_by_version_id);
    rest.engine_manifest_id = remapEngineId(r, row.engine_manifest_id);
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceArtifactAliases(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_artifact_aliases');
  const out = new Map<string, Row>();
  const excluded = new Set(['alias_id', 'artifact_id', 'business_version_id', 'created_at', 'run_batch']);
  for (const row of res.rows) {
    const key = stableKey([row.legacy_table, row.legacy_id, row.legacy_version]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    rest.artifact_id = remapArtifactId(r, row.artifact_id);
    rest.business_version_id = remapVersionId(r, row.business_version_id);
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceLineageEdges(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_lineage_edges');
  const out = new Map<string, Row>();
  const excluded = new Set(['id', 'source_version_id', 'target_version_id', 'created_at']);
  for (const row of res.rows) {
    const sourceKey = r.versionKeyById.get(String(row.source_version_id)) ?? '(unresolved-version:' + row.source_version_id + ')';
    const targetKey = r.versionKeyById.get(String(row.target_version_id)) ?? '(unresolved-version:' + row.target_version_id + ')';
    const key = stableKey([sourceKey, targetKey, row.edge_type]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    rest.source_version_id = sourceKey;
    rest.target_version_id = targetKey;
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceWorkingRevisions(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_working_revisions');
  const out = new Map<string, Row>();
  const excluded = new Set(['working_revision_id', 'artifact_id', 'business_version_id', 'source_business_version_id', 'edited_at']);
  for (const row of res.rows) {
    const artifactKey = r.artifactKeyById.get(String(row.artifact_id)) ?? '(unresolved-artifact:' + row.artifact_id + ')';
    const key = stableKey([artifactKey, row.revision_seq]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    rest.business_version_id = remapVersionId(r, row.business_version_id);
    rest.source_business_version_id = remapVersionId(r, row.source_business_version_id);
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceComputeSnapshots(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_compute_snapshots');
  const out = new Map<string, Row>();
  const excluded = new Set(['compute_snapshot_id', 'artifact_id', 'working_revision_id', 'engine_manifest_id', 'as_of', 'created_at']);
  for (const row of res.rows) {
    const artifactKey = r.artifactKeyById.get(String(row.artifact_id)) ?? '(unresolved-artifact:' + row.artifact_id + ')';
    const wr = r.workingRevisionKeyById.get(String(row.working_revision_id)) ?? '(unresolved-revision:' + row.working_revision_id + ')';
    const key = stableKey([artifactKey, wr]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    rest.engine_manifest_id = remapEngineId(r, row.engine_manifest_id);
    out.set(key, rest);
  }
  return out;
}

async function loadFinanceExportManifests(pool: Pool, r: Resolvers): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_export_manifests');
  const out = new Map<string, Row>();
  const excluded = new Set([
    'export_manifest_id',
    'primary_artifact_id',
    'primary_business_version_id',
    'as_of',
    'created_at',
    'expires_at',
    'generated_at', // wall-clock
    // F-1 (see file header + W2 report): these three are sha256(random business_version_id),
    // not a hash of actual content - excluded from the pass/fail check because the *current*
    // implementation makes them non-reproducible by construction, not because reproducibility
    // doesn't matter for an export-manifest hash (it is the entire point of this table per
    // WP-B06 "reproducibility_retention_export" - this is flagged as a real finding, not waved
    // away).
    'content_semantic_hash',
    'file_hash_sha256',
    'storage_object_key',
  ]);
  for (const row of res.rows) {
    const artifactKey = remapArtifactId(r, row.primary_artifact_id);
    const versionKey = remapVersionId(r, row.primary_business_version_id);
    const key = stableKey([artifactKey, versionKey, row.export_format]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    out.set(key, rest);
  }
  return out;
}

async function loadCheckpoints(pool: Pool): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_v3_backfill_checkpoints');
  const out = new Map<string, Row>();
  const excluded = new Set(['run_batch', 'started_at', 'finished_at', 'duration_ms', 'source_checksum_before', 'source_checksum_after']);
  for (const row of res.rows) {
    const key = stableKey([row.phase, row.legacy_table, row.organization_id, row.chunk_index]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    out.set(key, rest);
  }
  return out;
}

async function loadQuarantineLog(pool: Pool): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_v3_backfill_quarantine_log');
  const out = new Map<string, Row>();
  const excluded = new Set(['id', 'run_batch', 'created_at']);
  for (const row of res.rows) {
    const key = stableKey([row.legacy_table, row.legacy_id, row.legacy_version]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    out.set(key, rest);
  }
  return out;
}

async function loadExcludedLog(pool: Pool): Promise<Map<string, Row>> {
  const res = await pool.query('SELECT * FROM finance_v3_backfill_excluded_log');
  const out = new Map<string, Row>();
  const excluded = new Set(['id', 'run_batch', 'created_at']);
  for (const row of res.rows) {
    const key = stableKey([row.legacy_table, row.legacy_id]);
    const rest: Row = {};
    for (const k of Object.keys(row)) {
      if (excluded.has(k)) continue;
      rest[k] = row[k];
    }
    out.set(key, rest);
  }
  return out;
}

// -------------------------------------------------------------------------------------------
// main
// -------------------------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const urlA = arg(argv, 'url-a') || process.env.DATABASE_URL_A;
  const urlB = arg(argv, 'url-b') || process.env.DATABASE_URL_B;
  const labelA = arg(argv, 'label-a') || 'A';
  const labelB = arg(argv, 'label-b') || 'B';
  if (!urlA || !urlB) {
    console.error('Usage: --url-a <postgres-url> --url-b <postgres-url> [--label-a NAME] [--label-b NAME]');
    process.exit(2);
  }

  const poolA = new Pool({ connectionString: urlA });
  const poolB = new Pool({ connectionString: urlB });

  const reports: TableReport[] = [];
  try {
    const [resolversA, resolversB] = await Promise.all([buildResolvers(poolA), buildResolvers(poolB)]);

    for (const t of LEGACY_TABLES) {
      const [a, b] = await Promise.all([loadLegacyTable(poolA, t), loadLegacyTable(poolB, t)]);
      reports.push(compare(t, a, b));
    }

    const canonicalLoaders: Array<[string, (pool: Pool, r: Resolvers) => Promise<Map<string, Row>>]> = [
      ['finance_artifacts', loadFinanceArtifacts],
      ['finance_business_versions', loadFinanceBusinessVersions],
      ['finance_artifact_aliases', loadFinanceArtifactAliases],
      ['finance_lineage_edges', loadFinanceLineageEdges],
      ['finance_working_revisions', loadFinanceWorkingRevisions],
      ['finance_compute_snapshots', loadFinanceComputeSnapshots],
      ['finance_export_manifests', loadFinanceExportManifests],
    ];
    for (const [name, loader] of canonicalLoaders) {
      const [a, b] = await Promise.all([loader(poolA, resolversA), loader(poolB, resolversB)]);
      reports.push(compare(name, a, b));
    }

    const [ckA, ckB] = await Promise.all([loadCheckpoints(poolA), loadCheckpoints(poolB)]);
    reports.push(compare('finance_v3_backfill_checkpoints', ckA, ckB));
    const [qA, qB] = await Promise.all([loadQuarantineLog(poolA), loadQuarantineLog(poolB)]);
    reports.push(compare('finance_v3_backfill_quarantine_log', qA, qB));
    const [eA, eB] = await Promise.all([loadExcludedLog(poolA), loadExcludedLog(poolB)]);
    reports.push(compare('finance_v3_backfill_excluded_log', eA, eB));
  } finally {
    await poolA.end();
    await poolB.end();
  }

  console.log('\n=== Determinism comparison: ' + labelA + ' vs ' + labelB + ' ===\n');
  let anyMismatch = false;
  for (const r of reports) {
    const ok = r.onlyInA.length === 0 && r.onlyInB.length === 0 && r.mismatched.length === 0;
    if (!ok) anyMismatch = true;
    console.log(
      (ok ? 'OK  ' : 'FAIL') + ' ' + r.table + ': totalA=' + r.totalA + ' totalB=' + r.totalB +
        ' matched=' + r.matched + ' onlyInA=' + r.onlyInA.length + ' onlyInB=' + r.onlyInB.length +
        ' mismatched=' + r.mismatched.length
    );
    if (!ok) {
      for (const k of r.onlyInA.slice(0, 10)) console.log('    only in ' + labelA + ': ' + k);
      for (const k of r.onlyInB.slice(0, 10)) console.log('    only in ' + labelB + ': ' + k);
      for (const m of r.mismatched.slice(0, 15)) {
        console.log('    MISMATCH key=' + m.key);
        for (const d of m.diffs) console.log('      ' + d);
      }
    }
  }
  console.log(
    '\n' +
      (anyMismatch
        ? 'FAIL: DETERMINISM CHECK FAILED - see mismatches above.'
        : 'PASS: DETERMINISM CHECK PASSED - all tables identical (modulo documented variable columns).')
  );
  process.exitCode = anyMismatch ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
