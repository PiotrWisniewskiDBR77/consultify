/**
 * Consultify Acceptance Harness — FULL local schema loader.
 *
 * The app's own migration autorun (server/src/services/tablePlatform/migrationRunner.ts)
 * only applies files matching /^(7\d{2}|\d{8})_/ — so 000-6xx and 9xx migrations never
 * run automatically and the schema is INCOMPLETE. This loader applies EVERY
 * server/migrations/*.sql (plus init-pgvector.sql) in numeric/lexical order,
 * idempotently, catching per-file errors. Two passes so ordering-dependent files
 * (ALTER before CREATE) still land on the retry.
 *
 * Writes ONLY to the LOCAL Postgres given by DATABASE_URL. Never demo/prod.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(
    `[schema] REFUSING to run: DATABASE_URL must point at a LOCAL host. Got: ${DATABASE_URL || '(unset)'}`
  );
  process.exit(2);
}

/** Sort key: leading digit run (dashes stripped) as a number; non-numeric prefixes last. */
function sortKey(name) {
  const m = name.match(/^(\d[\d-]*)/);
  if (!m) return [Number.MAX_SAFE_INTEGER, name];
  const num = Number.parseInt(m[1].replace(/-/g, ''), 10);
  return [Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER, name];
}

function discover() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f !== 'init-pgvector.sql')
    .sort((a, b) => {
      const [ka, sa] = sortKey(a);
      const [kb, sb] = sortKey(b);
      if (ka !== kb) return ka - kb;
      return sa.localeCompare(sb);
    });
}

async function applyFile(client, file) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
  if (!sql.trim()) return { file, ok: true, skipped: 'empty' };
  try {
    await client.query(sql);
    return { file, ok: true };
  } catch (err) {
    // Reset connection state: a failed statement inside a migration's BEGIN/COMMIT
    // leaves the session in an aborted-transaction state that poisons every later file.
    await client.query('ROLLBACK').catch(() => {});
    return { file, ok: false, error: String(err.message || err).split('\n')[0] };
  }
}

/**
 * KNOWN ISSUE (verified 2026-08-01, MW-CORE-001 golden-flow test infra):
 * `server/migrations/20260719_baseline_gap.sql` is ~33.5k lines applied via a
 * SINGLE `client.query(sql)` call. node-postgres sends a multi-statement
 * simple-query string as one Postgres "simple query" message, and Postgres
 * implicitly wraps that whole message in ONE transaction — if ANY statement
 * later in the file fails, EVERYTHING in that file rolls back, including
 * perfectly valid `CREATE TABLE` statements that appeared earlier in the same
 * file. Confirmed directly against this loader's target Postgres: the file
 * fails on a statement referencing `public.demo_sessions` (which does not
 * exist), and that failure erases:
 *   - `public.canonical_inbox_items` (defined at ~line 2586) — the canonical
 *     Inbox projection table the MW-CORE-001 golden flow tests depend on.
 *   - `v8.v8_feature_flags` (defined at ~line 11051) — the ONLY correct
 *     definition of this table (the standalone
 *     `20260324_v8_feature_flags.sql` migration creates a same-named table in
 *     the wrong schema, `public` instead of `v8`, and additionally fails on
 *     Postgres because of a SQLite-only `datetime('now')` default — so it can
 *     never stand in as a fallback). `server/src/services/v8/featureFlagService.ts`
 *     reads/writes `v8.v8_feature_flags` exclusively, so without this table the
 *     real `v8OrgGate` middleware can never resolve explicit per-org flag rows,
 *     which is exactly the path scenario #16 (unsupported non-V8 org) needs to
 *     exercise for real.
 *
 * SAME PATTERN, second confirmed instance: `server/migrations/247_initiative_enhancements.sql`
 * also fails as a whole (verified directly) — not on a missing-relation error
 * this time, but on `INSERT OR IGNORE INTO initiative_completion_checks`
 * (SQLite-only syntax; Postgres has no `OR IGNORE`), roughly two-thirds
 * through the file. Because that file is also sent as one multi-statement
 * `client.query()` call, the syntax error aborts the whole implicit
 * transaction and the file's LAST two statements —
 * `ALTER TABLE tasks ADD COLUMN blocked_by_decision_id TEXT` and
 * `ALTER TABLE tasks ADD COLUMN blocked_reason TEXT` — never take effect.
 * `inboxService.materializeInboxItems()`'s task-intake SELECT reads both
 * columns unconditionally; without them the query throws and the golden-flow
 * materialize step (scenarios #1/#2) can never run. Folded into the same
 * narrow workaround below, `IF NOT EXISTS`-guarded (the source migration's
 * own `ALTER TABLE tasks ADD COLUMN` lines are not, since on a from-scratch
 * apply the columns don't exist yet — guarding here just makes this function
 * itself safely re-runnable).
 *
 * Workaround, deliberately NARROW: re-apply ONLY these objects' real DDL,
 * copied VERBATIM from `20260719_baseline_gap.sql` (not reinvented), each
 * statement issued as its OWN `client.query()` call (own implicit
 * transaction), executed AFTER the two-pass loop above so an unrelated later
 * failure can never roll these back again. `source_status`/`initiative_id`
 * (added by the small, standalone `932_canonical_inbox_items_source_status_initiative.sql`)
 * are folded in here too so this function alone is sufficient even against a
 * completely fresh container where migration ordering (932 sorts before the
 * 20260719 file that creates the table) would otherwise make 932's ALTER TABLE
 * fail with "relation does not exist" on its first pass.
 */
async function applyKnownRollbackWorkarounds(client) {
  const statements = [
    // --- public.canonical_inbox_items — verbatim from 20260719_baseline_gap.sql:2586 ---
    `create table if not exists "public"."canonical_inbox_items" (
        "id" text not null default (gen_random_uuid())::text,
        "user_id" text not null,
        "organization_id" text not null,
        "item_type" text not null,
        "source_entity_type" text not null,
        "source_entity_id" text not null,
        "title" text not null,
        "description" text,
        "priority" text default 'normal'::text,
        "section" text not null default 'assigned_tasks'::text,
        "status" text not null default 'pending'::text,
        "sla_deadline" timestamp with time zone,
        "sla_status" text default 'on_track'::text,
        "delegated_to" text,
        "delegated_at" timestamp with time zone,
        "delegated_by" text,
        "delegation_notes" text,
        "metadata_json" text default '{}'::text,
        "created_at" timestamp with time zone default now(),
        "updated_at" timestamp with time zone default now(),
        "resolved_at" timestamp with time zone
    )`,
    // source_status/initiative_id — verbatim from 932_canonical_inbox_items_source_status_initiative.sql
    `ALTER TABLE canonical_inbox_items ADD COLUMN IF NOT EXISTS source_status TEXT`,
    `ALTER TABLE canonical_inbox_items ADD COLUMN IF NOT EXISTS initiative_id TEXT`,
    // Constraints — verbatim names/targets from baseline_gap.sql:13901/13903/19798/24128,
    // wrapped in DO blocks (matching that file's own "add constraint using index" pattern)
    // since ADD CONSTRAINT has no IF NOT EXISTS in Postgres.
    `CREATE UNIQUE INDEX IF NOT EXISTS canonical_inbox_items_pkey ON public.canonical_inbox_items USING btree (id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS canonical_inbox_items_user_id_source_entity_type_source_ent_key ON public.canonical_inbox_items USING btree (user_id, source_entity_type, source_entity_id)`,
    `DO $$ BEGIN
       ALTER TABLE public.canonical_inbox_items ADD CONSTRAINT canonical_inbox_items_pkey PRIMARY KEY USING INDEX canonical_inbox_items_pkey;
     EXCEPTION WHEN OTHERS THEN NULL; END $$`,
    `DO $$ BEGIN
       ALTER TABLE public.canonical_inbox_items ADD CONSTRAINT canonical_inbox_items_user_id_source_entity_type_source_ent_key UNIQUE USING INDEX canonical_inbox_items_user_id_source_entity_type_source_ent_key;
     EXCEPTION WHEN OTHERS THEN NULL; END $$`,
    // Indexes — verbatim from baseline_gap.sql:14709-14721
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_delegated ON public.canonical_inbox_items USING btree (delegated_to) WHERE (delegated_to IS NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_org ON public.canonical_inbox_items USING btree (organization_id)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_section ON public.canonical_inbox_items USING btree (section)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_sla ON public.canonical_inbox_items USING btree (sla_deadline) WHERE (sla_status <> 'resolved'::text)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_status ON public.canonical_inbox_items USING btree (status)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_user ON public.canonical_inbox_items USING btree (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_inbox_user_org_status ON public.canonical_inbox_items USING btree (user_id, organization_id, status)`,
    // Partial index on initiative_id — verbatim from 932_canonical_inbox_items_source_status_initiative.sql
    `CREATE INDEX IF NOT EXISTS canonical_inbox_items_initiative_id_idx ON canonical_inbox_items (initiative_id) WHERE initiative_id IS NOT NULL`,

    // --- v8.v8_feature_flags — verbatim from 20260719_baseline_gap.sql:11051 ---
    `CREATE SCHEMA IF NOT EXISTS v8`,
    `create table if not exists "v8"."v8_feature_flags" (
        "flag_id" text not null,
        "organization_id" text not null,
        "module" text not null,
        "enabled" integer not null default 0,
        "updated_at" text not null default CURRENT_TIMESTAMP,
        "updated_by" text
    )`,
    // Constraints/indexes — verbatim names/targets from baseline_gap.sql:18137/18139/18771/18773/22553/30913
    `CREATE UNIQUE INDEX IF NOT EXISTS v8_feature_flags_pkey ON v8.v8_feature_flags USING btree (flag_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS v8_feature_flags_organization_id_module_key ON v8.v8_feature_flags USING btree (organization_id, module)`,
    `DO $$ BEGIN
       ALTER TABLE v8.v8_feature_flags ADD CONSTRAINT v8_feature_flags_pkey PRIMARY KEY USING INDEX v8_feature_flags_pkey;
     EXCEPTION WHEN OTHERS THEN NULL; END $$`,
    `DO $$ BEGIN
       ALTER TABLE v8.v8_feature_flags ADD CONSTRAINT v8_feature_flags_organization_id_module_key UNIQUE USING INDEX v8_feature_flags_organization_id_module_key;
     EXCEPTION WHEN OTHERS THEN NULL; END $$`,
    `CREATE INDEX IF NOT EXISTS idx_v8_ff_org ON v8.v8_feature_flags USING btree (organization_id)`,
    `CREATE INDEX IF NOT EXISTS idx_v8_ff_org_module ON v8.v8_feature_flags USING btree (organization_id, module)`,

    // --- public.tasks.blocked_by_decision_id / blocked_reason — verbatim
    // column defs from 247_initiative_enhancements.sql, IF NOT EXISTS-guarded ---
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_decision_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_blocked ON tasks(blocked_by_decision_id)`,
  ];

  let ok = 0;
  const errors = [];
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      errors.push(String(err.message || err).split('\n')[0]);
    }
  }
  console.log(
    `[schema] Known-rollback workaround (canonical_inbox_items + v8.v8_feature_flags + tasks.blocked_*): ${ok}/${statements.length} statements applied`
  );
  if (errors.length) {
    console.log('[schema] Workaround statement errors (may be benign re-applies):');
    for (const e of errors) console.log(`   - ${e}`);
  }
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS v8');

  // Extensions first (best-effort).
  try {
    await client.query(readFileSync(path.join(MIGRATIONS_DIR, 'init-pgvector.sql'), 'utf-8'));
  } catch (e) {
    console.warn('[schema] init-pgvector warn:', String(e.message || e).split('\n')[0]);
  }

  const files = discover();
  console.log(`[schema] Applying ${files.length} migration files (2 passes)...`);

  let failed = [];
  // Pass 1
  for (const f of files) {
    const r = await applyFile(client, f);
    if (!r.ok) failed.push(f);
  }
  console.log(`[schema] Pass 1: ${files.length - failed.length} ok, ${failed.length} failed`);

  // Pass 2 — retry failures (resolves ALTER-before-CREATE ordering).
  const stillFailed = [];
  for (const f of failed) {
    const r = await applyFile(client, f);
    if (!r.ok) stillFailed.push({ file: f, error: r.error });
  }
  console.log(
    `[schema] Pass 2: ${failed.length - stillFailed.length} recovered, ${stillFailed.length} still failing`
  );
  if (stillFailed.length) {
    console.log('[schema] Persistently failing files (usually non-critical: legacy/dupes):');
    for (const { file, error } of stillFailed.slice(0, 40)) {
      console.log(`   - ${file}: ${error}`);
    }
    if (stillFailed.length > 40) console.log(`   ... and ${stillFailed.length - 40} more`);
  }

  // Narrow, targeted fix for the giant-file implicit-transaction rollback
  // documented above — must run AFTER the two-pass loop so nothing later
  // can roll it back again.
  await applyKnownRollbackWorkarounds(client);

  // Verify required tables.
  const required = [
    'organizations',
    'users',
    'notebook_pages',
    'notebooks',
    'tp_tables',
    'ai_agent_plans',
    'ai_agent_plan_steps',
    'assessments',
    'interview_insights',
    'artifact_evidence',
    'presentation_ai_operations',
    'ai_grounding_logs',
    'organization_members',
    'revoked_tokens',
    'user_sessions',
  ];
  console.log('[schema] Required-table verification (to_regclass):');
  let missing = [];
  for (const t of required) {
    const { rows } = await client.query('SELECT to_regclass($1) AS reg', [`public.${t}`]);
    const present = rows[0].reg !== null;
    if (!present) missing.push(t);
    console.log(`   ${present ? 'OK  ' : 'MISS'} ${t}`);
  }
  // Non-critical spot-check for the two workaround targets (informational —
  // does not affect the critical-missing exit code below, which is scoped to
  // the pre-existing `required` list).
  const workaroundTargets = [
    ['public.canonical_inbox_items', 'canonical_inbox_items'],
    ['v8.v8_feature_flags', 'v8.v8_feature_flags'],
  ];
  console.log('[schema] Known-rollback-workaround verification (to_regclass):');
  for (const [reg, label] of workaroundTargets) {
    const { rows } = await client.query('SELECT to_regclass($1) AS reg', [reg]);
    console.log(`   ${rows[0].reg !== null ? 'OK  ' : 'MISS'} ${label}`);
  }

  await client.end();

  console.log(
    `[schema] DONE. missing=${missing.length ? missing.join(',') : 'none'}`
  );
  // artifact_evidence is a phantom (never defined in codebase) — don't fail on it alone.
  const criticalMissing = missing.filter((t) => t !== 'artifact_evidence');
  if (criticalMissing.length) {
    console.error(`[schema] CRITICAL missing: ${criticalMissing.join(',')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[schema] FATAL', e);
  process.exit(1);
});
