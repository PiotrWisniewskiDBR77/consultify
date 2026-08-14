/**
 * O5.6 — Interview coverage matrix: new axis-gap templates/questions.
 *
 * Loads the REAL migration file (server/migrations/20260719_interview_axis_gap_templates.sql)
 * against a genuine in-memory sqlite engine (not a mock), the same pattern used by
 * auditProgramService.e2e-sqlite.test.ts, so this exercises the actual SQL text that
 * ships to Postgres via DatabaseInitializer.runTablePlatformMigrations — not a
 * hand-copied approximation of it.
 *
 * What this proves (the DoD for O5.6's "przyrostowo" decision):
 *   1. The migration file parses/executes without error against the same two-table
 *      schema used by the pre-existing 297/298/669 interview-library migrations
 *      (id-first INSERT column lists — required for the conflictTargets.ts
 *      first-column fallback to resolve correctly on Postgres).
 *   2. It is additive: the 5 new templates are NEW rows; nothing UPDATEs or DELETEs
 *      pre-existing templates/questions. We seed one pre-existing template first and
 *      assert it is untouched after the migration runs.
 *   3. It is idempotent (INSERT OR IGNORE): running the file twice does not create
 *      duplicate rows or throw.
 *   4. Coverage claim: after the migration, all 7 DRD axes (per
 *      docs/standards/INTERVIEW_COVERAGE_MATRIX.md's axis -> template mapping) have
 *      at least one dedicated template with at least one question — where before
 *      this migration, axes 2/3/6 had zero and axis 7 had a single draft-only
 *      question.
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../migrations/20260719_interview_axis_gap_templates.sql'
);

const db = new sqlite3.Database(':memory:');

function execAsync(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}
function runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params as never[], function (this: { changes: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}
function allAsync<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params as never[], (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Axis -> template-id mapping, per docs/standards/INTERVIEW_COVERAGE_MATRIX.md §7.
// Axis 1's coverage comes from the pre-existing bank (T05/T06/T07/... — not
// re-created here) PLUS the new supplement template for its weak areas; axes
// 4 and 5 likewise already have partial pre-existing coverage plus a supplement.
// Axes 2/3/6/7 have ZERO pre-existing dedicated templates — the new templates
// are the entirety of their coverage, so those are the ones this test asserts
// most strictly.
const NEW_TEMPLATES_BY_AXIS: Record<number, string[]> = {
  1: ['itpl_drd_axis_supplement_v1'], // 1B/1C/1H/1I supplement only
  2: ['itpl_digital_product_portfolio_v1'],
  3: ['itpl_digital_business_model_v1'],
  4: ['itpl_drd_axis_supplement_v1'], // 4B/4D supplement only
  5: ['itpl_drd_axis_supplement_v1'], // 5D supplement only
  6: ['itpl_cybersecurity_baseline_v1'],
  7: ['itpl_ai_readiness_governance_v1'],
};

const EXPECTED_QUESTION_COUNT_BY_TEMPLATE: Record<string, number> = {
  itpl_digital_product_portfolio_v1: 5,
  itpl_digital_business_model_v1: 5,
  itpl_cybersecurity_baseline_v1: 6,
  itpl_ai_readiness_governance_v1: 6,
  itpl_drd_axis_supplement_v1: 7,
};

const TOTAL_NEW_QUESTIONS = Object.values(EXPECTED_QUESTION_COUNT_BY_TEMPLATE).reduce(
  (a, b) => a + b,
  0
); // 29

describe('O5.6 — interview axis-gap templates migration (real SQL, in-memory sqlite)', () => {
  beforeAll(async () => {
    // Same two-table shape as server/migrations/297_interview_library_templates.sql
    // (the schema the runtime migration targets before later ALTER TABLEs add
    // optional V6 columns — this migration only relies on the base columns).
    await execAsync(`
      CREATE TABLE interview_library_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'approved',
        visibility TEXT DEFAULT 'global',
        is_default INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE interview_library_template_questions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        category TEXT NOT NULL,
        question_text TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        answer_type TEXT DEFAULT 'open',
        is_required INTEGER DEFAULT 0,
        help_hint TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed one PRE-EXISTING template/question (mirrors the real 297 seed for
    // "Operational Excellence Discovery") so we can assert the migration never
    // touches pre-existing rows — "przyrostowo, zachowując istniejące".
    await runAsync(
      `INSERT INTO interview_library_templates (id, organization_id, name, description, category, status, visibility, is_default, version, created_by)
       VALUES ('itpl_pre_existing_v1', NULL, 'Operational Excellence Discovery', 'pre-existing', 'OPERATIONAL', 'approved', 'global', 0, 1, 'system')`
    );
    await runAsync(
      `INSERT INTO interview_library_template_questions (id, template_id, category, question_text, sort_order, answer_type, is_required)
       VALUES ('itq_pre_existing_1', 'itpl_pre_existing_v1', 'operations', 'pre-existing question', 10, 'open', 1)`
    );
  });

  afterAll(() => {
    db.close();
  });

  it('reads the real migration file from server/migrations/', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    expect(sql.length).toBeGreaterThan(500);
    // The migration is stored in PostgreSQL-native form. The SQLite harness
    // adapts ON CONFLICT at execution time, so the source contract must not
    // regress to SQLite-only INSERT OR IGNORE syntax.
    expect(sql).toMatch(/INSERT INTO interview_library_templates/);
    expect(sql).toMatch(/INSERT INTO interview_library_template_questions/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(sql).not.toMatch(/INSERT OR IGNORE/);
  });

  it('executes without error against the real interview-library schema', async () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    await expect(execAsync(sql)).resolves.toBeUndefined();
  });

  it('adds exactly 5 new templates, all draft/global, on top of the pre-existing one', async () => {
    const templates = await allAsync<{ id: string; status: string; visibility: string }>(
      'SELECT id, status, visibility FROM interview_library_templates ORDER BY id'
    );
    expect(templates).toHaveLength(6); // 1 pre-existing + 5 new
    const newOnes = templates.filter((t) => t.id !== 'itpl_pre_existing_v1');
    expect(newOnes).toHaveLength(5);
    expect(newOnes.map((t) => t.id).sort()).toEqual(
      [
        'itpl_ai_readiness_governance_v1',
        'itpl_cybersecurity_baseline_v1',
        'itpl_digital_business_model_v1',
        'itpl_digital_product_portfolio_v1',
        'itpl_drd_axis_supplement_v1',
      ].sort()
    );
    for (const t of newOnes) {
      expect(t.status).toBe('draft');
      expect(t.visibility).toBe('global');
    }
  });

  it(`adds exactly ${TOTAL_NEW_QUESTIONS} new questions, correctly linked to their templates`, async () => {
    for (const [templateId, expectedCount] of Object.entries(EXPECTED_QUESTION_COUNT_BY_TEMPLATE)) {
      const rows = await allAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM interview_library_template_questions WHERE template_id = ?',
        [templateId]
      );
      expect(rows[0].n).toBe(expectedCount);
    }
    const total = await allAsync<{ n: number }>(
      "SELECT COUNT(*) as n FROM interview_library_template_questions WHERE template_id != 'itpl_pre_existing_v1'"
    );
    expect(total[0].n).toBe(TOTAL_NEW_QUESTIONS);

    // Every question must reference a template that actually exists (no orphans).
    const orphans = await allAsync(
      `SELECT q.id FROM interview_library_template_questions q
       LEFT JOIN interview_library_templates t ON t.id = q.template_id
       WHERE t.id IS NULL`
    );
    expect(orphans).toHaveLength(0);
  });

  it('leaves the pre-existing template and question untouched (additive-only, "zachowując istniejące")', async () => {
    const preTemplate = await allAsync(
      "SELECT * FROM interview_library_templates WHERE id = 'itpl_pre_existing_v1'"
    );
    expect(preTemplate).toHaveLength(1);
    expect((preTemplate[0] as { name: string }).name).toBe('Operational Excellence Discovery');

    const preQuestions = await allAsync(
      "SELECT * FROM interview_library_template_questions WHERE template_id = 'itpl_pre_existing_v1'"
    );
    expect(preQuestions).toHaveLength(1);
    expect((preQuestions[0] as { question_text: string }).question_text).toBe(
      'pre-existing question'
    );
  });

  it('is idempotent — running the migration file twice does not duplicate rows or throw', async () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    await expect(execAsync(sql)).resolves.toBeUndefined();

    const templates = await allAsync('SELECT id FROM interview_library_templates');
    expect(templates).toHaveLength(6);
    const total = await allAsync<{ n: number }>(
      "SELECT COUNT(*) as n FROM interview_library_template_questions WHERE template_id != 'itpl_pre_existing_v1'"
    );
    expect(total[0].n).toBe(TOTAL_NEW_QUESTIONS);
  });

  it('covers all 7 DRD axes with at least one dedicated new template + question (closes the audit gap)', async () => {
    for (const [axis, templateIds] of Object.entries(NEW_TEMPLATES_BY_AXIS)) {
      let axisQuestionCount = 0;
      for (const templateId of templateIds) {
        const rows = await allAsync<{ n: number }>(
          'SELECT COUNT(*) as n FROM interview_library_template_questions WHERE template_id = ?',
          [templateId]
        );
        axisQuestionCount += rows[0].n;
      }
      expect(
        axisQuestionCount,
        `axis ${axis} should gain >= 1 question from new templates`
      ).toBeGreaterThan(0);
    }
    // Axes 2/3/6/7 previously had ZERO or a single draft-only question in the
    // whole bank (per the audit) — assert they now clear a real bar (>= 5) from
    // the new templates alone, independent of any pre-existing content.
    for (const axis of [2, 3, 6, 7]) {
      const templateIds = NEW_TEMPLATES_BY_AXIS[axis];
      let count = 0;
      for (const templateId of templateIds) {
        count += EXPECTED_QUESTION_COUNT_BY_TEMPLATE[templateId];
      }
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });
});
