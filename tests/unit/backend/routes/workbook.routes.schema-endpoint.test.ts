/**
 * B3 fix (2026-07-22, workstream Excel): GET /api/workbook/:id/schema — the
 * dedicated read endpoint that returns the full WorkbookSchema (sheets → rows →
 * cells with value + formula string) for the in-app grid preview. Covers:
 *   - happy path: org-scoped row found → 200 with the parsed sheets array
 *   - 404 when the row belongs to a different org (or doesn't exist)
 *   - in-memory workbookCache short-circuit (freshly generated, not yet queried)
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
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
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

const queryOneMock = vi.fn();
const queryRunMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => queryRunMock(...args),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: { generate: vi.fn() },
}));

vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-test' }),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../server/src/services/materialExport/materialExportReceiptService.js', () => ({
  beginMaterialExport: vi.fn().mockResolvedValue({
    exportReceiptId: 'receipt-test',
    replay: false,
  }),
  completeMaterialExport: vi.fn().mockResolvedValue({ exportReceiptId: 'receipt-test' }),
  failMaterialExport: vi.fn().mockResolvedValue(undefined),
}));

describe('GET /api/workbook/:id/schema', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    queryRunMock.mockClear();
    mockUser.organizationId = 'org-1';
  });

  it('returns the full sheets (rows + cells + formulas) for an org-scoped workbook', async () => {
    const sheets = [
      {
        name: 'P&L',
        columns: [
          { key: 'item', header: 'Item' },
          { key: 'value', header: 'Value' },
        ],
        rows: [
          { cells: { item: { value: 'Revenue' }, value: { value: 100000 } } },
          { cells: { item: { value: 'Total' }, value: { formula: 'SUM(B2:B2)' } } },
        ],
      },
    ];
    queryOneMock.mockResolvedValueOnce({
      schema_json: JSON.stringify({ title: 'Test WB', description: 'desc', sheets }),
    });

    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/wb-1/schema');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test WB');
    expect(res.body.sheets).toEqual([
      {
        ...sheets[0],
        id: expect.any(String),
      },
    ]);
    expect(res.body.sheets[0].id).not.toHaveLength(0);
    expect(res.body.sheets[0].rows[1].cells.value.formula).toBe('SUM(B2:B2)');
    // Org-scoped: the second bound param must be the requesting user's org.
    expect(queryOneMock).toHaveBeenCalledWith(expect.any(String), ['wb-1', 'org-1']);
  });

  it('returns 404 when the workbook is not found for this organization', async () => {
    queryOneMock.mockResolvedValueOnce(null);

    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/does-not-exist/schema');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('does not expose a cached workbook schema to another organization', async () => {
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/workbook', workbookRouter);

    const created = await request(app).post('/workbook/blank').send({ title: 'Tenant A workbook' });
    expect(created.status).toBe(201);

    mockUser.organizationId = 'org-2';
    queryOneMock.mockResolvedValueOnce(null);

    const res = await request(app).get(`/workbook/${created.body.id}/schema`);
    expect(res.status).toBe(404);
    expect(queryOneMock).toHaveBeenCalledWith(expect.any(String), [created.body.id, 'org-2']);
  });

  it('does not expose cached XLSX bytes to another organization', async () => {
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/workbook', workbookRouter);

    const created = await request(app).post('/workbook/blank').send({ title: 'Tenant A download' });
    expect(created.status).toBe(201);

    mockUser.organizationId = 'org-2';
    queryOneMock.mockResolvedValueOnce(null);

    const res = await request(app).get(`/workbook/${created.body.id}/download`);
    expect(res.status).toBe(404);
    expect(queryOneMock).toHaveBeenCalledWith(expect.any(String), [created.body.id, 'org-2']);
  });

  it('persists native source-pack and evidence references for a blank workbook', async () => {
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/workbook', workbookRouter);

    const sourcePack = { packId: 'PACK-1', name: 'Decision evidence pack' };
    const evidenceRefs = [
      { sourceId: 'SRC-1', sourceVersion: 'v1', sourceExcerpt: 'Validated baseline.' },
    ];
    const created = await request(app)
      .post('/workbook/blank')
      .send({ title: 'Grounded workbook', sourcePack, evidenceRefs });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ sourcePack, evidenceRefs });
    const insert = queryRunMock.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO generated_workbooks')
    );
    expect(insert?.[1]?.[13]).toBe(JSON.stringify(sourcePack));
    expect(insert?.[1]?.[14]).toBe(JSON.stringify(evidenceRefs));
  });

  it('marks the backward-compatible workbook download as a draft export', async () => {
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/workbook', workbookRouter);

    const created = await request(app).post('/workbook/blank').send({ title: 'Governed workbook' });
    expect(created.status).toBe(201);

    // Download is intentionally rebuilt from the persisted authority rather
    // than a generation-time memory buffer.
    queryOneMock.mockResolvedValueOnce({
      schema_json: JSON.stringify({
        title: 'Governed workbook',
        sheets: [{ name: 'Sheet1', columns: [], rows: [] }],
      }),
      file_name: 'Governed_workbook.xlsx',
      classification: 'internal',
      approval_current: 0,
      quality_report_json: JSON.stringify({ issues: [] }),
    });

    const res = await request(app).get(`/workbook/${created.body.id}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['x-artifact-export-mode']).toBe('draft');
    expect(res.headers['x-artifact-draft']).toBe('true');
    expect(res.headers['content-disposition']).toContain('Governed_workbook-DRAFT.xlsx');
  });

  it('fails closed when a final export lacks current approval', async () => {
    queryOneMock.mockResolvedValueOnce({
      schema_json: JSON.stringify({
        title: 'Governed workbook',
        sheets: [{ name: 'Sheet1', columns: [], rows: [] }],
      }),
      file_name: 'governed.xlsx',
      classification: 'internal',
      approval_current: 0,
      quality_report_json: JSON.stringify({ issues: [] }),
    });

    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/wb-final/download?mode=final');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'ARTIFACT_EXPORT_BLOCKED',
      mode: 'final',
      blocks: ['CURRENT_APPROVAL_REQUIRED'],
    });
  });

  it('fails closed when a final export has a critical QA finding', async () => {
    queryOneMock.mockResolvedValueOnce({
      schema_json: JSON.stringify({
        title: 'Governed workbook',
        sheets: [{ name: 'Sheet1', columns: [], rows: [] }],
      }),
      file_name: 'governed.xlsx',
      classification: 'internal',
      approval_current: 1,
      quality_report_json: JSON.stringify({ issues: [{ severity: 'critical' }] }),
    });

    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).get('/workbook/wb-critical/download?mode=final');
    expect(res.status).toBe(409);
    expect(res.body.blocks).toEqual(['CRITICAL_QA_BLOCKED']);
  });
});
