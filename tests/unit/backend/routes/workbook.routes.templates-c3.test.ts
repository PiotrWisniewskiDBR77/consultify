/**
 * C3 (2026-07-22) — contract test for the parametric TEMPLATE endpoints on
 * /api/workbook:
 *   GET  /workbook/templates              → lists the registry (id/name/description/params)
 *   POST /workbook/templates/:id/build    → validates params (zod from descriptors),
 *                                            builds deterministically, returns downloadUrl
 *
 * The registry + its zod validation run FOR REAL (they are pure); only the heavy
 * BUILD service, DB helpers, auth and artifact registry are mocked — so this proves
 * the wiring, the descriptor→zod validation gate, and the response contract without
 * a DB or an LLM.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };

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
vi.mock('../../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue(undefined),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
}));

const generateFromTemplateMock = vi.fn();
vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: {
    generate: vi.fn(),
    generateFromTemplate: (...args: unknown[]) => generateFromTemplateMock(...args),
  },
}));

const registerArtifactOriginMock = vi
  .fn()
  .mockResolvedValue({ artifactId: 'art-1' });
vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...a: unknown[]) => registerArtifactOriginMock(...a),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
}));

async function buildApp() {
  const { default: workbookRouter } = await import(
    '../../../../server/src/routes/workbook.routes.js'
  );
  const app = express();
  app.use(express.json());
  app.use('/workbook', workbookRouter);
  return app;
}

describe('workbook.routes — C3 parametric templates', () => {
  beforeEach(() => {
    generateFromTemplateMock.mockReset();
    registerArtifactOriginMock.mockClear();
  });

  it('GET /workbook/templates lists the registry with param descriptors', async () => {
    const app = await buildApp();
    const res = await request(app).get('/workbook/templates');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    const pnl = res.body.templates.find((t: any) => t.id === 'threeScenarioPnL');
    expect(pnl).toBeTruthy();
    expect(pnl.name).toContain('scenariusz');
    expect(Array.isArray(pnl.params)).toBe(true);
    expect(pnl.params.length).toBeGreaterThan(0);
    const cogs = pnl.params.find((p: any) => p.name === 'base.cogsPct');
    expect(cogs).toMatchObject({ type: 'percent', min: 0, max: 1 });
    expect(typeof cogs.default).toBe('number');
  });

  it('POST /templates/:id/build validates params, builds, returns downloadUrl', async () => {
    generateFromTemplateMock.mockResolvedValue({
      id: 'wb-42',
      buffer: Buffer.from('xlsx-bytes'),
      fileName: 'Acme_PL.xlsx',
      schema: {
        title: 'Acme — Model P&L',
        description: 'desc',
        sheets: [
          { name: 'Założenia', purpose: 'p', columns: [], rows: [] },
          { name: 'P&L', purpose: 'p', columns: [], rows: [] },
        ],
      },
      validationErrors: [],
      classifiedErrors: [],
      qualityScore: null,
      pipelineLog: [],
      generatedAt: new Date().toISOString(),
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/templates/threeScenarioPnL/build')
      .send({ params: { companyName: 'Acme', 'base.cogsPct': 0.5 }, language: 'pl' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('wb-42');
    expect(res.body.downloadUrl).toBe('/api/workbook/wb-42/download');
    expect(res.body.artifactId).toBe('art-1');
    expect(res.body.sheets).toHaveLength(2);

    // The route forwarded the validated flat params (unknown keys stripped).
    const arg = generateFromTemplateMock.mock.calls[0][0];
    expect(arg.templateId).toBe('threeScenarioPnL');
    expect(arg.flatParams.companyName).toBe('Acme');
    expect(arg.flatParams['base.cogsPct']).toBe(0.5);
  });

  it('POST /templates/:id/build rejects out-of-range params with 400 (never builds)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/templates/threeScenarioPnL/build')
      .send({ params: { 'base.cogsPct': 9 } }); // 900% > max 1

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues[0].path).toBe('base.cogsPct');
    expect(generateFromTemplateMock).not.toHaveBeenCalled();
  });

  it('POST /templates/:id/build returns 404 for an unknown template id', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/templates/doesNotExist/build')
      .send({ params: {} });

    expect(res.status).toBe(404);
    expect(generateFromTemplateMock).not.toHaveBeenCalled();
  });
});
