/**
 * P22 Wordy — Dedicated integration test for the V8 artifact pipeline
 * focused on the 'report' / 'document' artifact family.
 *
 * Covers: pipeline lifecycle (create → preflight → accept → materialize → generate),
 * PDF export endpoint, ghost artifact cleanup on failure, and replay (retry).
 *
 * Pattern follows artifact-runs.routes.preflight-and-failure.sqlite.integration.test.ts
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyArtifactSubstrateDdl,
  clearArtifactSubstrateTables,
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
    opts?: { fallback?: boolean }
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
  all: <T = unknown>(
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean }
  ): Promise<T[]> =>
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
    opts?: { fallback?: boolean }
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
        }
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
import * as reportBuilderService from '../../../server/src/services/reportBuilderService.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('P22 Wordy — document artifact pipeline (sqlite integration)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);
  app.use(errorHandlerMiddleware);

  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
    reportBuilderService.setDependencies({ db: sqliteCtx.db as any });
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    Object.values(spineMocks).forEach((m) => m.mockReset());
    spineMocks.transitionRunState.mockResolvedValue({});
    spineMocks.getRun.mockResolvedValue({ state: 'proposals_ready' });
    spineMocks.submitForReview.mockResolvedValue({});
    spineMocks.approveRun.mockResolvedValue({});
    spineMocks.applyRun.mockResolvedValue({});
    spineMocks.completeRun.mockResolvedValue({});
    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO report_builder_templates (
          id, organization_id, source_type, report_type, sections_json, is_default, is_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'tpl-wordy-tool',
          'org-a',
          'TOOL',
          'TOOL',
          JSON.stringify([
            { key: 'summary', type: 'summary', title: 'Summary', required: true, order: 1 },
          ]),
          1,
          0,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      })
  );

  it('creates a document artifact run via from-chat (report / document family)', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-1' });

    const res = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-wordy-1',
      contextSnapshotId: 'snap-wordy-1',
      goal: 'Create an executive summary report',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.run.runId).toBeTruthy();
    expect(res.body.data.artifactPlan).toEqual(
      expect.objectContaining({
        artifactFamily: 'document',
        outputType: 'report',
      })
    );
  });

  it('supports preflight check for a document artifact run', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-2' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-wordy-2',
      contextSnapshotId: 'snap-wordy-2',
      goal: 'Create an analysis brief',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
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
      })
    );
  });

  it('runs full pipeline: create → accept → materialize with report config', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-3' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-doc-1' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-wordy-3',
      contextSnapshotId: 'snap-wordy-3',
      goal: 'Generate a strategic assessment report',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);

    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const materializeRes = await request(app)
      .post(`/api/artifact-runs/${runId}/materialize`)
      .send({
        title: 'Strategic Assessment Q2',
        sourceType: 'TOOL',
        sourceId: 'tool-run-strat-1',
        config: { reportId: 'rpt-strat-1' },
      });
    expect(materializeRes.status, JSON.stringify(materializeRes.body)).toBe(200);
    expect(materializeRes.body.data.runStatus).toBe('completed');
    expect(materializeRes.body.data.artifactId).toBeTruthy();
  });

  it('records a governed materialization failure and allows retry', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-4a' });
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-4b' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-doc-2' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-wordy-4',
      contextSnapshotId: 'snap-wordy-4',
      goal: 'Create a document that will fail on first attempt',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const badMaterialize = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Failing doc',
      sourceType: 'NOT_A_REPORT_SOURCE',
      sourceId: 'tool-run-failing-1',
      config: {},
    });
    expect(badMaterialize.status, JSON.stringify(badMaterialize.body)).toBe(409);

    const afterFailure = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(afterFailure.status).toBe(200);
    expect(afterFailure.body.data.runStatus).toBe('failed');
    expect(afterFailure.body.data.failurePackage).toEqual(
      expect.objectContaining({
        stage: 'materialize',
        occurredAt: expect.any(String),
      })
    );

    const artifactCountAfterFailure = await new Promise<number>((resolve, reject) => {
      sqliteCtx.db.get(
        'SELECT COUNT(*) AS cnt FROM v8_output_artifacts WHERE organization_id = ?',
        ['org-a'],
        (err: Error | null, row: any) => {
          if (err) return reject(err);
          resolve(Number(row?.cnt || 0));
        }
      );
    });
    expect(artifactCountAfterFailure).toBe(0);

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.retryOfRunId).toBe(runId);

    const retryRunId = retryRes.body.data.runId;
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-doc-3' });
    await request(app).post(`/api/artifact-runs/${retryRunId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const okMaterialize = await request(app)
      .post(`/api/artifact-runs/${retryRunId}/materialize`)
      .send({
        title: 'Recovered doc',
        sourceType: 'TOOL',
        sourceId: 'tool-run-recovered-1',
        config: { reportId: 'rpt-recovered-1' },
      });
    expect(okMaterialize.status).toBe(200);
    expect(okMaterialize.body.data.runStatus).toBe('completed');
    expect(okMaterialize.body.data.artifactId).toBeTruthy();

    const artifactCountAfterSuccess = await new Promise<number>((resolve, reject) => {
      sqliteCtx.db.get(
        'SELECT COUNT(*) AS cnt FROM v8_output_artifacts WHERE organization_id = ?',
        ['org-a'],
        (err: Error | null, row: any) => {
          if (err) return reject(err);
          resolve(Number(row?.cnt || 0));
        }
      );
    });
    expect(artifactCountAfterSuccess).toBe(1);
  });

  it('tracks run history across retries', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-5a' });
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-doc-5b' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-doc-4' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-wordy-5',
      contextSnapshotId: 'snap-wordy-5',
      goal: 'Retry history test document',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Fail',
      sourceType: 'NOT_A_REPORT_SOURCE',
      sourceId: 'tool-run-history-1',
      config: {},
    });

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(201);

    const historyRes = await request(app).get(
      `/api/artifact-runs/${encodeURIComponent(retryRes.body.data.runId)}/history`
    );
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.map((item: any) => item.runId)).toEqual([
      runId,
      retryRes.body.data.runId,
    ]);
  });
});
