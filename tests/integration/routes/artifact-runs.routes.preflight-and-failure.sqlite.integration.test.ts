import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyArtifactSubstrateDdl,
  clearArtifactSubstrateTables,
  seedGovernedTable,
} from '../helpers/artifactSubstrateSqliteContext.js';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  const db = new sqlite3.Database(':memory:');
  return { db };
});

const spineMocks = vi.hoisted(() => ({
  initiateHandoff: vi.fn(),
  getRun: vi.fn().mockResolvedValue({ state: 'proposals_ready' }),
  transitionRunState: vi.fn().mockResolvedValue({}),
  createProposal: vi.fn(),
  submitForReview: vi.fn().mockResolvedValue({}),
  approveRun: vi.fn().mockResolvedValue({}),
  applyRun: vi.fn().mockResolvedValue({}),
  completeRun: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: <T = unknown>(
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean },
  ): Promise<T | null> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.get(sql, params || [], (err: Error | null, row: unknown) => {
        if (err) {
          if (fallback) resolve(null);
          else reject(err);
          return;
        }
        resolve((row || null) as T | null);
      });
    }),
  all: <T = unknown>(sql: string, params?: unknown[], opts?: { fallback?: boolean }): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.all(sql, params || [], (err: Error | null, rows: unknown[]) => {
        if (err) {
          if (fallback) resolve([]);
          else reject(err);
          return;
        }
        resolve((rows || []) as T[]);
      });
    }),
  run: (
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean },
  ): Promise<{ success: boolean; changes?: number; lastID?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.run(
        sql,
        params || [],
        function (this: { changes: number; lastID?: number }, err: Error | null) {
          if (err) {
            if (fallback) resolve({ success: false, error: err.message });
            else reject(err);
            return;
          }
          resolve({ success: true, changes: this.changes, lastID: this.lastID });
        },
      );
    }),
  default: {},
}));

vi.mock('../../../server/src/services/v8/chatExecutionService.js', () => ({
  initiateHandoff: (...args: unknown[]) => spineMocks.initiateHandoff(...args),
}));

vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({
  getRun: (...args: unknown[]) => spineMocks.getRun(...args),
  transitionRunState: (...args: unknown[]) => spineMocks.transitionRunState(...args),
  createProposal: (...args: unknown[]) => spineMocks.createProposal(...args),
  submitForReview: (...args: unknown[]) => spineMocks.submitForReview(...args),
  approveRun: (...args: unknown[]) => spineMocks.approveRun(...args),
  applyRun: (...args: unknown[]) => spineMocks.applyRun(...args),
  completeRun: (...args: unknown[]) => spineMocks.completeRun(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-a' };
    req.userId = 'user-1';
    req.organizationId = 'org-a';
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: any) => next(),
}));

import artifactRunsRouter from '../../../server/src/routes/artifact-runs.routes.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('artifact-runs preflight + failure packaging (sqlite integration)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);
  app.use(errorHandlerMiddleware);

  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    spineMocks.initiateHandoff.mockReset();
    spineMocks.getRun.mockReset();
    spineMocks.transitionRunState.mockReset();
    spineMocks.createProposal.mockReset();
    spineMocks.submitForReview.mockReset();
    spineMocks.approveRun.mockReset();
    spineMocks.applyRun.mockReset();
    spineMocks.completeRun.mockReset();
    spineMocks.transitionRunState.mockResolvedValue({});
    spineMocks.getRun.mockResolvedValue({ state: 'proposals_ready' });
    spineMocks.submitForReview.mockResolvedValue({});
    spineMocks.approveRun.mockResolvedValue({});
    spineMocks.applyRun.mockResolvedValue({});
    spineMocks.completeRun.mockResolvedValue({});
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('exposes a separate preflight stage for a planned run', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-1' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-1',
      contextSnapshotId: 'snap-1',
      goal: 'Create a governed spreadsheet',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });

    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    const preflightRes = await request(app).post(`/api/artifact-runs/${runId}/preflight`).send({});
    expect(preflightRes.status).toBe(200);
    expect(preflightRes.body.data.preflight).toEqual(
      expect.objectContaining({
        state: expect.any(String),
        computedAt: expect.any(String),
        checks: expect.any(Array),
      }),
    );
    expect(preflightRes.body.data.preflight.checks.map((c: any) => c.id)).toContain(
      'execution_run_resolvable',
    );
  });

  it('packages a controlled materialization failure and allows retry without ghost artifacts', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-1' });
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-2' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-sheet-1' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-sheet-1',
      contextSnapshotId: 'snap-sheet-1',
      goal: 'Create a governed spreadsheet',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    // Controlled failure: omit config.tableId for sheet materialization.
    const badMaterialize = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Governed matrix',
      config: {},
    });
    expect(badMaterialize.status).toBe(409);
    expect(badMaterialize.body.error).toEqual(
      expect.objectContaining({
        code: 'ARTIFACT_RUN_PREFLIGHT_BLOCKED',
        preflightState: 'attention_required',
        unmetChecks: expect.arrayContaining([
          expect.objectContaining({ id: 'materialization_target', status: 'failed' }),
        ]),
      }),
    );

    const afterFailure = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(afterFailure.status).toBe(200);
    expect(afterFailure.body.data.runStatus).toBe('failed');
    expect(afterFailure.body.data.failurePackage).toEqual(
      expect.objectContaining({
        stage: 'preflight',
        occurredAt: expect.any(String),
      }),
    );

    const artifactCountAfterFailure = await new Promise<number>((resolve, reject) => {
      sqliteCtx.db.get(
        `SELECT COUNT(*) AS cnt FROM v8_output_artifacts WHERE organization_id = ?`,
        ['org-a'],
        (err: Error | null, row: any) => {
          if (err) return reject(err);
          resolve(Number(row?.cnt || 0));
        },
      );
    });
    expect(artifactCountAfterFailure).toBe(0);

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.retryOfRunId).toBe(runId);

    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-sheet-2' });
    const acceptRetryRes = await request(app)
      .post(`/api/artifact-runs/${retryRes.body.data.runId}/accept-plan`)
      .send({});
    expect(acceptRetryRes.status).toBe(200);

    const historyRes = await request(app).get(
      `/api/artifact-runs/${encodeURIComponent(retryRes.body.data.runId)}/history`,
    );
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.map((item: any) => item.runId)).toEqual([runId, retryRes.body.data.runId]);

    // Successful retry materialization should create exactly one canonical artifact.
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });
    await seedGovernedTable(sqliteCtx.db, {
      tableId: 'tbl-governed-1',
      organizationId: 'org-a',
      tableName: 'Matrix',
    });
    const okMaterialize = await request(app)
      .post(`/api/artifact-runs/${retryRes.body.data.runId}/materialize`)
      .send({
        title: 'Governed matrix',
        config: { tableId: 'tbl-governed-1', tableName: 'Matrix' },
      });
    expect(okMaterialize.status).toBe(200);
    expect(okMaterialize.body.data.runStatus).toBe('completed');
    expect(okMaterialize.body.data.artifactId).toBeTruthy();

    const artifactCountAfterSuccess = await new Promise<number>((resolve, reject) => {
      sqliteCtx.db.get(
        `SELECT COUNT(*) AS cnt FROM v8_output_artifacts WHERE organization_id = ?`,
        ['org-a'],
        (err: Error | null, row: any) => {
          if (err) return reject(err);
          resolve(Number(row?.cnt || 0));
        },
      );
    });
    expect(artifactCountAfterSuccess).toBe(1);
  });
});
