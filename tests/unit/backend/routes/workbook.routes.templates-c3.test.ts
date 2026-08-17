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
const queryRunMock = vi.fn().mockResolvedValue({ changes: 1 });
const queryOneMock = vi.fn().mockResolvedValue(null);

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
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
vi.mock('../../../../server/src/services/documentStudio/documentOrgContextSourcePack.js', () => ({
  buildOrgContextSourcePack: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => queryRunMock(...args),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryAll: vi.fn().mockResolvedValue([]),
}));

const generateFromTemplateMock = vi.fn();
vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: {
    generate: vi.fn(),
    generateFromTemplate: (...args: unknown[]) => generateFromTemplateMock(...args),
  },
}));
vi.mock('../../../../server/src/services/workbook/WorkbookBuilder.js', () => ({
  buildWorkbookBuffer: vi.fn().mockResolvedValue(Buffer.from('custom-xlsx-bytes')),
  validateWorkbookSchema: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  classifyBuildError: vi.fn((error: Error) => ({ code: 'export_failed', message: error.message })),
}));

const registerArtifactOriginMock = vi.fn().mockResolvedValue({ artifactId: 'art-1' });
vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...a: unknown[]) => registerArtifactOriginMock(...a),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../server/src/services/lineage/artifactLineageService.js', () => ({
  deriveCreatedEventIdempotencyKey: vi.fn(() => 'created-key'),
  recordLineageEventSafe: vi.fn().mockResolvedValue(undefined),
  recordLineageEventTracked: vi.fn().mockResolvedValue({ status: 'recorded' }),
}));

async function buildApp() {
  const { default: workbookRouter } =
    await import('../../../../server/src/routes/workbook.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/workbook', workbookRouter);
  return app;
}

describe('workbook.routes — C3 parametric templates', () => {
  beforeEach(() => {
    generateFromTemplateMock.mockReset();
    registerArtifactOriginMock.mockClear();
    queryRunMock.mockReset().mockResolvedValue({ changes: 1 });
    queryOneMock.mockReset().mockResolvedValue(null);
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

  it('builds an org-owned custom template snapshot and preserves workbook features', async () => {
    queryOneMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM tp_base_templates')) {
        if (params[0] === 'custom-invalid') {
          return {
            id: 'custom-invalid',
            name: 'Invalid custom template',
            description: null,
            version: '1.0.0',
            schema_snapshot: { title: 'Missing sheets' },
          };
        }
        expect(params).toEqual([
          'custom-portfolio',
          'org-1',
          'user-1',
          'org-1',
          'user-1',
          'org-1',
          'user-1',
        ]);
        return {
          id: 'custom-portfolio',
          name: 'Portfolio Transformation Control',
          description: 'Custom portfolio template',
          version: '2.1.0',
          schema_snapshot: {
            title: 'Portfolio Transformation Control',
            sheets: [
              {
                name: 'Inputs',
                isAssumptions: true,
                columns: [
                  { key: 'A', header: 'Metric', type: 'text' },
                  { key: 'B', header: 'Value', type: 'percent', numberFormat: '0.0%' },
                ],
                rows: [
                  {
                    cells: {
                      A: { value: 'Risk threshold' },
                      B: {
                        value: 0.5,
                        validation: { type: 'decimal', min: 0, max: 1 },
                        style: { bgColor: '#FFF2CC', numberFormat: '0.0%' },
                      },
                    },
                  },
                ],
              },
              {
                name: 'Executive Summary',
                columns: [
                  { key: 'A', header: 'KPI' },
                  { key: 'B', header: 'Value', numberFormat: '0.0%' },
                ],
                rows: [{ cells: { A: { value: 'Threshold' }, B: { formula: "'Inputs'!B2" } } }],
                conditionalFormatting: [
                  { ref: 'B2:B2', rules: [{ type: 'dataBar', color: '#4472C4' }] },
                ],
              },
            ],
          },
        };
      }
      return null;
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/workbook/templates/custom-portfolio/build')
      .send({ params: { title: 'Portfolio Transformation Control — Run 2' } });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Portfolio Transformation Control — Run 2');
    expect(res.body.sheets.map((sheet: any) => sheet.name)).toEqual([
      'Inputs',
      'Executive Summary',
    ]);
    expect(res.body.downloadUrl).toMatch(/^\/api\/workbook\/.+\/download$/);
    expect(generateFromTemplateMock).not.toHaveBeenCalled();
    const insert = queryRunMock.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO generated_workbooks')
    );
    expect(insert).toBeTruthy();
    const persistedSchema = JSON.parse(String(insert![1][5]));
    expect(persistedSchema.sheets[0].rows[0].cells.B.validation).toMatchObject({
      type: 'decimal',
      min: 0,
      max: 1,
    });
    expect(persistedSchema.sheets[1].rows[0].cells.B.formula).toBe("'Inputs'!B2");
    expect(persistedSchema.sheets[1].conditionalFormatting[0].rules[0].type).toBe('dataBar');
    expect(persistedSchema.metadata.customTemplateVersion).toBe('2.1.0');
    expect(persistedSchema.metadata.customTemplateSnapshotHash).toMatch(/^[0-9a-f]{64}$/);

    const actionContract = JSON.parse(String(insert![1][12]));
    expect(actionContract).toMatchObject({
      command: 'materialize_custom_workbook_template',
      commandVersion: '1',
      templateId: 'custom-portfolio',
      templateVersion: '2.1.0',
      templateSnapshotHash: persistedSchema.metadata.customTemplateSnapshotHash,
    });

    const workbookId = String(res.body.id);
    const reopen = await request(app).get(`/workbook/${workbookId}/schema`);
    expect(reopen.status).toBe(200);
    expect(reopen.body.sheets.map((sheet: any) => sheet.name)).toEqual([
      'Inputs',
      'Executive Summary',
    ]);
    expect(reopen.body.sheets[1].rows[0].cells.B.formula).toBe("'Inputs'!B2");

    queryOneMock.mockImplementation(async (sql: string) =>
      sql.includes('FROM tp_base_templates')
        ? {
            id: 'custom-invalid',
            name: 'Invalid custom template',
            description: null,
            version: '1.0.0',
            schema_snapshot: { title: 'Missing sheets' },
          }
        : null
    );
    const invalid = await request(app)
      .post('/workbook/templates/custom-invalid/build')
      .send({ params: {} });
    expect(invalid.status).toBe(422);
    expect(invalid.body.classified).toBeTruthy();
  });

  it('does not return success or register an artifact when durable persistence fails', async () => {
    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tp_base_templates')) throw new Error('database timeout');
      return null;
    });
    const app = await buildApp();
    const { workbookRuntimeCache } = await import(
      '../../../../server/src/services/workbook/workbookRuntimeCache.js'
    );
    const cacheSizeBefore = workbookRuntimeCache.size;
    const outage = await request(app)
      .post('/workbook/templates/custom-query-fail/build')
      .send({ params: {} });
    expect(outage.status).toBe(500);
    expect(workbookRuntimeCache.size).toBe(cacheSizeBefore);
    expect(registerArtifactOriginMock).not.toHaveBeenCalled();

    queryOneMock.mockResolvedValue({
      id: 'custom-persist-fail',
      name: 'Persistence failure template',
      description: null,
      version: '1.0.0',
      schema_snapshot: {
        title: 'Persistence failure template',
        sheets: [{ name: 'Sheet1', columns: [], rows: [] }],
      },
    });
    queryRunMock.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO generated_workbooks') ? { changes: 0 } : { changes: 1 }
    );

    const res = await request(app)
      .post('/workbook/templates/custom-persist-fail/build')
      .send({ params: {} });

    expect(res.status).toBe(500);
    expect(workbookRuntimeCache.size).toBe(cacheSizeBefore);
    expect(registerArtifactOriginMock).not.toHaveBeenCalled();
  });
});
