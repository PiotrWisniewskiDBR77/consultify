/**
 * M12 — Audit Orchestrator end-to-end flow test against a REAL SQL engine
 * (in-memory sqlite3), not mocked db functions.
 *
 * Why this exists (H3.8): the sibling route test
 * (server/src/routes/__tests__/audit-programs.test.ts) stubs DbPromise's
 * all/get/run with vi.fn(), so it verifies the route wiring + call graph but
 * NEVER exercises the actual SQL strings. This test wires DbPromise to a genuine
 * in-memory sqlite database so every query auditProgramService issues runs for
 * real: the lazy CREATE TABLE, the org-scoped INSERT/SELECT/UPDATE, the SEC-3
 * assignee/template validation subqueries, the cartesian fan-out, and — most
 * importantly — the completion rollup's `GROUP BY status` over a real
 * interview_assignments table. That catches the repo's classic silent-failure
 * modes (snake/camel column drift, placeholder translation, empty-SELECT on a
 * maybe-absent table) that a fully-mocked test cannot.
 *
 * The one seam we mock is interviewAssignmentService.create — the fan-out reuses
 * the canonical assignment path (already covered by the interview module's own
 * tests), and its full create() carries side effects (mirror task, notifications).
 * Here it inserts a real assignment row into the SAME sqlite db so the subsequent
 * completion rollup queries genuine data.
 *
 * Flow asserted (create-from-preset → assign → simulate response → rollup moves):
 *   1. createProgram() from the ISO 27001 preset persists the full definition.
 *   2. generateSurveys() validates assignees (organization_members) + templates
 *      (interview_library_templates), fans out templates × assignees, records the
 *      generated assignment ids, and flips status draft → active.
 *   3. computeCompletion() reports 0% initially.
 *   4. Simulate a respondent submitting one survey (status → 'submitted').
 *   5. computeCompletion() now reflects the higher percentage — the rollup is live.
 */

import { randomUUID } from 'crypto';
import sqlite3 from 'sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Real in-memory sqlite, shared across the service + the mocked assignment
//    create() so the completion rollup queries real rows. ───────────────────────
const db = new sqlite3.Database(':memory:');

/** Translate `?` placeholders are already sqlite-native; sqlite3 accepts `?`. */
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
function getAsync<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params as never[], (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// ── Mock DbPromise to hit the real sqlite db. The service calls all/get/run with
//    (sql, params, options) — we ignore the options and pass through. ───────────
vi.mock('../../utils/DbPromise.js', () => ({
  all: (sql: string, params?: unknown[]) => allAsync(sql, params),
  get: (sql: string, params?: unknown[]) => getAsync(sql, params),
  run: (sql: string, params?: unknown[]) => runAsync(sql, params),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Mock the canonical assignment create() to insert a REAL row into the same db
//    (status starts 'assigned'), so completion rollup reads genuine data. ────────
const createAssignment = vi.fn(
  async (input: {
    organizationId: string;
    templateId: string;
    assigneeUserIds: string[];
    processRef?: string;
  }) => {
    const id = `ia_${randomUUID()}`;
    await runAsync(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, status, process_ref, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.assigneeUserIds[0],
        input.templateId,
        input.processRef || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return { id };
  }
);

vi.mock('../InterviewAssignmentService.js', () => ({
  default: { create: (...args: unknown[]) => createAssignment(args[0] as never) },
}));

// Import AFTER mocks so the service binds to the mocked modules.
import * as auditProgramService from '../auditProgramService.js';

const ORG = 'org-m12';
const OTHER_ORG = 'org-other';
const USER = 'user-consultant';
const ASSIGNEE_A = 'user-ciso';
const ASSIGNEE_B = 'user-itlead';
const FOREIGN_ASSIGNEE = 'user-foreign';
const TEMPLATE_1 = 'tpl-iso-a5';
const TEMPLATE_2 = 'tpl-iso-a9';
const FOREIGN_TEMPLATE = 'tpl-foreign';

async function seedFixtures(): Promise<void> {
  // AUD-MVP-OWNER-001: `ensureSchema()` used to lazily CREATE TABLE IF NOT
  // EXISTS audit_programs on first call — a second schema owner for a table
  // the Audits kernel migration also owns, which was part of the two-writer
  // defect this task closes. ensureSchema() is now a no-op (schema is owned
  // exclusively by the migration pipeline on a real DB), so THIS fixture must
  // now play the role the migration plays in production: create the table
  // before any service call runs. Mirrors the real schema (see
  // auditProgramService.ts's former CREATE TABLE + server/migrations/
  // 20260813_audits_method_core.sql section 0).
  await runAsync(`CREATE TABLE IF NOT EXISTS audit_programs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    preset TEXT,
    config TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await runAsync(
    `CREATE INDEX IF NOT EXISTS idx_audit_programs_org ON audit_programs(organization_id)`
  );

  // Supporting tables the service's SEC-3 guards + rollup query. The service
  // itself used to lazily create audit_programs; these are its dependencies.
  await runAsync(`CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT, user_id TEXT, status TEXT
  )`);
  await runAsync(`CREATE TABLE IF NOT EXISTS interview_library_templates (
    id TEXT, organization_id TEXT, template_scope TEXT
  )`);
  await runAsync(`CREATE TABLE IF NOT EXISTS interview_assignments (
    id TEXT PRIMARY KEY, organization_id TEXT, assignee_user_id TEXT, template_id TEXT,
    status TEXT NOT NULL DEFAULT 'assigned', process_ref TEXT,
    created_at TEXT, updated_at TEXT
  )`);

  // Two active org members + one member of another org (must be rejected by SEC-3).
  await runAsync(`INSERT INTO organization_members VALUES (?, ?, 'active')`, [ORG, ASSIGNEE_A]);
  await runAsync(`INSERT INTO organization_members VALUES (?, ?, 'active')`, [ORG, ASSIGNEE_B]);
  await runAsync(`INSERT INTO organization_members VALUES (?, ?, 'active')`, [
    OTHER_ORG,
    FOREIGN_ASSIGNEE,
  ]);

  // Two own-org templates + one foreign-org template (must be dropped by SEC-3).
  await runAsync(`INSERT INTO interview_library_templates VALUES (?, ?, NULL)`, [TEMPLATE_1, ORG]);
  await runAsync(`INSERT INTO interview_library_templates VALUES (?, ?, NULL)`, [TEMPLATE_2, ORG]);
  await runAsync(`INSERT INTO interview_library_templates VALUES (?, ?, NULL)`, [
    FOREIGN_TEMPLATE,
    OTHER_ORG,
  ]);
}

describe('M12 audit orchestrator — real-sqlite end-to-end flow', () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    createAssignment.mockClear();
  });

  it('creates a program from the ISO 27001 preset with the full definition persisted', async () => {
    const program = await auditProgramService.createProgram(ORG, USER, {
      name: 'ISO 27001 readiness',
      objective: 'Assess readiness against Annex A controls.',
      preset: 'iso27001',
      status: 'draft',
      config: {
        templateIds: [TEMPLATE_1, TEMPLATE_2],
        assigneeIds: [ASSIGNEE_A, ASSIGNEE_B],
        surveysGenerated: false,
      },
    });

    expect(program.id).toBeTruthy();
    expect(program.organizationId).toBe(ORG);
    expect(program.preset).toBe('iso27001');
    expect(program.status).toBe('draft');
    // config round-trips through the real JSON column
    expect(program.config.templateIds).toEqual([TEMPLATE_1, TEMPLATE_2]);
    expect(program.config.assigneeIds).toEqual([ASSIGNEE_A, ASSIGNEE_B]);

    // getProgram reads it back via a real org-scoped SELECT.
    const fetched = await auditProgramService.getProgram(ORG, program.id);
    expect(fetched?.name).toBe('ISO 27001 readiness');
    // Cross-org read is denied (org-scoped WHERE), returns null not a leak.
    expect(await auditProgramService.getProgram(OTHER_ORG, program.id)).toBeNull();
  });

  it('runs the full assign → simulate response → rollup-moves flow', async () => {
    // 1. Create the program (2 templates × 2 assignees, + 1 foreign of each to
    //    prove SEC-3 drops them from the fan-out).
    const program = await auditProgramService.createProgram(ORG, USER, {
      name: 'Flow program',
      preset: 'iso27001',
      status: 'draft',
      config: {
        templateIds: [TEMPLATE_1, TEMPLATE_2, FOREIGN_TEMPLATE],
        assigneeIds: [ASSIGNEE_A, ASSIGNEE_B, FOREIGN_ASSIGNEE],
        surveysGenerated: false,
      },
    });

    // 2. Fan out. Valid pairs = 2 templates × 2 assignees = 4 (foreign dropped).
    const gen = await auditProgramService.generateSurveys(ORG, USER, program.id);
    expect(gen).not.toBeNull();
    expect(gen?.alreadyGenerated).toBe(false);
    expect(gen?.requested).toBe(4);
    expect(gen?.created).toBe(4);
    expect(gen?.failed).toBe(0);
    // SEC-3: the canonical create() was called exactly 4× — never for the foreign
    // assignee or foreign template.
    expect(createAssignment).toHaveBeenCalledTimes(4);
    for (const call of createAssignment.mock.calls) {
      const arg = call[0] as { assigneeUserIds: string[]; templateId: string };
      expect(arg.assigneeUserIds[0]).not.toBe(FOREIGN_ASSIGNEE);
      expect(arg.templateId).not.toBe(FOREIGN_TEMPLATE);
    }
    // draft was promoted to active once surveys landed.
    expect(gen?.program.status).toBe('active');
    expect(gen?.program.config.surveysGenerated).toBe(true);
    expect(gen?.program.config.generatedAssignmentIds).toHaveLength(4);

    // 3. Completion rollup starts at 0% — all 4 assignments are 'assigned'.
    const before = await auditProgramService.computeCompletion(ORG, program.id);
    expect(before?.generated).toBe(true);
    expect(before?.total).toBe(4);
    expect(before?.done).toBe(0);
    expect(before?.percent).toBe(0);

    // 4. Simulate a respondent submitting one survey (status → 'submitted').
    const generatedIds = gen?.program.config.generatedAssignmentIds || [];
    await runAsync(`UPDATE interview_assignments SET status = 'submitted' WHERE id = ?`, [
      generatedIds[0],
    ]);
    // ...and a second one being fully approved.
    await runAsync(`UPDATE interview_assignments SET status = 'approved' WHERE id = ?`, [
      generatedIds[1],
    ]);

    // 5. The rollup is LIVE — it now reflects 2 of 4 done = 50%.
    const after = await auditProgramService.computeCompletion(ORG, program.id);
    expect(after?.total).toBe(4);
    expect(after?.done).toBe(2);
    expect(after?.percent).toBe(50);
    expect(after?.byStatus.submitted).toBe(1);
    expect(after?.byStatus.approved).toBe(1);
    expect(after?.byStatus.assigned).toBe(2);
  });

  it('is idempotent — a second generate does not re-fan-out', async () => {
    const program = await auditProgramService.createProgram(ORG, USER, {
      name: 'Idempotent program',
      status: 'draft',
      config: {
        templateIds: [TEMPLATE_1],
        assigneeIds: [ASSIGNEE_A],
        surveysGenerated: false,
      },
    });

    const first = await auditProgramService.generateSurveys(ORG, USER, program.id);
    expect(first?.created).toBe(1);
    createAssignment.mockClear();

    const second = await auditProgramService.generateSurveys(ORG, USER, program.id);
    expect(second?.alreadyGenerated).toBe(true);
    expect(second?.created).toBe(0);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('reports completion honestly when a tracked assignment goes missing', async () => {
    const program = await auditProgramService.createProgram(ORG, USER, {
      name: 'Missing-assignment program',
      status: 'draft',
      config: {
        templateIds: [TEMPLATE_1, TEMPLATE_2],
        assigneeIds: [ASSIGNEE_A],
        surveysGenerated: false,
      },
    });
    const gen = await auditProgramService.generateSurveys(ORG, USER, program.id);
    const ids = gen?.program.config.generatedAssignmentIds || [];
    expect(ids).toHaveLength(2);

    // Delete one underlying assignment (simulating a hard-deleted survey). The
    // rollup denominator is the recorded id count, so completion stays honest.
    await runAsync(`DELETE FROM interview_assignments WHERE id = ?`, [ids[0]]);

    const completion = await auditProgramService.computeCompletion(ORG, program.id);
    expect(completion?.total).toBe(2); // denominator unchanged
    expect(completion?.byStatus.missing).toBe(1); // surfaced honestly
  });

  it('returns not-generated completion before fan-out', async () => {
    const program = await auditProgramService.createProgram(ORG, USER, {
      name: 'Ungenerated program',
      status: 'draft',
      config: { templateIds: [TEMPLATE_1], assigneeIds: [ASSIGNEE_A], surveysGenerated: false },
    });
    const completion = await auditProgramService.computeCompletion(ORG, program.id);
    expect(completion).toEqual({ generated: false, total: 0, done: 0, percent: 0, byStatus: {} });
  });
});
