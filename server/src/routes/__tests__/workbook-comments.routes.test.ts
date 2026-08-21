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

const schema = {
  title: 'KPI',
  sheets: [
    {
      name: 'Control',
      columns: [{ key: 'actual', header: 'Actual' }],
      rows: [{ cells: { actual: { value: 0.2 } } }],
    },
  ],
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

describe('workbook comments', () => {
  it('creates a range comment and persists a stable sheet id lazily', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 3 })
      .mockResolvedValueOnce(null);

    const first = await request(createApp()).post('/api/workbook/wb-1/comments').send({
      body: 'Verify this decision input',
      idempotencyKey: 'comment-1',
    });
    expect(first.status).toBe(201);
    expect(first.body.anchor.version).toBe(3);

    const schemaUpdate = mockQueryRun.mock.calls.find(
      (call) =>
        String(call[0]).includes('UPDATE generated_workbooks SET schema_json') &&
        typeof call[1]?.[0] === 'string'
    );
    expect(schemaUpdate).toBeTruthy();
    const persistedSchema = JSON.parse(schemaUpdate![1][0]);
    expect(persistedSchema.sheets[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(
      mockQueryRun.mock.calls.some((call) =>
        String(call[0]).includes('INSERT INTO generated_workbook_comments')
      )
    ).toBe(true);
  });

  it('rejects a range without a stable sheet anchor', async () => {
    mockQueryOne.mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 3 });
    const response = await request(createApp())
      .post('/api/workbook/wb-1/comments')
      .send({
        body: 'Unanchored range',
        idempotencyKey: 'comment-2',
        anchor: { range: 'A1:B2' },
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('sheetId');
  });

  it('returns an idempotent result instead of duplicating a comment', async () => {
    const stableSchema = {
      ...schema,
      sheets: [{ ...schema.sheets[0], id: '0da33145-b8bc-444b-b1bf-7373bd25e7fb' }],
    };
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(stableSchema), version: 3 })
      .mockResolvedValueOnce({ id: 'existing-comment' });
    const response = await request(createApp())
      .post('/api/workbook/wb-1/comments')
      .send({
        body: 'Same transport retry',
        idempotencyKey: 'comment-3',
        anchor: { sheetId: stableSchema.sheets[0].id, range: 'A1' },
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'existing-comment', duplicate: true });
  });

  it('lists comments with organization and status filters', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'wb-1' });
    mockQueryAll.mockResolvedValueOnce([{ id: 'comment-1', status: 'open' }]);
    const response = await request(createApp()).get(
      '/api/workbook/wb-1/comments?status=open&sheetId=sheet-1'
    );
    expect(response.status).toBe(200);
    expect(response.body.comments).toHaveLength(1);
    expect(mockQueryAll.mock.calls[0][1]).toEqual(['wb-1', 'org-1', 'open', 'sheet-1']);
  });

  it('resolves and reopens only an organization-owned comment', async () => {
    const resolved = await request(createApp())
      .patch('/api/workbook/wb-1/comments/comment-1/status')
      .send({ status: 'resolved' });
    expect(resolved.status).toBe(200);
    expect(mockQueryRun.mock.calls.at(-1)?.[1].slice(-3)).toEqual(['comment-1', 'wb-1', 'org-1']);

    const reopened = await request(createApp())
      .patch('/api/workbook/wb-1/comments/comment-1/status')
      .send({ status: 'open' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe('open');
  });
});
