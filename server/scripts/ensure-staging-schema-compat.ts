#!/usr/bin/env tsx
import '../src/config/loadEnv.js';

/**
 * Ensure STAGING DB schema is compatible with current backend expectations.
 *
 * Goal:
 * - Create missing tables used by current routes/services.
 * - Add missing columns safely (IF NOT EXISTS).
 * - Avoid destructive changes (no drops, no type rewrites).
 *
 * Usage:
 *   ENV_FILE=.env.staging.local npx tsx server/scripts/ensure-staging-schema-compat.ts
 */

import { Pool } from 'pg';

import {
  assertNoPrivateRailwayDbHostOutsideRailway,
  resolveReachableDatabaseUrl,
} from '../src/config/databaseTargetResolver.js';

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
  console.warn(`[ensure-staging-schema-compat] ${resolvedDb.reason}`);
}

const pool = new Pool({ connectionString: databaseUrl });

async function exec(sql: string) {
  await pool.query(sql);
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     LIMIT 1`,
    [table, column]
  );
  return (r.rows || []).length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema='public' AND table_name=$1
     LIMIT 1`,
    [table]
  );
  return (r.rows || []).length > 0;
}

async function ensureColumn(table: string, column: string, ddl: string) {
  if (await columnExists(table, column)) return;
  await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${ddl};`);
}

function idDefaultText(): string {
  // No extensions required. Good enough for IDs in staging.
  return `md5(random()::text || clock_timestamp()::text)`;
}

async function main() {
  // Keep DDL from hanging forever on staging.
  // (If something is locking a table, we want a quick/clear failure signal.)
  await exec(`SET statement_timeout TO '60s';`);
  await exec(`SET lock_timeout TO '5s';`);

  // --- Presentations (T058/T059) ---
  await exec(`
    CREATE TABLE IF NOT EXISTS brand_kits (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT 'Default',
      logo_url TEXT,
      primary_color TEXT DEFAULT '003A70',
      secondary_color TEXT DEFAULT '2C5F8A',
      accent_color TEXT DEFAULT '00AA55',
      font_title TEXT DEFAULT 'Calibri Light',
      font_body TEXT DEFAULT 'Calibri',
      footer_text TEXT,
      header_text TEXT,
      show_page_numbers BOOLEAN DEFAULT TRUE,
      show_confidentiality BOOLEAN DEFAULT TRUE,
      confidentiality_default TEXT DEFAULT 'internal',
      disclaimer_text TEXT,
      watermark_text TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_brand_kits_org ON brand_kits(organization_id);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS presentation_templates (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      deck_type TEXT NOT NULL,
      audience TEXT DEFAULT 'executive',
      goal TEXT DEFAULT 'inform',
      language_default TEXT DEFAULT 'en',
      confidentiality_default TEXT DEFAULT 'internal',
      theme TEXT DEFAULT 'corporate',
      outline_json TEXT NOT NULL DEFAULT '[]',
      max_slides INTEGER DEFAULT 25,
      min_slides INTEGER DEFAULT 5,
      must_have_intents TEXT DEFAULT '[]',
      recommended_visuals TEXT DEFAULT '[]',
      is_system BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      cloned_from TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pt_org ON presentation_templates(organization_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pt_type ON presentation_templates(deck_type);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pt_system ON presentation_templates(is_system);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS presentation_decks (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      template_id TEXT,
      deck_type TEXT,
      audience TEXT,
      goal TEXT,
      language TEXT DEFAULT 'en',
      confidentiality TEXT DEFAULT 'internal',
      theme TEXT DEFAULT 'corporate',
      brand_kit_id TEXT,
      source_artifacts TEXT,
      outline_json TEXT,
      unified_json TEXT,
      slide_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      export_path TEXT,
      export_format TEXT,
      exported_at TIMESTAMPTZ,
      share_token TEXT,
      share_expires_at TIMESTAMPTZ,
      validation_warnings TEXT,
      generated_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pd_org ON presentation_decks(organization_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pd_project ON presentation_decks(project_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_pd_status ON presentation_decks(status);`);

  // --- People / Change / Comms (T043/T045) ---
  // Capabilities table in staging may be an older global catalog. We patch it to satisfy current services
  // without breaking existing rows.
  if (await tableExists('capabilities')) {
    // Current backend expects org-scoped capabilities with boolean `is_active` and `domain/tags`.
    // Some older staging DBs have a global capability catalog with `code` NOT NULL and no org/domain fields.
    // We keep legacy columns but relax constraints so new inserts (without `code`) won't fail.
    const codeCol = await columnExists('capabilities', 'code');
    if (codeCol) {
      try {
        await exec(`ALTER TABLE capabilities ALTER COLUMN code DROP NOT NULL;`);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ensure-staging-schema-compat] WARN: failed to DROP NOT NULL on capabilities.code (will try default).',
          e?.message || e
        );
      }
      try {
        await exec(`ALTER TABLE capabilities ALTER COLUMN code SET DEFAULT (${idDefaultText()});`);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ensure-staging-schema-compat] WARN: failed to SET DEFAULT on capabilities.code.',
          e?.message || e
        );
      }
    }

    await ensureColumn('capabilities', 'organization_id', `organization_id TEXT`);
    await ensureColumn('capabilities', 'domain', `domain TEXT DEFAULT 'general'`);
    await ensureColumn('capabilities', 'tags', `tags JSONB DEFAULT '[]'::jsonb`);
    await ensureColumn('capabilities', 'is_active', `is_active BOOLEAN NOT NULL DEFAULT TRUE`);
    await ensureColumn('capabilities', 'created_by', `created_by TEXT`);
    await ensureColumn('capabilities', 'updated_at', `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    // Helpful indexes for current queries
    await exec(`CREATE INDEX IF NOT EXISTS idx_capabilities_org ON capabilities(organization_id);`);
    await exec(
      `CREATE INDEX IF NOT EXISTS idx_capabilities_org_domain ON capabilities(organization_id, domain);`
    );
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS user_capabilities (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
      certifications JSONB DEFAULT '[]'::jsonb,
      notes TEXT,
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, capability_id)
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON user_capabilities(user_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_user_capabilities_org ON user_capabilities(organization_id);`);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_user_capabilities_cap ON user_capabilities(capability_id);`
  );

  await exec(`
    CREATE TABLE IF NOT EXISTS capability_requirements (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL,
      initiative_id TEXT,
      task_id TEXT,
      capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
      min_level INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 5),
      priority TEXT NOT NULL DEFAULT 'required',
      notes TEXT,
      headcount NUMERIC(5,1) DEFAULT NULL,
      justification TEXT DEFAULT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_cap_req_initiative ON capability_requirements(initiative_id);`
  );
  await exec(`CREATE INDEX IF NOT EXISTS idx_cap_req_task ON capability_requirements(task_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cap_req_org ON capability_requirements(organization_id);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS communication_plans (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL,
      initiative_id TEXT,
      cadence TEXT NOT NULL DEFAULT 'weekly',
      owner_user_id TEXT,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      next_due_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_comm_plans_org ON communication_plans(organization_id);`);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_comm_plans_initiative ON communication_plans(initiative_id);`
  );
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_comm_plans_next_due ON communication_plans(next_due_at) WHERE is_active = TRUE;`
  );

  // --- Financial Modeling (T054) ---
  await exec(`
    CREATE TABLE IF NOT EXISTS financial_models (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL,
      project_id TEXT,
      initiative_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      currency TEXT DEFAULT 'PLN',
      horizon_months INTEGER DEFAULT 60,
      start_date DATE,
      granularity TEXT DEFAULT 'monthly',
      scenario TEXT DEFAULT 'base',
      status TEXT DEFAULT 'draft',
      assumptions_json TEXT DEFAULT '{}',
      version INTEGER DEFAULT 1,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      approved_snapshot TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fm_org ON financial_models(organization_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fm_project ON financial_models(project_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fm_initiative ON financial_models(initiative_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fm_status ON financial_models(status);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS financial_model_events (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      model_id TEXT NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'PLN',
      period_start DATE,
      period_end DATE,
      recurrence TEXT DEFAULT 'one_time',
      growth_rate REAL DEFAULT 0,
      cf_classification TEXT DEFAULT 'none',
      posting_rules TEXT NOT NULL DEFAULT '{}',
      parameters TEXT DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fme_model ON financial_model_events(model_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fme_type ON financial_model_events(event_type);`);

  // Computed outputs + validations (required by /api/financial-modeling/* endpoints)
  await exec(`
    CREATE TABLE IF NOT EXISTS financial_model_outputs (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      model_id TEXT NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
      period_date DATE NOT NULL,
      period_label TEXT,
      statement_type TEXT NOT NULL,
      line_code TEXT NOT NULL,
      line_name TEXT NOT NULL,
      value REAL DEFAULT 0,
      scenario TEXT DEFAULT 'base',
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fmo_model ON financial_model_outputs(model_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fmo_period ON financial_model_outputs(period_date);`);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_fmo_stmt ON financial_model_outputs(statement_type);`
  );

  await exec(`
    CREATE TABLE IF NOT EXISTS financial_model_validations (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      model_id TEXT NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
      period_date DATE,
      check_code TEXT NOT NULL,
      check_name TEXT NOT NULL,
      status TEXT DEFAULT 'pass',
      expected_value REAL,
      actual_value REAL,
      difference REAL,
      message TEXT,
      details TEXT,
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_fmv_model ON financial_model_validations(model_id);`);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_fmv_status ON financial_model_validations(status);`
  );

  // --- Competency taxonomy (T065) ---
  // We keep it TEXT-based for org IDs to match existing organizations/users IDs.
  await exec(`
    CREATE TABLE IF NOT EXISTS competency_categories (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_pl TEXT,
      description TEXT,
      description_pl TEXT,
      icon TEXT DEFAULT 'Layers',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      is_system BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(
    `CREATE INDEX IF NOT EXISTS idx_comp_categories_org ON competency_categories(organization_id);`
  );

  await exec(`
    CREATE TABLE IF NOT EXISTS competency_levels (
      id TEXT PRIMARY KEY DEFAULT (${idDefaultText()}),
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      level_value INTEGER NOT NULL,
      label TEXT NOT NULL,
      label_pl TEXT,
      description TEXT,
      description_pl TEXT,
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, level_value)
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_comp_levels_org ON competency_levels(organization_id);`);

  // Ensure api_logs correlation_id (in case older staging DB)
  if (await tableExists('api_logs')) {
    await ensureColumn('api_logs', 'correlation_id', `correlation_id TEXT`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_correlation_id ON api_logs(correlation_id);`);
  }

  // --- API compatibility patches (legacy routes expect these columns) ---
  // status-reports.routes.ts expects: title, content, health, period
  if (await tableExists('status_reports')) {
    await ensureColumn('status_reports', 'title', `title TEXT`);
    await ensureColumn('status_reports', 'content', `content TEXT`);
    await ensureColumn('status_reports', 'health', `health TEXT`);
    await ensureColumn('status_reports', 'period', `period TEXT`);
  }

  // --- Tools library compatibility (V3-E01 / Known Tools library) ---
  // Some staging DBs have `tools` table without the V3 library columns (tool_type, tags, library content).
  if (await tableExists('tools')) {
    await ensureColumn('tools', 'tool_type', `tool_type TEXT`);
    await ensureColumn('tools', 'library_category', `library_category TEXT`);
    await ensureColumn('tools', 'library_content_translations', `library_content_translations TEXT`);
    await ensureColumn('tools', 'tags_json', `tags_json TEXT DEFAULT '[]'`);
  }

  // --- Report builder templates compatibility (V3-J01/I01) ---
  // Newer template migrations expect `is_active` flag.
  if (await tableExists('report_builder_templates')) {
    await ensureColumn('report_builder_templates', 'is_active', `is_active BOOLEAN DEFAULT TRUE`);
  }

  // raid.routes.ts expects: project_id, severity, created_by
  if (await tableExists('raid_items')) {
    await ensureColumn('raid_items', 'project_id', `project_id TEXT`);
    await ensureColumn('raid_items', 'severity', `severity TEXT`);
    await ensureColumn('raid_items', 'created_by', `created_by TEXT`);
  }

  // accessCodes.routes.ts + AccessCodeService expect modern columns on `access_codes`
  // (staging may contain a legacy access_codes table used by /api/auth/register accessCode flow)
  if (await tableExists('access_codes')) {
    await ensureColumn('access_codes', 'type', `type TEXT`);
    await ensureColumn('access_codes', 'created_by_user_id', `created_by_user_id TEXT`);
    await ensureColumn('access_codes', 'created_by_consultant_id', `created_by_consultant_id TEXT`);
    await ensureColumn('access_codes', 'target_email', `target_email TEXT`);
    await ensureColumn('access_codes', 'uses_count', `uses_count INTEGER NOT NULL DEFAULT 0`);
    await ensureColumn('access_codes', 'status', `status TEXT NOT NULL DEFAULT 'ACTIVE'`);
    await ensureColumn('access_codes', 'metadata_json', `metadata_json TEXT DEFAULT '{}'`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_access_codes_code_hash ON access_codes(code_hash);`);
  }

  // Report quick status
  const checks = [
    'presentation_templates',
    'brand_kits',
    'presentation_decks',
    'communication_plans',
    'financial_models',
    'financial_model_events',
    'competency_categories',
    'competency_levels',
    'user_capabilities',
    'capability_requirements',
  ];
  const res = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [checks]
  );
  // eslint-disable-next-line no-console
  console.log('[ensure-staging-schema-compat] ensured tables:', (res.rows || []).map((r) => r.table_name));
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (e) => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
    // eslint-disable-next-line no-console
    console.error('[ensure-staging-schema-compat] failed:', e?.message || e);
    process.exit(1);
  });

