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
  transitionRunState: vi.fn().mockResolvedValue({}),
  createProposal: vi.fn(),
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
  transitionRunState: (...args: unknown[]) => spineMocks.transitionRunState(...args),
  createProposal: (...args: unknown[]) => spineMocks.createProposal(...args),
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

import artifactRunsRouter from '../../../server/src/routes/artifact-runs.routes.js';

describe('artifact-runs routes (sqlite-backed integration)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);

  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    spineMocks.initiateHandoff.mockReset();
    spineMocks.transitionRunState.mockReset();
    spineMocks.createProposal.mockReset();
    spineMocks.transitionRunState.mockResolvedValue({});
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('persists a run through POST -> GET -> accept-plan -> retry', async () => {
    spineMocks.initiateHandoff
      .mockResolvedValueOnce({ executionRunId: 'exec-run-1' })
      .mockResolvedValueOnce({ executionRunId: 'exec-run-2' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-abc' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-1',
      contextSnapshotId: 'snap-1',
      goal: 'Create a board deck',
      requestedArtifactFamily: 'presentation',
      requestedOutputType: 'presentation',
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
        proposalId: 'proposal-abc',
      }),
    );

    const retryRes = await request(app).post(`/api/artifact-runs/${runId}/retry`).send({});
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data).toEqual(
      expect.objectContaining({
        retryOfRunId: runId,
        runStatus: 'planned',
        executionRunId: 'exec-run-2',
      }),
    );
  });
});
