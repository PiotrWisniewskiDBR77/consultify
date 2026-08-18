import bcrypt from 'bcryptjs';
import express, { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/Config.js';
import adminAuditService from '../services/adminAuditService.js';
import { setV8OrgFlag } from '../services/v8/featureFlagService.js';
import { __resetApprovalServiceForTests } from '../services/documentStudio/documentApprovalService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = express.Router();

function makeSignedToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

function deny(res: Response) {
  // Intentionally looks like a missing route (to avoid hinting at capabilities).
  return res.status(404).json({ error: 'Not found' });
}

function assertEnabled(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.ENABLE_TEST_SUPPORT !== 'true') return false;

  const expected = process.env.TEST_SUPPORT_KEY;
  const got = req.header('x-test-support-key');
  if (!expected || expected.length < 12) return false;
  if (!got || got !== expected) return false;

  return true;
}

async function ensureRunsTable() {
  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS test_support_runs (
      run_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function isPostgres(): boolean {
  return (
    process.env.DB_TYPE === 'postgres' ||
    (!process.env.DB_TYPE && !!process.env.DATABASE_URL?.startsWith('postgres'))
  );
}

async function ensureWs4SqliteSchema(): Promise<void> {
  if (isPostgres()) return;

  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS initiative_kpis (
      id TEXT PRIMARY KEY,
      initiative_id TEXT,
      organization_id TEXT,
      name TEXT,
      description TEXT,
      category TEXT,
      unit TEXT,
      baseline_value REAL,
      target_value REAL,
      current_value REAL,
      progress_percentage REAL,
      status TEXT,
      measurement_frequency TEXT,
      trend_data TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS kpi_time_series (
      id TEXT PRIMARY KEY,
      kpi_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      value REAL NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT,
      source TEXT,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS initiative_kpi_mappings (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      impact_weight REAL,
      impact_direction TEXT,
      expected_delta REAL,
      expected_delta_unit TEXT,
      lag_days INTEGER,
      confidence TEXT,
      notes TEXT,
      definition_source TEXT,
      observation_phase TEXT,
      tracked_in_realization INTEGER,
      tracked_post_implementation INTEGER,
      observation_status TEXT,
      realization_baseline_value REAL,
      realization_target_value REAL,
      realization_measurement_frequency TEXT,
      post_implementation_baseline_value REAL,
      post_implementation_target_value REAL,
      post_implementation_measurement_frequency TEXT,
      created_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(initiative_id, kpi_id)
    );
  `);

  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS roi_assumptions (
      id TEXT PRIMARY KEY,
      initiative_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      capex REAL,
      opex_annual REAL,
      expected_roi_percent REAL,
      expected_npv REAL,
      expected_payback_months INTEGER,
      horizon_months INTEGER,
      baseline_revenue REAL,
      baseline_cost REAL,
      expected_revenue_delta REAL,
      expected_cost_delta REAL,
      effect_start_date TEXT,
      assumptions_text TEXT,
      assumptions_owner TEXT,
      confidence TEXT,
      last_updated_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(initiative_id)
    );
  `);

  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      category TEXT,
      planned_amount REAL,
      actual_amount REAL,
      currency TEXT,
      period_start TEXT,
      period_end TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function isMockDb(): boolean {
  return process.env.MOCK_DB === 'true';
}

async function ensureP25bKbSeedMinimum(): Promise<void> {
  if (!isMockDb()) {
    // Non-mock DB seeding is handled by ops/migrations (not enforced here).
    return;
  }

  // In E2E we run with a mock DB: create minimal KB schema + seed primers so Playwright is deterministic.
  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS kb_categories (
      id TEXT PRIMARY KEY,
      slug TEXT,
      icon TEXT,
      sort_order INTEGER,
      is_active INTEGER,
      is_public INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kb_category_translations (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      language TEXT,
      name TEXT,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS kb_articles (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      slug TEXT,
      status TEXT,
      is_featured INTEGER,
      is_public INTEGER,
      view_count INTEGER DEFAULT 0,
      reading_time_minutes INTEGER,
      thumbnail_url TEXT,
      video_url TEXT,
      video_teaser_url TEXT,
      related_modules TEXT,
      target_audience TEXT,
      next_action TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS kb_article_translations (
      id TEXT PRIMARY KEY,
      article_id TEXT,
      language TEXT,
      title TEXT,
      summary TEXT,
      content TEXT,
      video_script TEXT
    );
    CREATE TABLE IF NOT EXISTS kb_article_views (
      id TEXT PRIMARY KEY,
      article_id TEXT,
      user_id TEXT,
      session_id TEXT,
      source TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensure = async (
    checkSql: string,
    checkParams: unknown[],
    insertSql: string,
    insertParams: unknown[]
  ) => {
    const existing = await DbPromise.get(checkSql, checkParams, { fallback: false });
    if (existing) return;
    await DbPromise.run(insertSql, insertParams, { fallback: false });
  };

  const categoryId = 'kb-cat-p25b-pilot';
  await ensure(
    `SELECT id FROM kb_categories WHERE id = ?`,
    [categoryId],
    `INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES (?, ?, ?, ?, ?, ?)`,
    [categoryId, 'p25b-pilot', 'Sparkles', 999, 1, 1]
  );

  await ensure(
    `SELECT id FROM kb_category_translations WHERE id = ?`,
    ['kb-cat-trans-p25b-en'],
    `INSERT INTO kb_category_translations (id, category_id, language, name, description) VALUES (?, ?, ?, ?, ?)`,
    [
      'kb-cat-trans-p25b-en',
      categoryId,
      'en',
      'P25-B Pilot',
      'Seed minimum for contextual Help runtime verification (E2E).',
    ]
  );
  await ensure(
    `SELECT id FROM kb_category_translations WHERE id = ?`,
    ['kb-cat-trans-p25b-pl'],
    `INSERT INTO kb_category_translations (id, category_id, language, name, description) VALUES (?, ?, ?, ?, ?)`,
    [
      'kb-cat-trans-p25b-pl',
      categoryId,
      'pl',
      'P25-B Pilot',
      'Seed minimum dla weryfikacji runtime pomocy kontekstowej (E2E).',
    ]
  );

  // Tools primer
  await ensure(
    `SELECT id FROM kb_articles WHERE id = ?`,
    ['kb-art-p25b-tools-primer'],
    `INSERT INTO kb_articles (
      id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
      related_modules, target_audience, next_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-p25b-tools-primer',
      categoryId,
      'p25b-tools-primer',
      'published',
      1,
      1,
      3,
      '["discovery-tools","tools"]',
      '["all"]',
      '{"route":"/discovery-tools"}',
    ]
  );
  await DbPromise.run(
    `UPDATE kb_articles SET next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ['{"route":"/discovery-tools"}', 'kb-art-p25b-tools-primer'],
    { fallback: false }
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-tools-en'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-tools-en',
      'kb-art-p25b-tools-primer',
      'en',
      'Tools — start here (P25-B)',
      'P25-B primer: contextual help for the Tools surface (search → article → next action).',
      `# Tools — start here

This is the Tools primer used by the in-app Help runtime.

## What you can do here
- Search help articles
- Open an article
- Use **Next action** to return to the correct surface

## Next action
Use the button at the top of this article to go back to Tools.`,
    ]
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-tools-pl'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-tools-pl',
      'kb-art-p25b-tools-primer',
      'pl',
      'Tools — zacznij tutaj (P25-B)',
      'Primer P25-B: pomoc kontekstowa dla Tools (search → artykuł → next action).',
      `# Tools — zacznij tutaj

To jest primer dla runtime Help używany w P25-B.

## Co możesz zrobić
- Wyszukać artykuły
- Otworzyć artykuł
- Użyć **Next action**, aby wrócić do właściwej powierzchni

## Następny krok
Użyj przycisku u góry artykułu, aby wrócić do Tools.`,
    ]
  );

  // Interview primer
  await ensure(
    `SELECT id FROM kb_articles WHERE id = ?`,
    ['kb-art-p25b-interview-primer'],
    `INSERT INTO kb_articles (
      id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
      related_modules, target_audience, next_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-p25b-interview-primer',
      categoryId,
      'p25b-interview-primer',
      'published',
      1,
      1,
      3,
      '["interview"]',
      '["all"]',
      '{"route":"/interview"}',
    ]
  );
  await DbPromise.run(
    `UPDATE kb_articles SET next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ['{"route":"/interview"}', 'kb-art-p25b-interview-primer'],
    { fallback: false }
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-interview-en'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-interview-en',
      'kb-art-p25b-interview-primer',
      'en',
      'Interview — start here (P25-B)',
      'P25-B primer: contextual help for Interview (search → article → next action).',
      `# Interview — start here

Use Help to search for guidance and then continue work using **Next action**.`,
    ]
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-interview-pl'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-interview-pl',
      'kb-art-p25b-interview-primer',
      'pl',
      'Interview — zacznij tutaj (P25-B)',
      'Primer P25-B: pomoc kontekstowa dla Interview (search → artykuł → next action).',
      `# Interview — zacznij tutaj

Użyj Help, aby znaleźć wskazówki, a potem kontynuuj pracę przez **Next action**.`,
    ]
  );

  // Outputs primer
  await ensure(
    `SELECT id FROM kb_articles WHERE id = ?`,
    ['kb-art-p25b-outputs-primer'],
    `INSERT INTO kb_articles (
      id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
      related_modules, target_audience, next_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-p25b-outputs-primer',
      categoryId,
      'p25b-outputs-primer',
      'published',
      1,
      1,
      3,
      '["outputs","results"]',
      '["all"]',
      '{"route":"/presentations"}',
    ]
  );
  await DbPromise.run(
    `UPDATE kb_articles SET next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ['{"route":"/presentations"}', 'kb-art-p25b-outputs-primer'],
    { fallback: false }
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-outputs-en'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-outputs-en',
      'kb-art-p25b-outputs-primer',
      'en',
      'Outputs — start here (P25-B)',
      'P25-B primer: contextual help for Results/Outputs (search → article → next action).',
      `# Outputs — start here

Use Help to search for an article and continue with **Next action**.`,
    ]
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-outputs-pl'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-outputs-pl',
      'kb-art-p25b-outputs-primer',
      'pl',
      'Outputs — zacznij tutaj (P25-B)',
      'Primer P25-B: pomoc kontekstowa dla Results/Outputs (search → artykuł → next action).',
      `# Outputs — zacznij tutaj

Użyj Help, aby wyszukać artykuł, a potem kontynuuj przez **Next action**.`,
    ]
  );

  // EN-only article for explicit PL degraded + EN fallback
  await ensure(
    `SELECT id FROM kb_articles WHERE id = ?`,
    ['kb-art-p25b-en-only'],
    `INSERT INTO kb_articles (
      id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
      related_modules, target_audience, next_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-p25b-en-only',
      categoryId,
      'p25b-en-only',
      'published',
      0,
      1,
      2,
      '["discovery-tools","tools"]',
      '["all"]',
      '{"route":"/discovery-tools"}',
    ]
  );
  await DbPromise.run(
    `UPDATE kb_articles SET next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ['{"route":"/discovery-tools"}', 'kb-art-p25b-en-only'],
    { fallback: false }
  );

  await ensure(
    `SELECT id FROM kb_article_translations WHERE id = ?`,
    ['kb-art-trans-p25b-en-only-en'],
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'kb-art-trans-p25b-en-only-en',
      'kb-art-p25b-en-only',
      'en',
      'EN-only article (P25-B fallback proof)',
      'This article intentionally has no PL translation to prove explicit degraded + EN fallback.',
      `# EN-only article (P25-B fallback proof)

If you are in PL locale, the Help runtime should show an explicit banner and display this content in EN.`,
    ]
  );
}

async function listTables(): Promise<string[]> {
  const rows = await DbPromise.all<{ name: string }>(
    `SELECT table_name as name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    [],
    { fallback: false }
  );
  return rows.map((r) => r.name).filter((t) => typeof t === 'string' && t.length > 0);
}

async function listColumns(table: string): Promise<string[]> {
  const rows = await DbPromise.all<{ name: string }>(
    `SELECT column_name as name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
    { fallback: false }
  );
  return rows.map((r) => r.name).filter((c) => typeof c === 'string' && c.length > 0);
}

async function purgeByOrganizationId(organizationId: string): Promise<void> {
  // `presentation_analytics` is keyed ONLY by `deck_id` — it carries neither
  // `organization_id` nor `org_id`, so the generic loop below (which matches on
  // exactly those two columns) skips it entirely, and `deck_id` has no foreign
  // key to cascade from. Its rows therefore survived every cleanup as orphans
  // once this run's decks were deleted.
  //
  // Delete them FIRST, before the loop can remove `presentation_decks` and take
  // the only link to them away, and scope the delete to the exact deck ids this
  // run's organization owns — never a broad or global delete, so analytics rows
  // belonging to any other deck or tenant are left untouched.
  // Deliberately NOT wrapped in catch-and-continue like the generic loop below.
  // Swallowing a failure here would let `/cleanup` answer 200 after a PARTIAL
  // delete — reporting success while leaving exactly the orphan rows this code
  // exists to remove. `{ fallback: false }` makes DbPromise reject rather than
  // resolve null, and the rejection propagates through `asyncHandler` so the
  // endpoint fails closed and the caller sees it.
  await DbPromise.run(
    `DELETE FROM presentation_analytics
      WHERE deck_id IN (SELECT id FROM presentation_decks WHERE organization_id = ?)`,
    [organizationId],
    { fallback: false }
  );

  const tables = await listTables();
  for (const table of tables) {
    // Table names come from the DB, but we still harden to avoid SQL injection.
    if (!/^[a-zA-Z0-9_]+$/.test(table)) continue;
    if (table === 'organizations') continue;
    if (table === 'users') continue;

    let columns: string[];
    try {
      columns = await listColumns(table);
    } catch {
      continue;
    }

    const hasOrganizationId = columns.includes('organization_id');
    const hasOrgId = columns.includes('org_id');
    if (!hasOrganizationId && !hasOrgId) continue;

    const col = hasOrganizationId ? 'organization_id' : 'org_id';
    try {
      await DbPromise.run(`DELETE FROM ${table} WHERE ${col} = ?`, [organizationId], {
        fallback: false,
      });
    } catch (e) {
      logger.warn('[TestSupport] purgeByOrganizationId delete failed (continuing)', {
        table,
        error: (e as Error)?.message || e,
      });
    }
  }
}

router.post(
  '/bootstrap',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    const requestedRole = String(req.body?.role || 'ADMIN')
      .trim()
      .toUpperCase();

    // Accepted personas: SUPERADMIN, ADMIN, USER, GUEST
    const VALID_ROLES = ['SUPERADMIN', 'ADMIN', 'USER', 'GUEST'] as const;
    type ValidRole = (typeof VALID_ROLES)[number];
    const userRole: ValidRole = (VALID_ROLES as readonly string[]).includes(requestedRole)
      ? (requestedRole as ValidRole)
      : 'ADMIN';
    // org membership role maps platform SUPERADMIN → ADMIN (org member), others stay as-is
    const memberRole = userRole === 'SUPERADMIN' ? 'ADMIN' : userRole;
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }

    await ensureRunsTable();

    const existing = await DbPromise.get<{
      run_id: string;
      organization_id: string;
      user_id: string;
    }>(`SELECT run_id, organization_id, user_id FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    let organizationId = existing?.organization_id || '';
    let userId = existing?.user_id || '';

    if (!organizationId || !userId) {
      organizationId = uuidv4();
      userId = uuidv4();
      const memberId = uuidv4();
      const email = `e2e+${runId.replace(/[^a-zA-Z0-9_.-]/g, '-')}`.slice(0, 64) + '@local.test';

      await ensureWs4SqliteSchema();

      // An enterprise bootstrap must also identify as PAID to entitlement
      // guards. Older schemas may not carry organization_type, so retain a
      // narrow compatibility fallback for those test databases.
      try {
        await DbPromise.run(
          `INSERT INTO organizations (id, name, plan, status, is_active, organization_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [organizationId, `E2E Tenant (${runId})`, 'enterprise', 'active', 1, 'PAID'],
          { fallback: false }
        );
      } catch {
        await DbPromise.run(
          `INSERT INTO organizations (id, name, plan, status, is_active)
           VALUES (?, ?, ?, ?, ?)`,
          [organizationId, `E2E Tenant (${runId})`, 'enterprise', 'active', 1],
          { fallback: false }
        );
      }

      await DbPromise.run(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          organizationId,
          email,
          'e2e-not-used',
          userRole,
          'active',
          'E2E',
          userRole === 'SUPERADMIN'
            ? 'SuperAdmin'
            : userRole === 'ADMIN'
              ? 'Admin'
              : userRole === 'GUEST'
                ? 'Guest'
                : 'User',
        ],
        { fallback: false }
      );

      // Try to include permission_scope when the schema supports it.
      try {
        await DbPromise.run(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [memberId, organizationId, userId, memberRole, 'ACTIVE', JSON.stringify({ '*': true })],
          { fallback: false }
        );
      } catch {
        await DbPromise.run(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, organizationId, userId, memberRole, 'ACTIVE'],
          { fallback: false }
        );
      }

      await DbPromise.run(
        `INSERT INTO test_support_runs (run_id, organization_id, user_id)
         VALUES (?, ?, ?)`,
        [runId, organizationId, userId],
        { fallback: false }
      );
    }

    // P25-B: Ensure contextual help primers exist for deterministic runtime tests.
    await ensureP25bKbSeedMinimum();

    // When a test run explicitly enables the global V8 gate, materialize one
    // tenant-scoped flag as well. The frontend reads explicit org flags and must
    // not infer availability from the non-production backend fallback.
    if (process.env.ENABLE_V8_GLOBAL === 'true') {
      await setV8OrgFlag(organizationId, 'workspace', true, userId);
    }

    const displayName =
      userRole === 'SUPERADMIN'
        ? 'E2E SuperAdmin'
        : userRole === 'ADMIN'
          ? 'E2E Admin'
          : userRole === 'GUEST'
            ? 'E2E Guest'
            : 'E2E User';

    const token = makeSignedToken({
      id: userId,
      email: `e2e+${runId}@local.test`,
      name: displayName,
      role: userRole,
      organizationId,
      isSuperAdmin: userRole === 'SUPERADMIN',
      runId,
      jti: uuidv4(),
    });

    try {
      await adminAuditService.logAction({
        adminId: 'test-support',
        actionType: 'test_support_bootstrap',
        details: { runId, organizationId, env: process.env.NODE_ENV },
      });
    } catch {
      /* audit best-effort */
    }

    return res.status(200).json({
      runId,
      organizationId,
      userId,
      token,
    });
  })
);

router.post(
  '/member',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    const requestedRole = String(req.body?.role || 'USER')
      .trim()
      .toUpperCase();
    const validRoles = ['ADMIN', 'MANAGER', 'USER', 'GUEST'] as const;
    if (!(validRoles as readonly string[]).includes(requestedRole)) {
      return res.status(400).json({ error: 'Unsupported test-support member role' });
    }
    const userRole = requestedRole as (typeof validRoles)[number];
    // The canonical organization-membership schema intentionally has no
    // MANAGER enum; the signed platform persona normalizes MANAGER to
    // PROJECT_MANAGER while its active tenant membership uses the existing
    // ADMIN bucket. This is test-only identity construction, never a product
    // authorization shortcut (the normal auth/membership middleware still
    // validates the row on every mounted request).
    const memberRole = userRole === 'MANAGER' ? 'ADMIN' : userRole;
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }

    await ensureRunsTable();
    const run = await DbPromise.get<{
      organization_id: string;
    }>(`SELECT organization_id FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });
    if (!run?.organization_id) {
      return res.status(404).json({ error: 'Test support run not found' });
    }

    const userId = uuidv4();
    const memberId = uuidv4();
    const memberSuffix = userId.slice(0, 8);
    const email =
      `e2e+${runId.replace(/[^a-zA-Z0-9_.-]/g, '-')}-${memberSuffix}`.slice(0, 64) + '@local.test';

    await DbPromise.run(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        run.organization_id,
        email,
        'e2e-not-used',
        userRole,
        'active',
        'E2E',
        `Reviewer ${memberSuffix}`,
      ],
      { fallback: false }
    );

    try {
      await DbPromise.run(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          memberId,
          run.organization_id,
          userId,
          memberRole,
          'ACTIVE',
          JSON.stringify({ '*': true }),
        ],
        { fallback: false }
      );
    } catch {
      await DbPromise.run(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, ?, ?)`,
        [memberId, run.organization_id, userId, memberRole, 'ACTIVE'],
        { fallback: false }
      );
    }

    const token = makeSignedToken({
      id: userId,
      email,
      name: `E2E Reviewer ${memberSuffix}`,
      role: userRole,
      organizationId: run.organization_id,
      isSuperAdmin: false,
      runId,
      jti: uuidv4(),
    });

    return res.status(201).json({
      runId,
      organizationId: run.organization_id,
      userId,
      token,
    });
  })
);

/**
 * RBAC fixture for the UI-CANON G4 Audits lane.
 *
 * Deliberately issues NO token. It only creates real rows — organizations,
 * users with a bcrypt-hashed password, and `organization_members` — so the
 * harness can obtain every session through the production `POST /api/auth/login`
 * path (bcrypt compare + ACTIVE-membership check + the real token issuer).
 * Minting a token here would be exactly the auth bypass the G4 gate exists to
 * rule out, so this endpoint refuses to do it.
 *
 * Guarded by the same fail-closed `assertEnabled()` as every other test-support
 * route: never in production, requires ENABLE_TEST_SUPPORT=true and a matching
 * x-test-support-key.
 */
const RBAC_PERSONAS = [
  { key: 'platformAdmin', memberRole: 'OWNER', userRole: 'ADMIN', tenant: 'primary' },
  { key: 'leadAuditor', memberRole: 'CONSULTANT', userRole: 'USER', tenant: 'primary' },
  { key: 'auditee', memberRole: 'MEMBER', userRole: 'USER', tenant: 'primary' },
  { key: 'member', memberRole: 'MEMBER', userRole: 'USER', tenant: 'primary' },
  // Created ACTIVE on purpose: a token can only be "valid at issuance and
  // revoked afterwards" if the persona could genuinely log in first.
  { key: 'revokedMember', memberRole: 'MEMBER', userRole: 'USER', tenant: 'primary' },
  { key: 'foreignTenant', memberRole: 'OWNER', userRole: 'ADMIN', tenant: 'foreign' },
] as const;

async function insertOrganization(organizationId: string, name: string) {
  try {
    await DbPromise.run(
      `INSERT INTO organizations (id, name, plan, status, is_active, organization_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [organizationId, name, 'enterprise', 'active', 1, 'PAID'],
      { fallback: false }
    );
  } catch {
    await DbPromise.run(
      `INSERT INTO organizations (id, name, plan, status, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [organizationId, name, 'enterprise', 'active', 1],
      { fallback: false }
    );
  }
}

async function insertMembership(
  memberId: string,
  organizationId: string,
  userId: string,
  role: string,
  status: string
) {
  try {
    await DbPromise.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [memberId, organizationId, userId, role, status, JSON.stringify({ '*': true })],
      { fallback: false }
    );
  } catch {
    await DbPromise.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [memberId, organizationId, userId, role, status],
      { fallback: false }
    );
  }
}

router.post(
  '/rbac-fixture',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }
    const slug = runId.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 40);
    // Same bcrypt cost the production registration path spends (auth.routes.ts).
    const password = `G4-${slug}-Pass1!`;
    const hashed = bcrypt.hashSync(password, 8);

    const primaryOrgId = uuidv4();
    const foreignOrgId = uuidv4();
    await insertOrganization(primaryOrgId, `G4 Audits Tenant (${slug})`);
    await insertOrganization(foreignOrgId, `G4 Foreign Tenant (${slug})`);

    // Register the run so `/cleanup` can find and purge it. Without this the
    // fixture leaked two organizations, six users/members, a pack, a program
    // and a tenant flag row after every sweep.
    await ensureRunsTable();

    const created: Record<string, unknown> = {};
    try {
    for (const persona of RBAC_PERSONAS) {
      const userId = uuidv4();
      const organizationId = persona.tenant === 'foreign' ? foreignOrgId : primaryOrgId;
      const email = `g4+${slug}-${persona.key}@local.test`.toLowerCase();

      await DbPromise.run(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, organizationId, email, hashed, persona.userRole, 'active', 'G4', persona.key],
        { fallback: false }
      );
      await insertMembership(uuidv4(), organizationId, userId, persona.memberRole, 'ACTIVE');

      created[persona.key] = {
        userId,
        email,
        organizationId,
        memberRole: persona.memberRole,
        userRole: persona.userRole,
        tenant: persona.tenant,
      };
    }

    const anchorUserId = (created.platformAdmin as { userId: string }).userId;
    await DbPromise.run(
      `INSERT INTO test_support_runs (run_id, organization_id, user_id)
       VALUES (?, ?, ?)
       ON CONFLICT (run_id) DO UPDATE SET organization_id = EXCLUDED.organization_id,
                                          user_id = EXCLUDED.user_id`,
      [runId, primaryOrgId, anchorUserId],
      { fallback: false }
    );

    return res.status(201).json({
      runId,
      primaryOrgId,
      foreignOrgId,
      password,
      personas: created,
      note: 'No token issued by design — obtain every session through POST /api/auth/login.',
    });
    } catch (error) {
      // A partial failure used to leak whatever had already been inserted: the
      // caller never receives ids, so it cannot clean up what it never saw.
      // Roll the run back here instead, then report the original failure.
      for (const organizationId of [primaryOrgId, foreignOrgId]) {
        await DbPromise.run(`DELETE FROM organization_members WHERE organization_id = ?`, [
          organizationId,
        ], { fallback: true });
        await DbPromise.run(`DELETE FROM users WHERE organization_id = ?`, [organizationId], {
          fallback: true,
        });
        await DbPromise.run(`DELETE FROM organizations WHERE id = ?`, [organizationId], {
          fallback: true,
        });
      }
      await DbPromise.run(`DELETE FROM test_support_runs WHERE run_id = ?`, [runId], {
        fallback: true,
      });
      logger.warn('[TestSupport] rbac-fixture rolled back after a partial failure', {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'rbac-fixture failed and was rolled back',
        runId,
        detail: error instanceof Error ? error.message : String(error),
        rolledBack: true,
      });
    }
  })
);

/**
 * Flip an existing membership to a non-ACTIVE status, so the harness can prove
 * what a still-unexpired token issued *before* revocation can and cannot do.
 * `organization_members.status` has no CHECK constraint; every production check
 * compares `UPPER(status) = 'ACTIVE'`.
 */
router.post(
  '/revoke-membership',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const userId = String(req.body?.userId || '').trim();
    const organizationId = String(req.body?.organizationId || '').trim();
    const status = String(req.body?.status || 'REVOKED').trim().toUpperCase();
    if (!userId || !organizationId) {
      return res.status(400).json({ error: 'userId and organizationId are required' });
    }
    if (status === 'ACTIVE') {
      return res.status(400).json({ error: 'refusing to re-activate through the revoke route' });
    }

    await DbPromise.run(
      `UPDATE organization_members SET status = ? WHERE user_id = ? AND organization_id = ?`,
      [status, userId, organizationId],
      { fallback: false }
    );
    const row = await DbPromise.get<{ status: string }>(
      `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`,
      [userId, organizationId],
      { fallback: false }
    );
    // `api_logs.created_at` is `timestamp WITHOUT time zone` written from the
    // database's local clock, so a client-side ISO/UTC marker is offset by the
    // timezone and silently admits the wrong rows. Hand back the database's own
    // LOCALTIMESTAMP as the marker instead.
    const marker = await DbPromise.get<{ marker: string }>(
      `SELECT LOCALTIMESTAMP::text AS marker`,
      [],
      { fallback: false }
    );
    return res.json({
      userId,
      organizationId,
      status: row?.status ?? null,
      marker: marker?.marker ?? null,
    });
  })
);

/**
 * Enable a feature flag for ONE organization, WITHOUT touching the shared
 * `feature_flags` row.
 *
 * `feature_flags` is UNIQUE per `flag_key`: there is exactly one row per flag
 * for the whole installation. The previous version of this fixture borrowed
 * that row — rewriting its type, rules, variants and targets for the duration
 * of a run and restoring it afterwards. That was not acceptable. The production
 * definition was altered *while* the test ran, two parallel runs fought over the
 * same row, and a row that already carried a target never satisfied the
 * "nothing left to target" condition that triggered the restore.
 *
 * Overrides now live in `g4_test_flag_overrides` (migration
 * `20261002_g4_test_flag_overrides.sql`), one row per (organization, flag), and
 * `GET /api/feature-flags/runtime` merges them last and only when the
 * test-support gate is open. Production rows are never read or written, two runs
 * own different rows so they cannot collide, and a crashed run leaves only its
 * own row, identified by `run_id`.
 *
 * Only the flags this gate is allowed to touch are accepted; an arbitrary
 * `flagKey` is refused rather than silently honoured.
 */
const G4_OVERRIDABLE_FLAGS = new Set([
  'auditsFiveSurfacesV1',
  'financeStatementPackWorkspaceV2',
  'financeWorkspacePlatformV1',
  'financeExportImportV1',
]);

router.post(
  '/org-feature-flag',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const flagKey = String(req.body?.flagKey || '').trim();
    const organizationId = String(req.body?.organizationId || '').trim();
    const runId = String(req.body?.runId || '').trim() || null;
    const enabled = req.body?.enabled !== false;
    if (!flagKey || !organizationId) {
      return res.status(400).json({ error: 'flagKey and organizationId are required' });
    }
    if (!G4_OVERRIDABLE_FLAGS.has(flagKey)) {
      return res.status(400).json({
        error: 'flagKey is not in the G4 override allowlist',
        flagKey,
        allowed: [...G4_OVERRIDABLE_FLAGS],
      });
    }

    if (!enabled) {
      await DbPromise.run(
        `DELETE FROM g4_test_flag_overrides WHERE organization_id = ? AND flag_key = ?`,
        [organizationId, flagKey],
        { fallback: false }
      );
      return res.json({ flagKey, organizationId, enabled: false, removed: true });
    }

    await DbPromise.run(
      `INSERT INTO g4_test_flag_overrides (organization_id, flag_key, enabled, run_id)
       VALUES (?, ?, TRUE, ?)
       ON CONFLICT (organization_id, flag_key)
       DO UPDATE SET enabled = TRUE, run_id = EXCLUDED.run_id`,
      [organizationId, flagKey, runId],
      { fallback: false }
    );

    const row = await DbPromise.get<{ enabled: boolean; run_id: string | null }>(
      `SELECT enabled, run_id FROM g4_test_flag_overrides
        WHERE organization_id = ? AND flag_key = ?`,
      [organizationId, flagKey],
      { fallback: false }
    );
    return res.json({ flagKey, organizationId, override: row ?? null });
  })
);

/** Read-only view of a `feature_flags` row, so a test can prove it never changed. */
async function readFlagRow(flagKey: string) {
  return DbPromise.get<Record<string, unknown>>(
    `SELECT id, flag_key, name, description, enabled, rules, flag_type, targeting_rules,
            rollout_percentage, environment, organization_id, variants, created_by
       FROM feature_flags WHERE flag_key = ?`,
    [flagKey],
    { fallback: false }
  );
}

/**
 * Read, seed or drop one `feature_flags` row. Exists so the fixture's own
 * safety contract can set up a realistic pre-existing definition and then prove,
 * field for field, that borrowing it left no trace. Never used by the product.
 */
router.post(
  '/feature-flag-row',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const flagKey = String(req.body?.flagKey || '').trim();
    if (!flagKey) return res.status(400).json({ error: 'flagKey is required' });

    if (req.body?.delete === true) {
      await DbPromise.run(`DELETE FROM feature_flags WHERE flag_key = ?`, [flagKey], {
        fallback: true,
      });
      return res.json({ flagKey, deleted: true });
    }

    const write = req.body?.write as Record<string, unknown> | undefined;
    if (write) {
      await DbPromise.run(`DELETE FROM feature_flags WHERE flag_key = ?`, [flagKey], {
        fallback: true,
      });
      await DbPromise.run(
        `INSERT INTO feature_flags
           (id, flag_key, name, description, enabled, rules, flag_type, targeting_rules,
            rollout_percentage, environment, organization_id, variants, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          flagKey,
          write.name ?? flagKey,
          write.description ?? null,
          write.enabled ?? false,
          write.rules ?? null,
          write.flag_type ?? 'boolean',
          write.targeting_rules ?? '[]',
          write.rollout_percentage ?? 0,
          write.environment ?? 'production',
          write.organization_id ?? null,
          write.variants ?? '[]',
          write.created_by ?? null,
        ],
        { fallback: false }
      );
    }

    const row = await readFlagRow(flagKey);
    return res.json({ flagKey, row: row ?? null });
  })
);

/**
 * Count anything a fixture run could have left behind, so "residue 0" is a
 * measured number rather than an assurance.
 */
router.post(
  '/fixture-residue',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const organizationIds = Array.isArray(req.body?.organizationIds)
      ? (req.body.organizationIds as unknown[]).map((id) => String(id)).filter(Boolean)
      : [];
    if (!organizationIds.length) {
      return res.status(400).json({ error: 'organizationIds is required' });
    }

    const counts: Record<string, number> = {};
    const countIn = async (label: string, sql: string) => {
      const row = await DbPromise.get<{ count: string }>(sql, [organizationIds], {
        fallback: true,
      });
      counts[label] = Number(row?.count ?? 0);
    };

    await countIn('organizations', `SELECT COUNT(*)::text AS count FROM organizations WHERE id = ANY(?)`);
    await countIn('users', `SELECT COUNT(*)::text AS count FROM users WHERE organization_id = ANY(?)`);
    await countIn(
      'organization_members',
      `SELECT COUNT(*)::text AS count FROM organization_members WHERE organization_id = ANY(?)`
    );
    await countIn(
      'audit_programs',
      `SELECT COUNT(*)::text AS count FROM audit_programs WHERE organization_id = ANY(?)`
    );
    await countIn(
      'audit_packs',
      `SELECT COUNT(*)::text AS count FROM audit_packs WHERE organization_id = ANY(?)`
    );
    await countIn(
      'g4_test_flag_overrides',
      `SELECT COUNT(*)::text AS count FROM g4_test_flag_overrides WHERE organization_id = ANY(?)`
    );

    return res.json({ organizationIds, counts });
  })
);

/**
 * How many request-telemetry rows exist for a user on a path prefix. Used to
 * show that a refused caller left no trace, not merely no data.
 */
router.post(
  '/telemetry-count',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const userId = String(req.body?.userId || '').trim();
    const pathPrefix = String(req.body?.pathPrefix || '').trim();
    // Only rows created at or after this instant are counted. Without it the
    // legitimate, still-authorised requests a persona made *before* revocation
    // would be counted against it.
    const since = String(req.body?.since || '').trim() || null;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // `api_logs` records the route as `endpoint`, not `path`.
    //
    // Access logging runs before authentication, so a refused request is
    // logged too — that is correct security logging, not a leak. What must be
    // zero is a *successful* request attributed to the caller, so the counts
    // are split rather than lumped together.
    const row = await DbPromise.get<{ total: string; succeeded: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 400)::text AS succeeded
         FROM api_logs
        WHERE user_id = ?
          AND ($2 = '' OR endpoint LIKE $2 || '%')
          AND ($3::timestamp IS NULL OR created_at >= $3::timestamp)`,
      [userId, pathPrefix, since],
      { fallback: true }
    );
    return res.json({
      userId,
      pathPrefix,
      since,
      total: Number(row?.total ?? 0),
      succeeded: Number(row?.succeeded ?? 0),
      count: Number(row?.succeeded ?? 0),
    });
  })
);

/**
 * Purge everything an `/rbac-fixture` run created: both tenants, all six
 * personas and their memberships, every organization-scoped row the shared
 * purge helper knows about, this run's targeting entry in the fixture flag, and
 * the run registration itself. Idempotent, and scoped strictly to the two
 * organizations this run owns, so a parallel run is untouched.
 */
router.post(
  '/rbac-fixture/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    const organizationIds = Array.isArray(req.body?.organizationIds)
      ? (req.body.organizationIds as unknown[]).map((id) => String(id)).filter(Boolean)
      : [];
    const flagKeys = Array.isArray(req.body?.flagKeys)
      ? (req.body.flagKeys as unknown[]).map((k) => String(k)).filter(Boolean)
      : [];
    if (!runId && !organizationIds.length) {
      return res.status(400).json({ error: 'runId or organizationIds is required' });
    }

    // Remove only this run's own override rows. Each run owns a distinct
    // (organization, flag) row, so there is nothing to coordinate: deleting
    // mine cannot affect a parallel run's, and no production definition is
    // read, written or deleted anywhere in this path.
    const flagsCleared: Record<string, string[]> = {};
    const flagsRestored: Record<string, string> = {};
    for (const flagKey of flagKeys) {
      const removed = await DbPromise.run(
        `DELETE FROM g4_test_flag_overrides
          WHERE flag_key = ? AND organization_id = ANY(?)`,
        [flagKey, organizationIds],
        { fallback: true }
      );
      flagsCleared[flagKey] = organizationIds;
      flagsRestored[flagKey] = `${removed.changes ?? 0} override row(s) removed; production definition untouched`;
    }

    for (const organizationId of organizationIds) {
      await purgeByOrganizationId(organizationId);
      await DbPromise.run(`DELETE FROM organization_members WHERE organization_id = ?`, [
        organizationId,
      ], { fallback: true });
      await DbPromise.run(`DELETE FROM users WHERE organization_id = ?`, [organizationId], {
        fallback: true,
      });
      await DbPromise.run(`DELETE FROM organizations WHERE id = ?`, [organizationId], {
        fallback: true,
      });
    }

    if (runId) {
      await DbPromise.run(`DELETE FROM test_support_runs WHERE run_id = ?`, [runId], {
        fallback: true,
      });
    }

    const remainingOrgs = organizationIds.length
      ? await DbPromise.get<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM organizations WHERE id = ANY(?)`,
          [organizationIds],
          { fallback: true }
        )
      : { count: '0' };

    return res.json({
      runId,
      organizationIds,
      flagsCleared,
      flagsRestored,
      residualOrganizations: Number(remainingOrgs?.count ?? 0),
    });
  })
);

/**
 * Test-only cold-read boundary for Document Studio approvals.
 *
 * This intentionally clears only the process-local approval registry. Durable
 * rows remain untouched, so the next product API read must hydrate from the
 * configured database. The endpoint is protected by the same non-production
 * key gate as every other test-support operation.
 */
router.post(
  '/document-approval-cache/reset',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    __resetApprovalServiceForTests();
    return res.status(204).end();
  })
);

router.post(
  '/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }

    await ensureRunsTable();

    const existing = await DbPromise.get<{
      run_id: string;
      organization_id: string;
      user_id: string;
    }>(`SELECT run_id, organization_id, user_id FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    if (!existing) {
      return res.status(200).json({ ok: true, runId, deleted: false });
    }

    await purgeByOrganizationId(existing.organization_id);

    // Delete users/org at the end
    await DbPromise.run(`DELETE FROM users WHERE organization_id = ?`, [existing.organization_id], {
      fallback: false,
    });
    await DbPromise.run(`DELETE FROM organizations WHERE id = ?`, [existing.organization_id], {
      fallback: false,
    });
    await DbPromise.run(`DELETE FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    try {
      await adminAuditService.logAction({
        adminId: 'test-support',
        actionType: 'test_support_cleanup',
        details: { runId, organizationId: existing.organization_id, env: process.env.NODE_ENV },
      });
    } catch {
      /* audit best-effort */
    }

    return res.status(200).json({ ok: true, runId, deleted: true });
  })
);

export default router;
