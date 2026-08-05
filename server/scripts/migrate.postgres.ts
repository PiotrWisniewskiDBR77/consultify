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

type Args = {
  dir?: string;
  'dry-run'?: boolean;
  safe?: boolean;
  only?: string;
  from?: string;
};

type Migration = {
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
    if (key === 'dry-run' || key === 'safe') {
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
    return { phase: 1, key: `${y}${mo}${d}_${f}` };
  }
  return { phase: 3, key: f };
}

function compareMigrationOrder(a: Migration, b: Migration): number {
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

async function getApplied(pool: Pool): Promise<Map<string, { status: string }>> {
  const res = await pool.query(`SELECT filename, status FROM schema_migrations ORDER BY filename`);
  const map = new Map<string, { status: string }>();
  for (const r of res.rows || [])
    map.set(String(r.filename), { status: String(r.status || 'success') });
  return map;
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
          await recordResult(pool, m, 'skipped', Date.now() - started, `skipped:${m.checksum}`);
          continue;
        }

        await recordResult(pool, m, 'failed', Date.now() - started);
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log('✅ Postgres migrations complete');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Postgres migrate failed:', e?.message || e);
  process.exit(1);
});
