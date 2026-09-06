/**
 * HARVARD H3 — DRD assessment round-trip contract (v8 assessment bridge).
 *
 * Proves the assessment reference chain against a REAL SQL store:
 *   create (DRD) → save axis answers → resume (GET) → partial update
 *   (name-only) does NOT clobber answers → P28 no-silent-scoring guard.
 *
 * The v8 PUT /assessment/:id handler implements merge-on-missing partial
 * updates (the pattern the tools chain was fixed to follow). These tests pin
 * that contract so a future "simplification" cannot reintroduce the
 * wipe-on-partial-save failure mode that broke tool sessions.
 *
 * Persistence seam (`queryHelpers`) is backed by in-memory SQLite; the
 * handlers' actual SQL executes and the resume GET reads physically stored
 * rows in a separate request.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---- Real in-memory SQLite behind the queryHelpers seam --------------------
const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

const sqlAll = <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
      err ? reject(err) : resolve((rows || []) as T[])
    );
  });
const sqlGet = <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
      err ? reject(err) : resolve((row || null) as T | null)
    );
  });
const sqlRun = (sql: string, params: unknown[] = []): Promise<{ changes: number }> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (sql: string, params: unknown[] = []) => sqlAll(sql, params),
  queryOne: (sql: string, params: unknown[] = []) => sqlGet(sql, params),
  queryRun: (sql: string, params: unknown[] = []) => sqlRun(sql, params),
  getTableColumns: async (tableName: string) => {
    const safe = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    return sqlAll<{ name: string }>(`PRAGMA table_info(${safe})`);
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---- Auth context + collaborators outside the persistence chain ------------
const ORG = 'org-drd-1';
const USER = 'user-drd-1';

vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => {
  const getV8Context = () => ({ organizationId: ORG, userId: USER, userRole: 'ADMIN' });
  return {
    getV8Context,
    requireV8OrgContext: (_req: any, _res: any, next: () => void) => next(),
    attachV8Context: (_req: any, _res: any, next: () => void) => next(),
    default: { getV8Context },
  };
});

// The assessments table is provisioned directly in this test (see beforeAll) —
// importing the real AssessmentController would drag its full dependency tree
// into the seam. normalizeStatus mirrors the real simplification contract.
vi.mock('../../../server/src/controllers/AssessmentController.js', () => ({
  ensureAssessmentSchema: vi.fn().mockResolvedValue(undefined),
  normalizeStatus: (status: string) => {
    const value = String(status || 'DRAFT').toUpperCase();
    if (['APPROVED', 'GENERATED', 'COMPLETED'].includes(value)) return 'COMPLETED';
    if (value === 'REVIEW') return 'REVIEW';
    if (value === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'DRAFT';
  },
}));

vi.mock('../../../server/src/services/assessment/AssessmentDefinitionService.js', () => ({
  default: {
    listDefinitionVersions: vi.fn().mockResolvedValue([]),
    getPublishedDefinition: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('../../../server/src/services/assessment/AssessmentWorkbenchService.js', () => ({
  default: {
    load: vi.fn(),
    recordPromotion: vi.fn(),
    applyMethodologyPreset: vi.fn(),
    setRequiredEvidenceKinds: vi.fn(),
  },
  assertPromotionPayloadShape: vi.fn().mockReturnValue({ ok: true, errors: [] }),
  buildBoundedPromotionPayload: vi.fn().mockReturnValue({}),
  buildWhatNextGuidance: vi.fn().mockReturnValue([]),
}));
vi.mock('../../../server/src/services/assessmentPermissionService.js', () => ({
  default: {
    getUserRole: vi.fn().mockResolvedValue({
      role: 'admin',
      permissions: { canView: true, canEdit: true, canApprove: true },
    }),
    getDefaultPermissions: vi.fn().mockReturnValue({
      canView: true,
      canEdit: true,
      canApprove: true,
    }),
  },
}));
vi.mock('../../../server/src/utils/AssessmentAuditLogger.js', () => {
  const assessmentAuditLogger = {
    logCreation: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return { assessmentAuditLogger, default: assessmentAuditLogger };
});

// ---- App under test ---------------------------------------------------------
let app: Express;

const DRD_ANSWERS = {
  axis1: { areaScores: { 'strategy-governance': [2, 4], 'data-management': [1, 3] } },
  axis2: { areaScores: { 'process-automation': [2, 3] } },
};

describe('H3 DRD assessment round-trip (create → save → resume → guarded update)', () => {
  let assessmentId = '';

  beforeAll(async () => {
    await sqlRun(
      `CREATE TABLE assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        assessment_type TEXT,
        -- 1.1-Z2 #4: PUT /:assessmentId (server/src/routes/v8/assessment.routes.ts)
        -- SELECTs framework_type — resolveAssessmentFramework/isDrdAssessmentRow
        -- (assessmentFramework.ts, odbiór 05.09) resolve the framework from
        -- COALESCE(framework_type, assessment_type, 'DRD'), a real column on the
        -- Postgres schema (\d assessments: framework_type text default 'DRD').
        -- This hand-rolled fixture predates that column and was missing it,
        -- so every PUT 500'd with "no such column: framework_type" (SQLITE_ERROR).
        framework_type TEXT DEFAULT 'DRD',
        name TEXT,
        status TEXT DEFAULT 'DRAFT',
        completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0,
        answers_json TEXT DEFAULT '{}',
        context_snapshot TEXT DEFAULT '{}',
        score_summary TEXT,
        p28_workbench_v1 TEXT,
        current_section_id TEXT,
        navigation_json TEXT,
        assessment_definition_id TEXT,
        assessment_definition_version TEXT,
        -- Odbiór 05.09 (05-ocena): kolumna JEDNOSTKA listy ocen
        -- (server/migrations/20260905_assessment_business_unit.sql).
        business_unit TEXT,
        created_by TEXT,
        updated_by TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    );
    await sqlRun(
      `CREATE TABLE assessment_sessions (
        id TEXT PRIMARY KEY, assessment_id TEXT, user_id TEXT, opened_at TEXT
      )`
    );

    const { default: v8AssessmentRoutes } = await import(
      '../../../server/src/routes/v8/assessment.routes.js'
    );
    app = express();
    app.use(express.json());
    app.use('/api/v8/assessment', v8AssessmentRoutes);
  });

  it('creates a DRD assessment (DRAFT)', async () => {
    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'DRD', name: 'DRD — Acme digital maturity' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.assessment.status).toBe('DRAFT');
    assessmentId = res.body.data.id;
  });

  it('rejects an unknown framework type', async () => {
    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'NOT-A-FRAMEWORK', name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ASSESSMENT_INVALID_TYPE');
  });

  it('saves axis answers + navigation and resumes them via GET', async () => {
    const put = await request(app)
      .put(`/api/v8/assessment/${assessmentId}`)
      .send({
        answers: DRD_ANSWERS,
        completionPercent: 30,
        navigation: { selectedAxis: 1, framework: 'drd' },
      });
    expect(put.status).toBe(200);

    const res = await request(app).get(`/api/v8/assessment/${assessmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.assessment.answers).toEqual(DRD_ANSWERS);
    expect(res.body.data.assessment.navigation).toEqual({ selectedAxis: 1, framework: 'drd' });
    expect(Number(res.body.data.assessment.completion_percent)).toBe(30);
  });

  it('a partial update (name only) must NOT clobber saved answers', async () => {
    const put = await request(app)
      .put(`/api/v8/assessment/${assessmentId}`)
      .send({ name: 'DRD — Acme digital maturity (renamed)' });
    expect(put.status).toBe(200);

    const res = await request(app).get(`/api/v8/assessment/${assessmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.assessment.name).toBe('DRD — Acme digital maturity (renamed)');
    // The whole point of resume: answers and navigation survive partial saves.
    expect(res.body.data.assessment.answers).toEqual(DRD_ANSWERS);
    expect(res.body.data.assessment.navigation).toEqual({ selectedAxis: 1, framework: 'drd' });
    expect(Number(res.body.data.assessment.completion_percent)).toBe(30);
  });

  it('resume is fail-soft on a corrupt answers blob (no 500)', async () => {
    await sqlRun(`UPDATE assessments SET answers_json = ? WHERE id = ?`, [
      '{corrupt!!',
      assessmentId,
    ]);
    const res = await request(app).get(`/api/v8/assessment/${assessmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.assessment.answers).toEqual({});
    await sqlRun(`UPDATE assessments SET answers_json = ? WHERE id = ?`, [
      JSON.stringify(DRD_ANSWERS),
      assessmentId,
    ]);
  });

  it('P28 no-silent-scoring: direct scoreSummary writes are refused once a workbench exists', async () => {
    await sqlRun(`UPDATE assessments SET p28_workbench_v1 = ? WHERE id = ?`, [
      JSON.stringify({ runState: 'running' }),
      assessmentId,
    ]);
    const res = await request(app)
      .put(`/api/v8/assessment/${assessmentId}`)
      .send({ scoreSummary: { overall: 5 } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('P28_NO_SILENT_SCORING');

    // And the guarded refusal must not have touched the stored answers.
    const after = await request(app).get(`/api/v8/assessment/${assessmentId}`);
    expect(after.body.data.assessment.answers).toEqual(DRD_ANSWERS);
  });
});
