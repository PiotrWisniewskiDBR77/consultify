/** @vitest-environment node */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockQueryAll = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  transaction: (callback: (db: unknown) => Promise<unknown>) => callback({}),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
}));
vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import workbookRoutes from '../workbook.routes.js';

const sheetId = '0da33145-b8bc-444b-b1bf-7373bd25e7fb';
const schema = {
  title: 'KPI',
  sheets: [{ id: sheetId, name: 'Control', columns: [], rows: [] }],
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/workbook', workbookRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockQueryAll.mockResolvedValue([]);
});

describe('workbook source bindings', () => {
  it('lists tenant-scoped bindings and exposes anchor state', async () => {
    mockQueryOne.mockResolvedValueOnce({ schema_json: JSON.stringify(schema) });
    mockQueryAll.mockImplementation(async (sql: unknown) =>
      String(sql).includes('FROM generated_workbook_source_bindings')
        ? [
            {
              id: 'binding-1',
              sheet_id: sheetId,
              range_ref: 'B2:E6',
              label: 'CRM snapshot',
              source_ref: 'crm-2026-08-05',
              source_type: 'dataset',
              anchored_version: 4,
              anchor_state: 'active',
              created_by: 'user-1',
              created_at: '2026-08-09T08:00:00Z',
            },
          ]
        : []
    );

    const response = await request(createApp()).get('/api/workbook/wb-1/sources');
    expect(response.status).toBe(200);
    expect(response.body.bindings[0]).toMatchObject({
      sheet: 'Control',
      range: 'B2:E6',
      anchorState: 'active',
    });
    const bindingRead = mockQueryAll.mock.calls.find(([sql]) =>
      String(sql).includes('FROM generated_workbook_source_bindings')
    );
    expect(bindingRead?.[1]).toEqual(['wb-1', 'org-1']);
  });

  it('binds a stable sheet range as one versioned revision', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 4 })
      .mockResolvedValueOnce(null);

    const response = await request(createApp()).post('/api/workbook/wb-1/sources').send({
      sheetId,
      range: 'b2:e6',
      label: 'CRM snapshot',
      sourceRef: 'crm-2026-08-05',
      sourceType: 'dataset',
      baseVersion: 4,
      idempotencyKey: 'source-1',
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ duplicate: false, version: 5 });
    expect(response.body.binding.range).toBe('B2:E6');
    expect(
      mockQueryRun.mock.calls.some((call) =>
        String(call[0]).includes('INSERT INTO generated_workbook_source_bindings')
      )
    ).toBe(true);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_revisions') &&
          call[1]?.includes('xlsx.sources.bind')
      )
    ).toBe(true);
  });

  it('returns an idempotent result even when the retry carries a stale base version', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 })
      .mockResolvedValueOnce({ id: 'binding-existing' });
    const response = await request(createApp()).post('/api/workbook/wb-1/sources').send({
      sheetId,
      range: 'B2',
      label: 'CRM snapshot',
      baseVersion: 4,
      idempotencyKey: 'source-1',
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'binding-existing', duplicate: true, version: 5 });
  });

  it('rejects a genuine stale-version bind', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 })
      .mockResolvedValueOnce(null);
    const response = await request(createApp()).post('/api/workbook/wb-1/sources').send({
      sheetId,
      range: 'B2',
      label: 'CRM snapshot',
      baseVersion: 4,
      idempotencyKey: 'source-new',
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WORKBOOK_VERSION_CONFLICT');
  });

  it('unbinds only a tenant-owned binding and creates a revision', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 })
      .mockResolvedValueOnce({
        id: 'binding-1',
        sheet_id: sheetId,
        range_ref: 'B2:E6',
        label: 'CRM snapshot',
        source_ref: 'crm-2026-08-05',
        source_type: 'dataset',
      });
    const response = await request(createApp())
      .delete('/api/workbook/wb-1/sources/binding-1')
      .send({ baseVersion: 5 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, id: 'binding-1', version: 6 });
    const deleteCall = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('DELETE FROM generated_workbook_source_bindings')
    );
    expect(deleteCall?.[1]).toEqual(['binding-1', 'wb-1', 'org-1']);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_revisions') &&
          call[1]?.includes('xlsx.sources.unbind')
      )
    ).toBe(true);
  });
});
