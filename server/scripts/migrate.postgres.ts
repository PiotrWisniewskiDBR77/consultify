#!/usr/bin/env tsx
/**
 * Postgres migration runner (deterministic, no SQLite translation)
 *
 * Why:
 * - `server/scripts/migrate.ts` is SQLite-first and rewrites SQL (Postgres→SQLite).
 * - For a real Postgres deployment we need to execute Postgres migrations as-authored.
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/migrate.postgres.ts
 *
 * Options:
 *   --dir <path>           default server/migrations
 *   --dry-run              print pending migrations, no writes
 *   --safe                 on error: record as skipped and continue
 *   --only <a,b,c>         only these filenames
 *   --from <filename>      start from this filename (inclusive)
 *   --allow-checksum-drift proceed even when an already-applied migration's
 *                          bytes changed (fail-closed by default)
 */

import crypto from 'crypto';
import '../src/config/loadEnv.js';

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { Pool } from 'pg';

import {
  assertNoPrivateRailwayDbHostOutsideRailway,
  resolveReachableDatabaseUrl,
} from '../src/config/databaseTargetResolver.js';
import { classifySqlChainChecksum } from '../src/services/releaseGate/sqlChainChecksumPolicy.js';
import {
  ATTESTED_VARIANT_LABEL,
  attestPartnerUsersUuidVariant,
} from '../src/services/releaseGate/schemaAttestation.js';

type Args = {
  dir?: string;
  'dry-run'?: boolean;
  safe?: boolean;
  only?: string;
  from?: string;
  'allow-checksum-drift'?: boolean;
};

export type Migration = {
  version: string;
  filename: string;
  filepath: string;
  checksum: string;
};

function parseArgs(argv: string[]): Args {
  const args: Record<string, any> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run' || key === 'safe' || key === 'allow-checksum-drift') {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args as Args;
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getAllMigrations(dir: string): Migration[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.ts'))
    .sort();

  return files.map((filename) => {
    const filepath = path.join(dir, filename);
    const version = filename.split('_')[0] || filename;
    return { version, filename, filepath, checksum: calculateChecksum(filepath) };
  });
}

// ---------------------------------------------------------------------------
// Deterministic execution-order contract
// ---------------------------------------------------------------------------
// Plain filename sort (the historical behavior) breaks down once two naming
// schemes coexist in `server/migrations/`:
//
//   NUMBERED  000_..., 500_...938_...  — the older, canonical Postgres-native
//             producers (baseline + incremental schema, zero-padded 3-digit
//             version prefixes).
//   DATED     20260101_..., 2026-06-08_... — newer incremental migrations
//             (YYYYMMDD or YYYY-MM-DD prefixes), added chronologically after
//             the numbered series was mostly frozen, that ALTER/backfill
//             tables the numbered migrations create.
//
// Lexicographic string sort puts almost all DATED files BEFORE almost all
// NUMBERED files >= 300, because the character '2' (start of "2026...")
// sorts before '3'-'9' (start of "300_".."938_"). Concretely: on a fresh DB,
// the raw filename sort runs all ~269 dated migrations first, then all
// ~221 numbered 500-938 migrations — even though dated migrations like
// `20260719_baseline_gap.sql` reference tables (`initiative_budget_items`,
// `report_builder_templates`, `interview_library_templates`, ...) that only
// the numbered 500-938 migrations create. That is the actual dependency
// bug: consumers were scheduled before producers, purely as an artifact of
// ASCII string comparison, not any real dependency analysis.
//
// Fix: classify each migration into an explicit phase and sort within each
// phase by a phase-appropriate key (numeric version, or calendar date) —
// NOT a full manual topological sort of ~700+ files, and NOT raw filename
// sort where that breaks the dependency graph.
//
//   Phase 0 — NUMBERED  sorted by numeric version (000 baseline first, then
//                        500..938 as historical producers), filename as tie
//                        breaker for duplicate version numbers (e.g. the two
//                        100_owner_role*.sql files).
//   Phase 1 — DATED      sorted by calendar date (YYYY, MM, DD), filename as
//                        tie breaker for same-day migrations.
//   Phase 2 — LATE       explicit, documented manifest (LATE_PHASE_MANIFEST
//                        below) of hotfix/backfill/guard migrations that
//                        must run after BOTH phase 0 and phase 1, because
//                        they consume objects created by dated migrations
//                        themselves (date-order alone does not place them
//                        correctly). Discovered empirically in ETAP 1 of
//                        STRICT_SCHEMA_REPAIR_REPORT.md by iterating strict
//                        runs against a fresh container.
//   Phase 3 — OTHER      anything matching neither pattern (e.g.
//                        `init-pgvector.sql`) — order-independent, runs
//                        last, sorted by filename.

const NUMBERED_RE = /^(\d{3})[a-zA-Z]?_/;
const DATED_RE = /^(\d{4})-?(\d{2})-?(\d{2})[_-]/;

// Filenames that must run after every phase-0 (numbered) and phase-1 (dated)
// migration. Each entry is a hotfix/backfill/guard whose own date prefix
// would otherwise place it too early relative to other dated migrations it
// actually depends on. See STRICT_SCHEMA_REPAIR_REPORT.md ETAP 1 for the
// per-file dependency trace that justifies each entry.
//
// INTEGRATION NOTE (foundation wave, 2026-08-13) — the Finance checkpoint
// (c78086057d) shipped this manifest populated with
// `'20260809_finance_v3_ap06_comments_01_tables.sql'`. That entry was
// DELIBERATELY DROPPED during integration, for two independently sufficient
// reasons, both verified against the Finance checkpoint itself:
//
//   1. IT WAS DEAD CODE. No such file exists. The real filename is
//      `20260809_finance_v3_d_ap06_comments_01_tables.sql` (note the `d_`,
//      matching its Gate-D siblings d01/d03/d05/d07/d09/d_ap04/d_ap07).
//      `LATE_PHASE_SET.has(f)` therefore never matched and the override never
//      fired. The AP-02 incident it describes was real, but it predates the
//      `d_` rename — and that rename is what actually fixed the ordering,
//      because `b01` < `d_ap06` lexicographically ('b' < 'd'), so phase-1's
//      own date+filename key already schedules the producer first.
//
//   2. "CORRECTING" IT TO THE REAL FILENAME WOULD BREAK FRESH INSTALL.
//      Phase 2 runs after EVERY phase-0 and phase-1 migration. The Finance
//      comment tables are NOT self-contained, contrary to the original note:
//      `20260826_finance_v3_w2_selfclaim_child_tenant_fk.sql` (dated, phase 1)
//      executes `ALTER TABLE finance_comments ADD CONSTRAINT ...` and
//      `ALTER TABLE finance_comment_assignments ... REFERENCES
//      finance_comments (id, organization_id)`. Deferring the producer to
//      phase 2 would place it AFTER that consumer and fail a fresh strict run
//      with `relation "finance_comments" does not exist`.
//      (`20260809_finance_v3_d_ap07_saved_views_01_tables.sql` mentions the
//      comment tables only in prose comments — no DDL — so it is not a factor.)
//
// Net: natural phase-1 ordering is already correct for the real filenames, and
// a late-phase bump is actively harmful here. Keep this manifest EMPTY unless a
// future entry is justified by a fresh-strict run AND checked against every
// later-dated consumer of the tables it creates.
const LATE_PHASE_MANIFEST: string[] = [];
const LATE_PHASE_SET = new Set(LATE_PHASE_MANIFEST);

// `isSqliteOnlyMigration()` blanket-excludes every numbered migration with
// version < 500 as "legacy/SQLite-first, superseded by the baseline". That
// heuristic is correct for most of the <500 range, but a handful of those
// files are the ONLY producer of a table that later (>=500 or dated)
// migrations depend on, are already fully Postgres-native (CREATE TABLE IF
// NOT EXISTS, no SQLite dialect), and do not conflict with anything
// `000_z_core_baseline.sql` creates. Excluding them entirely — rather than
// just re-ordering them — left those tables uncreated on a genuinely fresh
// strict run even after the phase fix above (verified against a live
// Postgres catalog, not just exit codes). Each entry here is promoted back
// into the run (still sorted into phase 0 by its own numeric version, so it
// runs alongside the other historical producers) with a one-line reason.
// See STRICT_SCHEMA_REPAIR_REPORT.md ETAP 1/3 for the full trace.
const PROMOTED_LEGACY_PRODUCERS: string[] = [
  // Sole producer of `studio_documents`, `studio_snapshots`, and the related
  // Studio CRUD tables used by the mounted `/api/studio` routes. The file is
  // Postgres-compatible after the runner's narrow DATETIME/boolean shims and
  // depends only on core baseline tables. Excluding it made strict fresh
  // schema report success while every mounted Studio persistence call failed
  // at runtime with a missing relation.
  '081_studio_tables.sql',
  // Sole producer of `conversations` / `conversation_messages` for the
  // strict path (000_z_core_baseline.sql does not create them). Consumed by
  // 515_team_chat_projects.sql (ALTER ... ADD COLUMN). Already
  // Postgres-native (gen_random_uuid()::text, NOW(), JSONB, catalog-guarded
  // DO $$ blocks) — no SQLite idiom, no conflict with baseline.
  '073_conversations.sql',
  // Sole producer of `partner_organizations`, `partner_users`,
  // `partner_certifications`, etc. Consumed by 730_partner_users_uuid_columns.sql,
  // 778_partner_users_missing_columns.sql, 799_partner_certifications_missing_columns.sql,
  // 555_partner_resources.sql, 20260719_baseline_gap.sql. Postgres-native
  // (gen_random_uuid(), no SQLite idiom); no conflicting definition in baseline.
  '215_partner_portal.sql',
  // Sole producer of `integrations` / `integration_providers`. Consumed by
  // 566_sync_hub_guardrails_t086_t008.sql (guarded ALTER via
  // information_schema check, but needs the table itself to exist first).
  // Postgres-native, no SQLite idiom, no baseline conflict.
  '256_integrations_system.sql',
];
const PROMOTED_LEGACY_SET = new Set(PROMOTED_LEGACY_PRODUCERS);

// Two kinds of producer/consumer inversion that phase + numeric/date sort
// alone cannot fix, because they invert relative to their OWN phase's sort
// key (not just the numbered-vs-dated phase boundary already handled above):
//
//   a) A lower-numbered phase-0 file consumes a table only a HIGHER-numbered
//      phase-0 file creates (e.g. 559 needs 739's kb_categories).
//   b) A phase-0 (numbered) file consumes a table only a phase-1 (dated)
//      file creates (e.g. 756_interview_insight_downstream_lineage.sql
//      needs my_ideas, created by 20260220_my_work_my_ideas.sql).
//
// Rather than moving every small consumer, this forces the ONE
// self-contained producer into phase 0 at a synthetic version, so it runs
// early alongside the other historical producers. The real filename is
// untouched; only its sort position changes.
const EARLY_VERSION_OVERRIDES: Record<string, number> = {
  // Self-contained (no FK to anything outside kb_*); creates
  // kb_categories/kb_articles/kb_category_translations/kb_article_translations,
  // consumed by 559_tools_known_tools_library.sql and
  // 562_tools_toolsets_speed.sql (both < 739 numerically). Sorted to run
  // right after 558 / before 559 so both consumers see the tables.
  '739_knowledge_base_public_articles.sql': 558.5,
  // Self-contained (no FK at all); sole producer of `my_ideas`, consumed by
  // 756_interview_insight_downstream_lineage.sql (phase 0). Without this
  // override it would run in phase 1 (dated), after phase 0 already needed
  // it. Sorted to run early in phase 0 (before 502, the first "real"
  // producer in that range) since nothing else needs to precede it.
  '20260220_my_work_my_ideas.sql': 501.5,
  // Large ~55-table "prod missing tables" reconciliation dump. All of its
  // CREATE TABLE statements are self-contained IF NOT EXISTS, and its only
  // external FK targets (organizations/projects/users/reports/invoices/
  // webhooks) are already produced by baseline or the 000_zz producer file.
  // Its number (900) sorted it far too late: 792_admin_sessions_extended_columns.sql
  // (ALTER, guarded but needs the table) and other consumers in the 790s
  // need admin_sessions/admin_audit_logs/etc. before then. Sorted to run
  // right after the 000_zz producer file, before any other 500+ producer.
  '900_prod_missing_tables_hotfix.sql': 501.6,
  // Sole producer of `permission_requests`. Consumed by
  // 795_permission_requests_missing_columns.sql (phase 0, numbered).
  // Self-contained (only FK to organizations/users, both baseline).
  '20260101_add_profile_fields_and_permission_requests.sql': 501.7,
  // Sole producer of `financial_statement_packs`. Consumed by
  // 915_finance_aggregate_scope.sql (phase 0). Also ALTERs `financial_models`
  // (produced by 571_financial_modeling_t054.sql), so it cannot move all the
  // way to the front — sorted to run right after 571 instead.
  '20260316_financial_statement_packs.sql': 571.5,
  // Sole producer of `initiative_candidates`. Consumed by
  // 932_initiative_candidate_acceptance_receipt.sql (phase 0). No FK at all.
  '20260627_initiative_candidates.sql': 501.8,
  // Additive core parity is the sole producer of initiatives.title, consumed
  // by 20260624_initiative_status_normalize.sql. Its dated filename otherwise
  // sorts after that consumer on a fresh schema. Baseline already creates the
  // projects/initiatives tables; every DDL statement is guarded and the
  // backfill is idempotent, so running it here closes the ordering inversion
  // without editing any already-applied migration file/checksum.
  '20260802_mvp_core_schema_parity.sql': 501.9,
  // Canonical additive producer of initiative_milestones/resources/raid_items.
  // The dated consumer 20260720_fala4_kpi_snap_milestone_deps_ai_policies.sql
  // creates FKs to initiative_milestones, so the producer's 2026-08-01 name
  // otherwise sorts too late on a fresh schema. It depends only on baseline
  // organizations/initiatives/tasks and is fully replay-safe.
  '20260801_exe002004_idempotency_keys.sql': 501.95,
  // Sole producer of interview_library_template_questions.answer_type (+
  // several sibling columns) and interview_library_template_versions.
  // Consumed by 20260703_interview_question_consultant_grade_rewrite.sql
  // (dated, but earlier date than this file's own 2026-08-02 name — a
  // same-phase-1 producer/consumer inversion, not just the numbered/dated
  // boundary). All statements are `ALTER TABLE IF EXISTS ... ADD COLUMN IF
  // NOT EXISTS` — safe to run early EXCEPT that "IF EXISTS" on the target
  // table means running it before interview_library_template_questions
  // exists would silently no-op and mark this migration 'success' forever,
  // never actually adding the columns. Sorted to run right after
  // 727_beta_missing_tables.sql (which creates that table), not all the way
  // to the front.
  '20260802_int001_template_publication_versions.sql': 727.5,
};

// Explicit intra-day ordering for phase-1 (dated) migrations that share the
// SAME calendar date and have a producer/consumer relationship the plain
// filename tiebreaker inverts. This does not affect ordering relative to
// OTHER dated files (those keep the filename tiebreaker unchanged) except
// that entries here always sort before same-date files not listed, since
// the synthetic numeric key starts with a digit — verified safe because
// none of these 11 tables are referenced by any migration outside this list
// (Case Workspace program collision-avoidance mandate: no other migration
// FKs into case_workspace_*; the only external FKs these files carry point
// to organizations/projects/v8_execution_runs, all from far earlier dates).
// Root cause + fix verified via a genuinely fresh migration replay:
// server/scripts/case-workspace-realdb-harness/EVIDENCE.md.
const DATED_SAME_DAY_ORDER: Record<string, number> = {
  '20260809_case_workspace_case_core.sql': 0, // sole producer `case_core` — every other file here FKs into it, directly or transitively
  '20260809_case_workspace_capability_registry.sql': 1, // no case_workspace FK dependency; kept early
  '20260809_case_workspace_case_plan_version.sql': 2, // FKs case_core
  '20260809_case_workspace_run_binding.sql': 3, // FKs case_core, case_plan_versions, v8_execution_runs (v8_execution_runs is March-dated, unaffected)
  '20260809_case_workspace_proposals_approvals.sql': 4, // FKs case_core, run_binding, case_plan_versions, capability_registry
  '20260809_case_workspace_wait_subscription.sql': 5, // FKs case_core, run_binding, proposals_approvals
  '20260809_case_workspace_history_value.sql': 6, // FKs case_core
  '20260809_case_workspace_plays.sql': 7, // no FK into case_core/case_plan_versions by design (Plays are pre-Case)
  '20260809_case_workspace_artifact_links.sql': 8, // FKs case_core — this was the file that originally exposed the bug (sorted alphabetically before case_core.sql)
  '20260809_case_workspace_execution_graph.sql': 9, // FKs case_core, run_binding
  '20260809_case_workspace_migration_readiness.sql': 10, // no FK into any other case_workspace table
};

function phaseAndKeyFor(m: Migration): { phase: number; key: string } {
  const f = m.filename;
  if (LATE_PHASE_SET.has(f)) {
    return { phase: 2, key: f };
  }
  if (Object.prototype.hasOwnProperty.call(EARLY_VERSION_OVERRIDES, f)) {
    const version = EARLY_VERSION_OVERRIDES[f];
    const paddedInt = String(Math.trunc(version)).padStart(6, '0');
    const fraction = version % 1 !== 0 ? String(version).split('.')[1] : '0';
    return { phase: 0, key: `${paddedInt}.${fraction}_${f}` };
  }
  const numbered = f.match(NUMBERED_RE);
  if (numbered) {
    const version = Number.parseInt(numbered[1], 10);
    const paddedInt = String(Math.trunc(version)).padStart(6, '0');
    const fraction = version % 1 !== 0 ? String(version).split('.')[1] : '0';
    return { phase: 0, key: `${paddedInt}.${fraction}_${f}` };
  }
  const dated = f.match(DATED_RE);
  if (dated) {
    const [, y, mo, d] = dated;
    const tiebreaker = Object.prototype.hasOwnProperty.call(DATED_SAME_DAY_ORDER, f)
      ? String(DATED_SAME_DAY_ORDER[f]).padStart(6, '0')
      : f;
    return { phase: 1, key: `${y}${mo}${d}_${tiebreaker}` };
  }
  return { phase: 3, key: f };
}

// Exported (E8) so the ordering contract is directly testable without
// executing main() — see
// tests/integration/migration-ordering-parity.realdb.test.ts, which checks
// this comparator against the SAME producer-before-consumer property
// asserted for the other two automatic/manual runtime mechanisms.
export function compareMigrationOrder(a: Migration, b: Migration): number {
  const pa = phaseAndKeyFor(a);
  const pb = phaseAndKeyFor(b);
  if (pa.phase !== pb.phase) return pa.phase - pb.phase;
  if (pa.key === pb.key) return 0;
  return pa.key < pb.key ? -1 : 1;
}

function sortMigrationsDeterministically(migrations: Migration[]): Migration[] {
  return [...migrations].sort(compareMigrationOrder);
}

function isSqliteOnlyMigration(m: Migration): boolean {
  const f = m.filename.toLowerCase();
  const versionNum = Number.parseInt(m.version, 10);

  // iCloud/duplicate artifacts (e.g. "515_xxx 2.sql")
  if (/\s+\d+\.sql$/.test(f)) return true;

  // Seed/demo data files should not be part of schema migration flow.
  if (
    f.includes('seed') ||
    f.includes('mock') ||
    f.includes('demo') ||
    f.startsWith('add_') ||
    f === 'assessment-module.sql' ||
    f === 'fix_conversations_table.sql'
  ) {
    return true;
  }

  // Canonical flow for Postgres uses the core baseline + modern incremental migrations.
  // Older pre-baseline fragments (<500) are often SQLite-first and conflict with baseline.
  if (Number.isFinite(versionNum) && versionNum > 0 && versionNum < 500) {
    if (!f.startsWith('000_z_core_baseline')) return true;
  }

  // Legacy initdb snapshots were generated from older SQLite-first schemas and can conflict with
  // the canonical Postgres baseline migrations (e.g. duplicate tables with missing columns).
  // For Postgres-only deployments we rely on `000_z_core_baseline.sql` + subsequent migrations.
  if (f.startsWith('000_initdb_')) return true;
  // explicit sqlite-only naming
  if (f.includes('_sqlite')) return true;
  // SQLite FTS virtual tables are not valid Postgres migrations.
  if (f.includes('fts5')) return true;
  // helper/repair files explicitly targeting sqlite
  if (f.includes('repair_sqlite')) return true;
  // any file that explicitly mentions sqlite but isn't postgres-specific
  if (f.includes('sqlite') && !f.includes('postgres')) return true;
  // legacy double extension files are sqlite-first exports (skip for Postgres-only runner)
  if (f.endsWith('.sql.sql')) return true;
  return false;
}

async function ensureSchemaMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT NOT NULL,
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT NOT NULL,
      execution_time_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success'
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);`
  );
}

async function getApplied(
  pool: Pool
): Promise<Map<string, { status: string; checksum: string | null }>> {
  const res = await pool.query(
    `SELECT filename, status, checksum FROM schema_migrations ORDER BY filename`
  );
  const map = new Map<string, { status: string; checksum: string | null }>();
  for (const r of res.rows || [])
    map.set(String(r.filename), {
      status: String(r.status || 'success'),
      checksum: r.checksum == null ? null : String(r.checksum),
    });
  return map;
}

// ---------------------------------------------------------------------------
// Checksum-drift detection (integration foundation, 2026-08-13)
// ---------------------------------------------------------------------------
// Until now this runner recorded a sha256 per migration but NEVER read it back:
// `getApplied()` selected only `status`, and the pending filter keyed purely on
// filename. `recordResult()` even overwrites the stored checksum on conflict.
// Net effect: editing the bytes of an already-applied migration was silently
// invisible — the file was skipped as "already success" and the database
// quietly diverged from the tree with no signal at all.
//
// The runtime Table Platform runner (server/src/services/tablePlatform/
// migrationRunner.ts) has always been fail-closed on exactly this, via
// classifyMigrationChecksum(). This brings the SQL-chain runner to the same
// contract. It is intentionally NOT a copy of that code: the two subsystems
// store checksums in different formats (this runner: full 64-char sha256 of the
// raw file; Table Platform: a 16-char truncation, plus its own grandfathering
// ledger keyed to the 7xx/8-digit runtime set), so sharing the helper would
// mean reconciling two storage formats — a larger change than this wave allows.
//
// Rows written by `--safe` are stored as `skipped:<checksum>` and are not
// status='success', so they are excluded from the comparison. Rows with a NULL
// checksum are legacy/unverifiable and are reported, never failed on.
//
// `--allow-checksum-drift` is the deliberate, documented escape hatch. It must
// be passed explicitly; drift fails closed by default, including under --safe,
// because drift is an integrity violation rather than an "already applied"
// condition.
type ChecksumDrift = { filename: string; stored: string; current: string };

export type DriftReport = {
  drift: ChecksumDrift[];
  unverifiable: string[];
  /** files accepted via the reviewed per-file (stored,current) allowlist */
  approvedVariants: string[];
  /** files that additionally require live schema attestation before they may be accepted */
  attestationRequired: string[];
};

function detectChecksumDrift(
  migrations: Migration[],
  applied: Map<string, { status: string; checksum: string | null }>
): DriftReport {
  const drift: ChecksumDrift[] = [];
  const unverifiable: string[] = [];
  const approvedVariants: string[] = [];
  const attestationRequired: string[] = [];

  for (const m of migrations) {
    const a = applied.get(m.filename);
    if (!a || a.status !== 'success') continue;
    if (a.checksum == null || a.checksum === '') {
      unverifiable.push(m.filename);
      continue;
    }
    // Policy lives in one place and is keyed on filename + EXACT stored + EXACT current.
    const verdict = classifySqlChainChecksum(m.filename, a.checksum, m.checksum);
    if (verdict === 'MATCH') continue;
    if (verdict === 'APPROVED_HISTORICAL_VARIANT') {
      approvedVariants.push(m.filename);
      continue;
    }
    if (verdict === 'SCHEMA_ATTESTED_LEGACY_VARIANT') {
      // Not acceptable on the checksum alone — the caller must attest the live schema.
      attestationRequired.push(m.filename);
      continue;
    }
    drift.push({ filename: m.filename, stored: a.checksum, current: m.checksum });
  }
  return { drift, unverifiable, approvedVariants, attestationRequired };
}

async function recordResult(
  pool: Pool,
  m: Migration,
  status: 'success' | 'failed' | 'skipped',
  executionTimeMs: number,
  checksumOverride?: string
) {
  const checksum = checksumOverride ?? m.checksum;
  await pool.query(
    `INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (filename) DO UPDATE
     SET version = EXCLUDED.version,
         checksum = EXCLUDED.checksum,
         execution_time_ms = EXCLUDED.execution_time_ms,
         status = EXCLUDED.status,
         applied_at = CURRENT_TIMESTAMP`,
    [m.version, m.filename, checksum, executionTimeMs, status]
  );
}

async function applySql(pool: Pool, m: Migration) {
  let sql = fs.readFileSync(m.filepath, 'utf-8');

  // ------------------------------
  // Minimal SQLite → Postgres shims
  // ------------------------------
  // Legacy migrations may still contain SQLite idioms (e.g. `INSERT OR IGNORE`, `DATETIME`).
  // We keep this deterministic and intentionally narrow to avoid rewriting arbitrary SQL.

  // `INSERT OR IGNORE INTO ...;` → `INSERT INTO ... ON CONFLICT DO NOTHING;`
  sql = sql.replace(
    /\bINSERT\s+OR\s+IGNORE\s+INTO\b([\s\S]*?);/gi,
    (_m, rest) => `INSERT INTO${rest}\nON CONFLICT DO NOTHING;`
  );

  // SQLite-ish column types used in baselines; Postgres is fine with TIMESTAMP/TIMESTAMPTZ.
  sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

  // SQLite-style boolean defaults (0/1) → Postgres boolean literals
  sql = sql.replace(/\bBOOLEAN\s+DEFAULT\s+0\b/gi, 'BOOLEAN DEFAULT FALSE');
  sql = sql.replace(/\bBOOLEAN\s+DEFAULT\s+1\b/gi, 'BOOLEAN DEFAULT TRUE');
  // Sometimes booleans are declared as INTEGER with default 0/1; keep as-is (app treats them as flags).

  // SQLite `lower(hex(randomblob(16)))` → Postgres `gen_random_uuid()::text`
  sql = sql.replace(/\(lower\(hex\(randomblob\(\d+\)\)\)\)/gi, 'gen_random_uuid()::text');

  // SQLite `datetime('now')` → Postgres `CURRENT_TIMESTAMP`
  sql = sql.replace(/\(datetime\('now'\)\)/gi, 'CURRENT_TIMESTAMP');

  // Make legacy column adds idempotent on Postgres
  sql = sql.replace(
    /\bALTER\s+TABLE\s+([a-zA-Z0-9_".]+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS '
  );

  // Make legacy index creation resilient (some indexes reference columns introduced later).
  // This is safe for local/dev bootstrap; production should keep migrations ordered correctly.
  if (m.filename.includes('005_ai_explainability')) {
    sql = sql.replace(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ai_audit_logs_confidence\s+ON\s+ai_audit_logs\s*\(\s*confidence_level\s*\)\s*;/gi,
      '/* skipped: idx_ai_audit_logs_confidence (requires confidence_level column) */'
    );
    sql = sql.replace(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_ai_audit_logs_ai_role\s+ON\s+ai_audit_logs\s*\(\s*ai_role\s*\)\s*;/gi,
      '/* skipped: idx_ai_audit_logs_ai_role (requires ai_role column) */'
    );
  }

  // Most Postgres migrations are safe to run as a single multi-statement query.
  await pool.query(sql);
}

// ---------------------------------------------------------------------------
// `--safe` semantics (E8, docs/product/case-workspace/evidence/
// e7-migration-paths-2026-08-12/MIGRATION_PATH_ASSESSMENT.md §5)
// ---------------------------------------------------------------------------
// Before this fix, `--safe` treated EVERY error identically: record
// status='skipped', continue, and — if nothing later throws — print
// "✅ Postgres migrations complete" and exit 0. That is the exact
// `db:migrate --safe` trap this program has already been burned by once
// (see MEMORY.md `audyt-bazy-danych-2026-08-06.md`): a migration that never
// actually applied is reported as success, under a status name ("skipped")
// that reads as "intentionally not needed" rather than "failed". Any CI gate
// or human checking only the exit code or the banner sees green.
//
// `--safe` clearly exists for a real, narrow reason: tolerate a migration
// that fails because the object it creates ALREADY EXISTS — e.g. because a
// different migration mechanism (DatabaseInitializer.ts's own runner, or a
// prior partial run of this same script) got there first. That is exactly
// the scenario MIGRATION_PATH_ASSESSMENT.md §2 documents between this script
// and DatabaseInitializer.ts's `tp_migration_history`-tracked runner. It was
// never meant to swallow a migration that is genuinely broken (bad SQL,
// missing dependency, permission error, etc).
//
// Fix: classify the failure. BENIGN (already-exists-class) errors keep the
// exact previous behavior — recorded 'skipped', loop continues, does not
// fail the run. GENUINE failures are recorded 'failed' (not 'skipped', so a
// future `schema_migrations` reader sees the truth) and the run now REFUSES
// to report success: no "✅ ... complete" banner, and the process exits
// non-zero (via the same `main().catch()` → `process.exit(1)` path already
// used for the non-`--safe` case), even though `--safe` still let every
// OTHER pending migration in the batch attempt to run (so one genuinely
// broken, unrelated migration does not block a caller who only needs a
// handful of specific tables to exist — the documented reason `--safe` is
// used as a best-effort bootstrap across dozens of this program's
// `realdb.test.ts` acceptance gates).
//
// Verified empirically before landing this: a real, from-scratch run of
// `migrate.postgres.ts --safe` against a genuinely empty local Postgres
// (this session's `cw_e8_safe` scratch DB) applied all 598 discovered
// migrations with ZERO failures (benign or genuine) — the historical "50+
// migrations fail on a clean Postgres" note in
// docs/testing/RELEASE_READINESS_SHORTCOMINGS.md is stale; this program's
// prior migration-ordering/repair work already closed that gap. So this
// change does not regress today's bootstrap flows; it only changes what
// happens the NEXT time a migration genuinely breaks, which is exactly the
// point.
//
// Deliberately duplicates (does not import) DatabaseInitializer.ts's
// `isAlreadyExists` heuristic in runTablePlatformMigrations() — same four
// substrings, same narrow intent. Not shared code: this packet's allowlist
// does not permit adding a new shared module, and the two runners already
// have independent discovery/sort machinery for the same reason (see
// migrationRunner.ts's SAME_PREFIX_ORDER comment). Keep both in sync if the
// classification ever needs to widen.
function isBenignAlreadyAppliedError(msg: string): boolean {
  return (
    msg.includes('already exists') ||
    msg.includes('duplicate key') ||
    msg.includes('duplicate_column') ||
    msg.includes('duplicate_object')
  );
}

async function applyJs(pool: Pool, m: Migration) {
  const mod = await import(pathToFileUrl(m.filepath));
  if (typeof mod.up !== 'function') {
    throw new Error(`JS migration ${m.filename} has no exported up() function`);
  }
  // Run JS migrations through the app DB adapter to preserve compatibility shims
  // (e.g., PRAGMA mapping, sqlite-style helpers).
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  process.env.DB_TYPE = 'postgres';
  const db = await getDatabaseAsync();
  await mod.up(db);
}

function pathToFileUrl(p: string) {
  return pathToFileURL(p).href;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const migrationsDir = path.resolve(process.cwd(), args.dir || 'server/migrations');
  const dryRun = args['dry-run'] === true;
  const safe = args.safe === true;
  const allowChecksumDrift = args['allow-checksum-drift'] === true;
  const only = new Set(splitCsv(args.only));
  const from = args.from ? String(args.from) : null;

  process.env.DB_TYPE = 'postgres';
  assertNoPrivateRailwayDbHostOutsideRailway(process.env);
  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (resolvedDb.reason) {
    // eslint-disable-next-line no-console
    console.warn(`[migrate.postgres] ${resolvedDb.reason}`);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await ensureSchemaMigrationsTable(pool);
    const applied = await getApplied(pool);

    const all = sortMigrationsDeterministically(
      getAllMigrations(migrationsDir)
        .filter((m) => (only.size ? only.has(m.filename) : true))
        // NOTE: allow explicit `--only` to run even legacy (<500) migrations.
        // PROMOTED_LEGACY_PRODUCERS overrides the blanket <500 exclusion for
        // specific, verified-safe producer files (see comment above).
        .filter((m) =>
          only.size ? true : PROMOTED_LEGACY_SET.has(m.filename) || !isSqliteOnlyMigration(m)
        )
    );

    // `--from` resumes at a specific file's position in the DETERMINISTIC
    // execution order (not raw filename string comparison, which would no
    // longer match actual execution order once phases are involved).
    const fromIndex = from ? all.findIndex((m) => m.filename === from) : -1;
    const filtered = from ? (fromIndex >= 0 ? all.slice(fromIndex) : all) : all;

    // Integrity gate: an already-applied migration whose bytes changed means the
    // database no longer matches the tree. Fail closed BEFORE applying anything
    // (including under --safe), so a drifted chain can never be extended.
    const { drift, unverifiable, approvedVariants, attestationRequired } = detectChecksumDrift(
      filtered,
      applied
    );
    if (unverifiable.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[migrate.postgres] ${unverifiable.length} applied migration(s) have no stored checksum (legacy rows, not verifiable).`
      );
    }
    if (approvedVariants.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[migrate.postgres] ${approvedVariants.length} approved historical variant(s) accepted ` +
          `(exact stored+current pair): ${approvedVariants.join(', ')}`
      );
    }
    // Files whose checksum can never be traced to a commit are accepted ONLY if the live schema
    // re-proves the known variant's post-state, in this same connection, on every run.
    for (const filename of attestationRequired) {
      const result = await attestPartnerUsersUuidVariant(pool);
      const failed = result.checks.filter((c) => !c.ok);
      if (!result.attested) {
        throw new Error(
          `${ATTESTED_VARIANT_LABEL} refused for ${filename}: ${result.failureReason}. ` +
            `Failed checks: ${failed.map((c) => `${c.name} (expected ${c.expected}, got ${c.actual})`).join('; ')}. ` +
            `Refusing to run (fail-closed).`
        );
      }
      // eslint-disable-next-line no-console
      console.log(
        `[migrate.postgres] ${ATTESTED_VARIANT_LABEL} ${filename} — ` +
          `${result.checks.length} schema postcondition(s) verified in-transaction.`
      );
    }
    if (drift.length > 0) {
      const detail = drift
        .map((d) => `  - ${d.filename}\n      stored:  ${d.stored}\n      current: ${d.current}`)
        .join('\n');
      const message =
        `Checksum drift detected for ${drift.length} already-applied migration(s). ` +
        `The database no longer matches these files. Refusing to run (fail-closed).\n${detail}\n` +
        `If this change is reviewed and intentional, re-run with --allow-checksum-drift.`;
      if (!allowChecksumDrift) {
        throw new Error(message);
      }
      // eslint-disable-next-line no-console
      console.warn(`[migrate.postgres] --allow-checksum-drift set; continuing despite:\n${message}`);
    }

    const pending = filtered.filter((m) => {
      const a = applied.get(m.filename);
      return !a || a.status !== 'success';
    });

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log(`Pending migrations: ${pending.length}`);
      for (const m of pending) {
        try {
          // eslint-disable-next-line no-console
          console.log(`- ${m.filename}`);
        } catch (e: any) {
          // When piped to tools like `head`, stdout can close early → EPIPE.
          // Treat that as a normal termination condition.
          if (String(e?.code || '').toUpperCase() === 'EPIPE') return;
          throw e;
        }
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Applying migrations: ${pending.length}`);

    // Filenames that genuinely failed under --safe (not the benign
    // already-applied class) — tracked so the run can refuse to report
    // success even though --safe let it keep going past them. See the
    // `isBenignAlreadyAppliedError` comment above for the full rationale.
    const genuineFailures: string[] = [];

    for (const m of pending) {
      const started = Date.now();
      try {
        // eslint-disable-next-line no-console
        console.log(`→ ${m.filename}`);

        if (m.filename.endsWith('.sql')) {
          await applySql(pool, m);
        } else {
          await applyJs(pool, m);
        }

        await recordResult(pool, m, 'success', Date.now() - started);
      } catch (e: any) {
        const msg = e?.message || String(e);
        // eslint-disable-next-line no-console
        console.error(`✗ ${m.filename}: ${msg}`);

        if (safe) {
          const benign = isBenignAlreadyAppliedError(msg);
          if (benign) {
            await recordResult(
              pool,
              m,
              'skipped',
              Date.now() - started,
              `skipped:${m.checksum}`
            );
          } else {
            // Genuine failure: recorded as 'failed' (truthful status), NOT
            // 'skipped'. --safe still lets the batch continue to the next
            // migration (a best-effort bootstrap should not let one broken,
            // unrelated file block every other table a caller may need),
            // but this run can no longer end with "✅ ... complete" — see
            // the check after this loop.
            // eslint-disable-next-line no-console
            console.error(`  (--safe: genuine failure, NOT already-applied — recording 'failed')`);
            await recordResult(pool, m, 'failed', Date.now() - started);
            genuineFailures.push(m.filename);
          }
          continue;
        }

        await recordResult(pool, m, 'failed', Date.now() - started);
        throw e;
      }
    }

    if (genuineFailures.length > 0) {
      // Thrown (not process.exit() here) so the `finally` block below still
      // runs and closes the pool cleanly; caught by main().catch() further
      // down, which prints the failure and exits 1 — the same non-zero exit
      // path already used for the non-safe case, so callers checking exit
      // code (not just stdout text) see the truth either way.
      throw new Error(
        `${genuineFailures.length} migration(s) genuinely failed under --safe ` +
          `(recorded status='failed', not swallowed as 'skipped'): ${genuineFailures.join(', ')}`
      );
    }

    // eslint-disable-next-line no-console
    console.log('✅ Postgres migrations complete');
  } finally {
    await pool.end();
  }
}

// Run only when executed directly (`tsx server/scripts/migrate.postgres.ts`),
// not when imported — E8 exports `compareMigrationOrder`/`Migration` above
// for a parity test, and an unconditional top-level `main()` call would
// otherwise connect to a real database and attempt a full migration run as
// a side effect of merely importing this module for its ordering function.
// No behavior change for the actual CLI entry point: `import.meta.url` and
// `process.argv[1]` still match exactly the same way they always did when
// this file is run via tsx.
const isDirectCliInvocation =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectCliInvocation) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Postgres migrate failed:', e?.message || e);
    process.exit(1);
  });
}
