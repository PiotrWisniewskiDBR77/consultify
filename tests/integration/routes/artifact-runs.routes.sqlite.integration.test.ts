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
import artifactsRouter from '../../../server/src/routes/artifacts.routes.js';
import * as reportBuilderService from '../../../server/src/services/reportBuilderService.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('artifact-runs routes (sqlite-backed integration)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);
  app.use('/api/artifacts', artifactsRouter);
  app.use(errorHandlerMiddleware);

  const sqliteRun = (sql: string, params: unknown[] = []) =>
    new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });

  const sqliteGet = <T,>(sql: string, params: unknown[] = []) =>
    new Promise<T | null>((resolve, reject) => {
      sqliteCtx.db.get(sql, params, (err, row) =>
        err ? reject(err) : resolve((row || null) as T | null),
      );
    });

  async function getPrimaryOrigin(artifactId: string) {
    const origin = await sqliteGet<{ origin_runtime: string; origin_record_id: string }>(
      `SELECT origin_runtime, origin_record_id FROM v8_artifact_origin_links
       WHERE artifact_id = ? AND organization_id = ? AND is_primary_origin = 1`,
      [artifactId, 'org-a'],
    );
    expect(origin).toBeTruthy();
    return origin!;
  }

  async function expectStableContentReadBack(
    artifactId: string,
    origin: { origin_runtime: string; origin_record_id: string },
  ) {
    const first = await request(app).get(`/api/artifacts/${artifactId}/content`);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.headers['cache-control']).toBe('private, must-revalidate');
    expect(first.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(first.body.data).toEqual(
      expect.objectContaining({
        artifactId,
        origin: {
          originRuntime: origin.origin_runtime,
          originRecordId: origin.origin_record_id,
        },
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        envelope: expect.objectContaining({
          envelopeVersion: 'artifact-content/v1',
          canonicalFormat: 'json',
          provenance: expect.objectContaining({
            originRuntime: origin.origin_runtime,
            originRecordId: origin.origin_record_id,
          }),
        }),
      }),
    );
    expect(JSON.stringify(first.body.data.envelope)).not.toContain(
      'mirrored into Wave 5 runtime',
    );

    const second = await request(app).get(`/api/artifacts/${artifactId}/content`);
    expect(second.status).toBe(200);
    expect(second.headers.etag).toBe(first.headers.etag);
    expect(second.body.data.contentHash).toBe(first.body.data.contentHash);

    const notModified = await request(app)
      .get(`/api/artifacts/${artifactId}/content`)
      .set('If-None-Match', first.headers.etag);
    expect(notModified.status).toBe(304);
    expect(notModified.text).toBe('');
    return first;
  }

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

  it.each([
    ['document', 'sheet'],
    ['presentation', 'report'],
  ])('rejects contradictory explicit pair %s/%s before creating a run', async (artifactFamily, outputType) => {
    const response = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-invalid-pair',
      contextSnapshotId: 'snap-invalid-pair',
      goal: 'Create output',
      requestedArtifactFamily: artifactFamily,
      requestedOutputType: outputType,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'ARTIFACT_TYPE_MAPPING_INVALID',
        artifactFamily,
        outputType,
      }),
    );
    expect(spineMocks.initiateHandoff).not.toHaveBeenCalled();
  });

  it('requires explicit output type for template runs without guessing from goal text', async () => {
    const response = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-template',
      contextSnapshotId: 'snap-template',
      goal: 'Create a presentation template',
      requestedArtifactFamily: 'template',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.objectContaining({ code: 'ARTIFACT_TYPE_MAPPING_INVALID' }),
    );
    expect(spineMocks.initiateHandoff).not.toHaveBeenCalled();
  });

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

    const reportArtifactId = String(materializeRes.body.data.artifactId);
    const reportOrigin = await getPrimaryOrigin(reportArtifactId);
    expect(reportOrigin.origin_runtime).toBe('report');
    expect(materializeRes.body.data.materializationOrigin).toEqual({
      originRuntime: 'report',
      originRecordId: reportOrigin.origin_record_id,
    });
    await sqliteRun(
      `UPDATE report_builder_sections
       SET generated_content = ?, edited_content = NULL, content_format = 'markdown', updated_at = ?
       WHERE report_id = ?`,
      ['Initial governed report content', '2026-08-01T08:00:00.000Z', reportOrigin.origin_record_id],
    );
    await sqliteRun('UPDATE report_builder_reports SET updated_at = ? WHERE id = ?', [
      '2026-08-01T08:00:00.000Z',
      reportOrigin.origin_record_id,
    ]);
    const initialReportContent = await expectStableContentReadBack(reportArtifactId, reportOrigin);
    expect(initialReportContent.body.data.envelope).toEqual(expect.objectContaining({
      canonicalKind: 'document',
      contentSchemaVersion: 'report-builder/v1',
      contentMd: expect.stringContaining('Initial governed report content'),
    }));
    expect(initialReportContent.body.data.originRevision).toBeTruthy();

    await sqliteRun(
      `UPDATE report_builder_sections SET edited_content = ?, updated_at = ? WHERE report_id = ?`,
      ['Edited governed report content', '2026-08-01T09:00:00.000Z', reportOrigin.origin_record_id],
    );
    await sqliteRun('UPDATE report_builder_reports SET updated_at = ? WHERE id = ?', [
      '2026-08-01T09:00:00.000Z',
      reportOrigin.origin_record_id,
    ]);
    const changedReportContent = await request(app)
      .get(`/api/artifacts/${reportArtifactId}/content`)
      .set('If-None-Match', initialReportContent.headers.etag);
    expect(changedReportContent.status).toBe(200);
    expect(changedReportContent.headers.etag).not.toBe(initialReportContent.headers.etag);
    expect(changedReportContent.body.data.contentHash).not.toBe(
      initialReportContent.body.data.contentHash,
    );
    expect(changedReportContent.body.data.originRevision).not.toBe(
      initialReportContent.body.data.originRevision,
    );
    expect(changedReportContent.body.data.envelope.contentMd).toContain(
      'Edited governed report content',
    );
    expect(changedReportContent.body.data.envelope.contentJson.sections[0].source).toBe('edited');

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

    const presentationArtifactId = String(materializeRes.body.data.artifactId);
    const presentationOrigin = await getPrimaryOrigin(presentationArtifactId);
    expect(presentationOrigin.origin_runtime).toBe('presentation');
    expect(materializeRes.body.data.materializationOrigin).toEqual({
      originRuntime: 'presentation',
      originRecordId: presentationOrigin.origin_record_id,
    });
    const initialDeck = {
      title: 'Board presentation',
      slides: [{ title: 'Initial decision', bullets: ['Approve initial plan'] }],
    };
    await sqliteRun(
      `UPDATE presentation_decks
       SET content_json_native = ?, deck_json = ?, version = 1, updated_at = ? WHERE id = ?`,
      [JSON.stringify(initialDeck), JSON.stringify({ title: 'Stale deck' }), '2026-08-01T10:00:00.000Z', presentationOrigin.origin_record_id],
    );
    const initialPresentationContent = await expectStableContentReadBack(
      presentationArtifactId,
      presentationOrigin,
    );
    expect(initialPresentationContent.body.data.envelope).toEqual(expect.objectContaining({
      canonicalKind: 'presentation',
      contentSchemaVersion: 'presentation-deck/v1',
      contentJson: initialDeck,
      contentMd: expect.stringContaining('Initial decision'),
    }));
    expect(initialPresentationContent.body.data.originRevision).toBeTruthy();

    const changedDeck = {
      title: 'Board presentation',
      slides: [{ title: 'Updated decision', bullets: ['Approve revised plan'] }],
    };
    await sqliteRun(
      `UPDATE presentation_decks
       SET content_json_native = ?, version = 2, updated_at = ? WHERE id = ?`,
      [JSON.stringify(changedDeck), '2026-08-01T11:00:00.000Z', presentationOrigin.origin_record_id],
    );
    const changedPresentationContent = await request(app)
      .get(`/api/artifacts/${presentationArtifactId}/content`)
      .set('If-None-Match', initialPresentationContent.headers.etag);
    expect(changedPresentationContent.status).toBe(200);
    expect(changedPresentationContent.headers.etag).not.toBe(
      initialPresentationContent.headers.etag,
    );
    expect(changedPresentationContent.body.data.contentHash).not.toBe(
      initialPresentationContent.body.data.contentHash,
    );
    expect(changedPresentationContent.body.data.originRevision).not.toBe(
      initialPresentationContent.body.data.originRevision,
    );
    expect(changedPresentationContent.body.data.envelope.contentMd).toContain('Updated decision');
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

    const sheetArtifactId = String(materializeRes.body.data.artifactId);
    const sheetOrigin = await getPrimaryOrigin(sheetArtifactId);
    expect(sheetOrigin.origin_runtime).toBe('sheet');
    expect(materializeRes.body.data.materializationOrigin).toEqual({
      originRuntime: 'sheet',
      originRecordId: sheetOrigin.origin_record_id,
    });
    await sqliteRun(
      `INSERT INTO tp_views
       (id, table_id, name, view_type, visible_field_ids, config, is_default, ordinal, created_at, updated_at)
       VALUES (?, ?, ?, 'grid', ?, '{}', 1, 0, ?, ?)`,
      ['view-governed-1', sheetOrigin.origin_record_id, 'Default view', JSON.stringify([
        'field-name-tbl-governed-1',
        'field-status-tbl-governed-1',
      ]), '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z'],
    );
    await sqliteRun(
      `INSERT INTO tp_records (id, table_id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'record-governed-1', sheetOrigin.origin_record_id,
        JSON.stringify({ 'field-name-tbl-governed-1': 'Alpha', 'field-status-tbl-governed-1': 'Open' }),
        '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z',
        'record-governed-2', sheetOrigin.origin_record_id,
        JSON.stringify({ 'field-name-tbl-governed-1': 'Beta', 'field-status-tbl-governed-1': 'Closed' }),
        '2026-08-01T12:01:00.000Z', '2026-08-01T12:01:00.000Z',
      ],
    );
    const initialSheetContent = await expectStableContentReadBack(sheetArtifactId, sheetOrigin);
    expect(initialSheetContent.body.data.originRevision).toBeNull();
    expect(initialSheetContent.body.data.envelope).toEqual(expect.objectContaining({
      canonicalKind: 'sheet',
      contentSchemaVersion: 'table-platform/sheet-snapshot-v1',
      contentMd: expect.stringContaining('Alpha'),
    }));
    expect(initialSheetContent.body.data.envelope.contentJson.records).toHaveLength(2);

    await sqliteRun('UPDATE tp_records SET data = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify({ 'field-name-tbl-governed-1': 'Alpha revised', 'field-status-tbl-governed-1': 'Open' }),
      '2026-08-01T13:00:00.000Z',
      'record-governed-1',
    ]);
    const changedSheetContent = await request(app)
      .get(`/api/artifacts/${sheetArtifactId}/content`)
      .set('If-None-Match', initialSheetContent.headers.etag);
    expect(changedSheetContent.status).toBe(200);
    expect(changedSheetContent.headers.etag).not.toBe(initialSheetContent.headers.etag);
    expect(changedSheetContent.body.data.contentHash).not.toBe(
      initialSheetContent.body.data.contentHash,
    );
    expect(changedSheetContent.body.data.originRevision).toBeNull();
    expect(changedSheetContent.body.data.envelope.contentMd).toContain('Alpha revised');
  });
});
