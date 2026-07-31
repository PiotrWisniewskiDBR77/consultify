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
      sqliteCtx.db.run(sql, params || [], function (this: { changes: number; lastID?: number }, err: Error | null) {
        if (err) {
          if (fallback) resolve({ success: false, error: err.message });
          else reject(err);
          return;
        }
        resolve({ success: true, changes: this.changes, lastID: this.lastID });
      });
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

describe('artifact-runs routes (sqlite-backed integration)', () => {
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

  it('persists a run through POST -> GET -> accept-plan -> materialize and rejects retry of completed', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-1' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-abc' });

    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO report_builder_templates (
          id, organization_id, source_type, report_type, sections_json, is_default, is_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'tpl-route-1',
          'org-a',
          'INTERVIEW',
          'INTERVIEW',
          JSON.stringify([
            {
              key: 'summary',
              type: 'summary',
              title: 'Summary',
              required: true,
              order: 1,
            },
          ]),
          1,
          0,
        ],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-1',
      contextSnapshotId: 'snap-1',
      goal: 'Create a board report',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.run.runStatus).toBe('planned');
    const runId = String(createRes.body.data.run.runId);

    const getRes = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toEqual(
      expect.objectContaining({
        runId,
        runStatus: 'planned',
        executionRunId: 'exec-run-1',
      }),
    );

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data).toEqual(
      expect.objectContaining({
        runId,
        runStatus: 'proposal_created',
        persistedRunStatus: 'proposal_created',
        effectiveRunStatus: 'proposal_created',
        proposalId: 'proposal-abc',
      }),
    );
    spineMocks.getRun.mockResolvedValue({ state: 'applying' });
    const divergentStatusRes = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(divergentStatusRes.status).toBe(200);
    expect(divergentStatusRes.body.data).toEqual(
      expect.objectContaining({
        persistedRunStatus: 'proposal_created',
        effectiveRunStatus: 'applying',
        runStatus: 'applying',
      }),
    );
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Board report',
      sourceType: 'INTERVIEW',
      sourceId: 'interview-1',
      sourceName: 'Founder interview',
      templateId: 'tpl-route-1',
      config: { audience: 'board' },
    });
    expect(materializeRes.status).toBe(200);
    expect(materializeRes.body.data).toEqual(
      expect.objectContaining({
        runId,
        runStatus: 'completed',
        persistedRunStatus: 'completed',
        effectiveRunStatus: 'completed',
      }),
    );
    expect(materializeRes.body.data.artifactId).toBeTruthy();

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(409);
    expect(retryRes.body.error).toEqual(
      expect.objectContaining({
        code: 'ARTIFACT_RUN_RETRY_NOT_ALLOWED',
        runId,
        runStatus: 'completed',
      }),
    );

    const historyRes = await request(app).get(`/api/artifact-runs/${runId}/history`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.map((item: any) => item.runId)).toEqual([runId]);
  });

  it.each(['failed', 'cancelled'])('creates one retry child for persisted %s', async (status) => {
    spineMocks.initiateHandoff
      .mockResolvedValueOnce({ executionRunId: `exec-parent-${status}` })
      .mockResolvedValueOnce({ executionRunId: `exec-child-${status}` });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: `conv-${status}`,
      contextSnapshotId: `snap-${status}`,
      goal: `Retry ${status} report`,
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `UPDATE v8_artifact_runs SET run_status = ?, updated_at = ?
         WHERE run_id = ? AND organization_id = ?`,
        [status, new Date().toISOString(), runId, 'org-a'],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data).toEqual(
      expect.objectContaining({
        retryOfRunId: runId,
        runStatus: 'planned',
        executionRunId: `exec-child-${status}`,
      }),
    );

    const parentRes = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(parentRes.status).toBe(200);
    expect(parentRes.body.data.runStatus).toBe(status);
  });

  it('materializes a presentation run through the governed artifact-run route', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-presentation-1' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-presentation-1' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-presentation-1',
      contextSnapshotId: 'snap-presentation-1',
      goal: 'Create a board presentation',
      requestedArtifactFamily: 'presentation',
      requestedOutputType: 'presentation',
    });

    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.runStatus).toBe('proposal_created');
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Board presentation',
      sourceType: 'tool',
      sourceId: 'tool-session-1',
      sourceName: 'Strategy workshop',
      config: {
        audience: 'executive',
        goal: 'decide',
        language: 'en',
        theme: 'modern',
        confidentiality: 'internal',
      },
    });

    expect(materializeRes.status).toBe(200);
    expect(materializeRes.body.data).toEqual(
      expect.objectContaining({
        runId,
        runStatus: 'completed',
      }),
    );
    expect(materializeRes.body.data.artifactId).toBeTruthy();
  });

  it('materializes a sheet run through the governed artifact-run route when a governed table target is provided', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-sheet-1' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-sheet-1' });
    await seedGovernedTable(sqliteCtx.db, {
      tableId: 'tbl-governed-1',
      organizationId: 'org-a',
      tableName: 'Governed matrix',
    });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-sheet-1',
      contextSnapshotId: 'snap-sheet-1',
      goal: 'Create a governed spreadsheet',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.run.plan.outputType).toBe('sheet');
    const runId = String(createRes.body.data.run.runId);

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.runStatus).toBe('proposal_created');
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });

    const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Governed matrix',
      config: {
        tableId: 'tbl-governed-1',
      },
    });

    expect(materializeRes.status).toBe(200);
    expect(materializeRes.body.data).toEqual(
      expect.objectContaining({
        runId,
        runStatus: 'completed',
      }),
    );
    expect(materializeRes.body.data.artifactId).toBeTruthy();
  });
});
