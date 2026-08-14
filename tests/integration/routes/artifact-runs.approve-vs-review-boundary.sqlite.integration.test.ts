/**
 * P17 contract test: approve(run) ≠ review(artifact)
 *
 * Verifies the hard boundary between two trust layers:
 *   1. approve(run)   — governed execution approval via `/api/artifact-runs/:runId/accept-plan`
 *                        operates on the ArtifactRun *before* materialization
 *   2. review(artifact) — publish review via `startArtifactReview` / `/api/artifacts/:id/start-review`
 *                          operates on the canonical Artifact *after* materialization
 *
 * These must remain independent: approving a run must NOT trigger artifact review,
 * and artifact review must NOT be possible before materialization completes.
 */
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

const TEST_ORG_ID = '00000000-0000-4000-a000-000000000001';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000002';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: TEST_USER_ID, organizationId: TEST_ORG_ID };
    req.userId = TEST_USER_ID;
    req.organizationId = TEST_ORG_ID;
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
import * as artifactRegistryService from '../../../server/src/services/v8/artifactRegistryService.js';

function dbQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) => {
      if (err) return reject(err);
      resolve((rows || []) as T[]);
    });
  });
}

describe('P17 contract: approve(run) ≠ review(artifact) boundary', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);

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
    spineMocks.applyRun.mockResolvedValue({});
    spineMocks.completeRun.mockResolvedValue({});
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('accept-plan (run approval) does NOT create publish records or review gates on the artifact', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-boundary-1' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-boundary-1' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-boundary-1',
      contextSnapshotId: 'snap-boundary-1',
      goal: 'Create a board report for boundary test',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.runStatus).toBe('proposal_created');

    const publishRecords = await dbQuery(
      `SELECT * FROM v8_publish_records WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );
    expect(publishRecords).toHaveLength(0);

    const reviewGates = await dbQuery(
      `SELECT * FROM v8_review_gates WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );
    expect(reviewGates).toHaveLength(0);
  });

  it('materialize creates a canonical artifact but does NOT start artifact review', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-boundary-2' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-boundary-2' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-boundary-2',
      contextSnapshotId: 'snap-boundary-2',
      goal: 'Create a governed spreadsheet for boundary test',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });
    await seedGovernedTable(sqliteCtx.db, {
      tableId: 'tbl-boundary-1',
      organizationId: TEST_ORG_ID,
    });

    const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Boundary test sheet',
      config: { tableId: 'tbl-boundary-1' },
    });
    expect(materializeRes.status).toBe(200);
    expect(materializeRes.body.data.runStatus).toBe('completed');
    expect(materializeRes.body.data.artifactId).toBeTruthy();

    const artifacts = await dbQuery(
      `SELECT * FROM v8_output_artifacts WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );
    expect(artifacts.length).toBeGreaterThanOrEqual(1);

    const publishRecords = await dbQuery(
      `SELECT * FROM v8_publish_records WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );
    expect(publishRecords).toHaveLength(0);

    const reviewGates = await dbQuery(
      `SELECT * FROM v8_review_gates WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );
    expect(reviewGates).toHaveLength(0);
  });

  it('startArtifactReview requires a materialized artifact and is blocked before materialization', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-boundary-3' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-boundary-3' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-boundary-3',
      contextSnapshotId: 'snap-boundary-3',
      goal: 'Create a governed spreadsheet for review boundary test',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});

    const runBefore = await request(app).get(`/api/artifact-runs/${runId}`);
    expect(runBefore.body.data.artifactId).toBeNull();

    await expect(
      artifactRegistryService.startArtifactReview({
        artifactId: runId,
        organizationId: TEST_ORG_ID,
        actorUserId: TEST_USER_ID,
      }),
    ).rejects.toThrow();
  });

  it('startArtifactReview only works on a real artifact after materialization completes', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-boundary-4' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-boundary-4' });
    spineMocks.getRun.mockResolvedValue({ state: 'proposals_ready' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-boundary-4',
      contextSnapshotId: 'snap-boundary-4',
      goal: 'Create a governed spreadsheet for post-materialize review test',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });
    await seedGovernedTable(sqliteCtx.db, {
      tableId: 'tbl-boundary-4',
      organizationId: TEST_ORG_ID,
    });

    const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Review boundary sheet',
      config: { tableId: 'tbl-boundary-4' },
    });
    expect(materializeRes.status).toBe(200);
    const artifactId = String(materializeRes.body.data.artifactId);
    expect(artifactId).toBeTruthy();

    // After materialization, execution spine reports completed
    spineMocks.getRun.mockResolvedValue({ state: 'completed' });

    // Verify the artifact exists and passes validation checks before review.
    // source_grounded passes because registerArtifactOrigin sets contextSnapshotId.
    // execution_complete passes because spine mock returns 'completed'.
    // title_present passes because we supplied a title during materialization.
    const artifact = await dbQuery<{ title_snapshot: string; context_snapshot_id: string; execution_run_id: string }>(
      `SELECT title_snapshot, context_snapshot_id, execution_run_id FROM v8_output_artifacts WHERE artifact_id = ?`,
      [artifactId],
    );
    expect(artifact).toHaveLength(1);
    expect(artifact[0].title_snapshot).toBeTruthy();
    expect(artifact[0].context_snapshot_id).toBeTruthy();

    const reviewResult = await artifactRegistryService.startArtifactReview({
      artifactId,
      organizationId: TEST_ORG_ID,
      actorUserId: TEST_USER_ID,
    });

    expect(reviewResult.visibilityScope).toBe('review_shared');
    expect(reviewResult.publishState).toBeTruthy();

    const publishRecords = await dbQuery(
      `SELECT * FROM v8_publish_records WHERE artifact_id = ? AND organization_id = ?`,
      [artifactId, TEST_ORG_ID],
    );
    expect(publishRecords).toHaveLength(1);
  });

  it('records audit trail entries for each lifecycle transition', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-audit-1' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-audit-1' });
    spineMocks.getRun.mockResolvedValue({ state: 'proposals_ready' });

    const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-audit-1',
      contextSnapshotId: 'snap-audit-1',
      goal: 'Create a report for audit trail test',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });
    expect(createRes.status).toBe(201);
    const runId = String(createRes.body.data.run.runId);

    await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
    spineMocks.getRun.mockResolvedValue({ state: 'approved_for_apply' });
    await seedGovernedTable(sqliteCtx.db, {
      tableId: 'tbl-audit-1',
      organizationId: TEST_ORG_ID,
    });

    await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
      title: 'Audit trail test sheet',
      config: { tableId: 'tbl-audit-1' },
    });

    const auditLog = await artifactRegistryService.getArtifactRunAuditLog(runId, TEST_ORG_ID);

    expect(auditLog.length).toBeGreaterThanOrEqual(3);

    const actions = auditLog.map((e) => e.action);
    expect(actions).toContain('created');
    expect(actions).toContain('plan_accepted');
    expect(actions).toContain('materialized');

    const createdEntry = auditLog.find((e) => e.action === 'created')!;
    expect(createdEntry.toStatus).toBe('planned');
    expect(createdEntry.actorUserId).toBe(TEST_USER_ID);

    const acceptedEntry = auditLog.find((e) => e.action === 'plan_accepted')!;
    expect(acceptedEntry.fromStatus).toBe('planned');
    expect(acceptedEntry.toStatus).toBe('proposal_created');

    const materializedEntry = auditLog.find((e) => e.action === 'materialized')!;
    expect(materializedEntry.toStatus).toBe('completed');
    expect(materializedEntry.detail?.artifactId).toBeTruthy();
  });
});
