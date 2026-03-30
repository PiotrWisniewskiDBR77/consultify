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
    req.user = { id: 'user-1', organizationId: 'org-a', role: 'USER' };
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

import artifactsRouter from '../../../server/src/routes/artifacts.routes.js';
import artifactRunsRouter from '../../../server/src/routes/artifact-runs.routes.js';
import * as reportBuilderService from '../../../server/src/services/reportBuilderService.js';
import * as reportsPresModelService from '../../../server/src/services/v8/reportsPresModelService.js';

async function ensureExportsTable() {
  await new Promise<void>((resolve, reject) => {
    sqliteCtx.db.exec(
      `
      CREATE TABLE IF NOT EXISTS v8_output_exports (
        export_id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        format TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
    `,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });
}

async function seedTemplate(params: {
  templateId: string;
  organizationId: string;
  sourceType: string;
  reportType: string;
  sections: Array<{ key: string; type: string; title: string; required: boolean; order: number }>;
}) {
  await new Promise<void>((resolve, reject) => {
    sqliteCtx.db.run(
      `INSERT INTO report_builder_templates (
        id, organization_id, source_type, report_type, sections_json, is_default, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.templateId,
        params.organizationId,
        params.sourceType,
        params.reportType,
        JSON.stringify(params.sections),
        0,
        0,
      ],
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });
}

describe('P21-B (sqlite) — 2 report templates via governed artifact-runs -> outputs library -> export audit', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);
  app.use('/api/artifacts', artifactsRouter);

  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
    await ensureExportsTable();
    reportBuilderService.setDependencies({ db: sqliteCtx.db as any });
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run('DELETE FROM v8_output_exports', (err: Error | null) =>
        err ? reject(err) : resolve()
      );
    });
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
      })
  );

  it('materializes two report templates and records export audit trace (no-web posture explicit)', async () => {
    await seedTemplate({
      templateId: 'tpl-p21b-1',
      organizationId: 'org-a',
      sourceType: 'INTERVIEW',
      reportType: 'INTERVIEW',
      sections: [{ key: 'summary', type: 'summary', title: 'Summary', required: true, order: 1 }],
    });
    await seedTemplate({
      templateId: 'tpl-p21b-2',
      organizationId: 'org-a',
      sourceType: 'INTERVIEW',
      reportType: 'INTERVIEW',
      sections: [{ key: 'summary', type: 'summary', title: 'Summary', required: true, order: 1 }],
    });

    spineMocks.initiateHandoff
      .mockResolvedValueOnce({ executionRunId: 'exec-p21b-1' })
      .mockResolvedValueOnce({ executionRunId: 'exec-p21b-2' });
    spineMocks.createProposal
      .mockResolvedValueOnce({ proposalId: 'proposal-p21b-1' })
      .mockResolvedValueOnce({ proposalId: 'proposal-p21b-2' });

    const materializeOne = async (templateId: string, execRunId: string) => {
      const createRes = await request(app).post('/api/artifact-runs/from-chat').send({
        conversationId: `conv-${templateId}`,
        contextSnapshotId: `snap-${templateId}`,
        goal: 'Create a board report',
        requestedArtifactFamily: 'document',
        requestedOutputType: 'report',
      });
      expect(createRes.status).toBe(201);
      const runId = String(createRes.body.data.run.runId);

      const acceptRes = await request(app).post(`/api/artifact-runs/${runId}/accept-plan`).send({});
      expect(acceptRes.status).toBe(200);
      expect(['proposal_created', 'awaiting_review', 'approved_for_apply'].includes(acceptRes.body.data.runStatus)).toBe(
        true
      );

      spineMocks.getRun.mockImplementation(async (runIdArg: string) =>
        runIdArg === execRunId ? { state: 'approved_for_apply' } : { state: 'approved_for_apply' }
      );

      const materializeRes = await request(app).post(`/api/artifact-runs/${runId}/materialize`).send({
        title: `Board report (${templateId})`,
        sourceType: 'INTERVIEW',
        sourceId: `interview-${templateId}`,
        sourceName: 'Founder interview',
        templateId,
        config: {
          degradedFlags: { no_web: true },
          sourcesLedger: [{ kind: 'primary_source', sourceType: 'INTERVIEW', sourceId: `interview-${templateId}` }],
        },
      });

      expect(materializeRes.status).toBe(200);
      expect(materializeRes.body.data.runStatus).toBe('completed');
      expect(materializeRes.body.data.artifactId).toBeTruthy();
      expect(spineMocks.applyRun).toHaveBeenCalled();
      expect(spineMocks.completeRun).toHaveBeenCalled();
      return {
        runId,
        artifactId: String(materializeRes.body.data.artifactId),
      };
    };

    const first = await materializeOne('tpl-p21b-1', 'exec-p21b-1');
    const second = await materializeOne('tpl-p21b-2', 'exec-p21b-2');

    const listRes = await request(app).get('/api/artifacts?limit=50');
    expect(listRes.status).toBe(200);
    const rows: any[] = listRes.body?.data || [];
    const reportRows = rows.filter((r) => r.originRuntime === 'report');
    expect(reportRows.length).toBeGreaterThanOrEqual(2);

    const firstRow = reportRows.find((r) => r.artifactId === first.artifactId);
    const secondRow = reportRows.find((r) => r.artifactId === second.artifactId);
    expect(firstRow?.originSummary?.templateId).toBe('tpl-p21b-1');
    expect(secondRow?.originSummary?.templateId).toBe('tpl-p21b-2');
    expect(firstRow?.originSummary?.degradedFlags?.no_web).toBe(true);
    expect(Array.isArray(firstRow?.originSummary?.sourcesLedger)).toBe(true);

    await reportsPresModelService.recordCompletedExport(first.artifactId, 'org-a', 'pdf', 'user-1');

    const trustRes = await request(app).get(`/api/artifacts/${encodeURIComponent(first.artifactId)}/trust-state`);
    expect(trustRes.status).toBe(200);
    expect(trustRes.body.data.exportHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ format: 'pdf', status: 'completed' })])
    );
  });
});

