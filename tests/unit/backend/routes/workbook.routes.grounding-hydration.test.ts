/**
 * A2 fix (2026-07-22): the dedicated artifact-run generation path (ExceleView /
 * useKimiArtifactPipeline.ts) sends ONLY `artifactRunId` to POST /api/workbook/generate —
 * a field that elsewhere in this route is used purely to adopt the Outputs Library card
 * (adoptRunArtifactForWorkbook), never to ground the LLM prompt. This test proves the
 * route now hydrates `researchContext` server-side from the run's own record
 * (v8_artifact_runs → execution_run_id → v8_execution_runs.goal) when no explicit
 * sourcePack/evidenceRefs/researchContext was sent, and that any lookup failure
 * fails soft (generation still succeeds, ungrounded).
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUser = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../server/src/services/documentStudio/documentOrgContextSourcePack.js', () => ({
  buildOrgContextSourcePack: vi.fn().mockResolvedValue(null),
}));

const generateMock = vi.fn().mockResolvedValue({
  id: 'wb-1',
  buffer: Buffer.from('fake-xlsx'),
  fileName: 'workbook.xlsx',
  schema: { title: 'Test workbook', description: '', sheets: [] },
  validationErrors: [],
  classifiedErrors: [],
  qualityScore: 1,
  pipelineLog: [],
  generatedAt: new Date().toISOString(),
});

vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: { generate: generateMock },
}));

const getArtifactRunMock = vi.fn();
vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactRun: (...args: unknown[]) => getArtifactRunMock(...args),
  registerArtifactOrigin: vi.fn().mockResolvedValue(null),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
}));

const getExecutionRunMock = vi.fn();
vi.mock('../../../../server/src/services/v8/executionSpineService.js', () => ({
  getRun: (...args: unknown[]) => getExecutionRunMock(...args),
}));

describe('workbook.routes — grounding hydration from artifactRunId', () => {
  beforeEach(() => {
    generateMock.mockClear();
    getArtifactRunMock.mockReset();
    getExecutionRunMock.mockReset();
  });

  async function buildApp() {
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/workbook', workbookRouter);
    return app;
  }

  it('hydrates researchContext from the run when only artifactRunId is sent', async () => {
    getArtifactRunMock.mockResolvedValue({
      runId: 'run-1',
      executionRunId: 'exec-1',
      organizationId: 'org-1',
      plan: { titleHint: 'Q3 finance model' },
    });
    getExecutionRunMock.mockResolvedValue({
      runId: 'exec-1',
      goal: 'Zbuduj arkusz kosztów operacyjnych Q3 na bazie danych z wywiadu klienta.',
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/generate')
      .send({ prompt: 'Wygeneruj arkusz', artifactRunId: 'run-1' });

    expect(res.status).toBe(200);
    expect(getArtifactRunMock).toHaveBeenCalledWith('run-1', 'org-1');
    expect(getExecutionRunMock).toHaveBeenCalledWith('exec-1', 'org-1');

    const callArg = generateMock.mock.calls[0][0];
    expect(callArg.researchContext).toContain('Q3 finance model');
    expect(callArg.researchContext).toContain(
      'Zbuduj arkusz kosztów operacyjnych Q3 na bazie danych z wywiadu klienta.'
    );
  });

  it('does not hydrate when explicit sourcePack was already sent (no lookup)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/generate')
      .send({
        prompt: 'Wygeneruj arkusz',
        artifactRunId: 'run-1',
        sourcePack: { key_points: ['Fakt X'] },
      });

    expect(res.status).toBe(200);
    expect(getArtifactRunMock).not.toHaveBeenCalled();
    const callArg = generateMock.mock.calls[0][0];
    expect(callArg.researchContext).toContain('Fakt X');
  });

  it('fails soft (generation still succeeds, ungrounded) when the run lookup throws', async () => {
    getArtifactRunMock.mockRejectedValue(new Error('db unavailable'));

    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/generate')
      .send({ prompt: 'Wygeneruj arkusz', artifactRunId: 'run-broken' });

    expect(res.status).toBe(200);
    const callArg = generateMock.mock.calls[0][0];
    expect(callArg.researchContext).toBeUndefined();
  });

  it('fails soft when the run exists but has no execution goal', async () => {
    getArtifactRunMock.mockResolvedValue({
      runId: 'run-2',
      executionRunId: 'exec-2',
      organizationId: 'org-1',
      plan: { titleHint: 'Empty goal run' },
    });
    getExecutionRunMock.mockResolvedValue({ runId: 'exec-2', goal: '' });

    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/generate')
      .send({ prompt: 'Wygeneruj arkusz', artifactRunId: 'run-2' });

    expect(res.status).toBe(200);
    const callArg = generateMock.mock.calls[0][0];
    expect(callArg.researchContext).toBeUndefined();
  });
});
