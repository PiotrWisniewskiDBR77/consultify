/** @vitest-environment node */

/**
 * "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28) —
 * `PATCH /api/workbook/:id/cell`.
 *
 * Pierwszy endpoint mutujący ISTNIEJĄCY wiersz `generated_workbooks`
 * (grep potwierdza: `/generate`, `/blank`, `/templates/:id/build`, `/:id/clone`
 * zawsze tworzyły NOWY wiersz — żaden nie aktualizował schema_json na miejscu).
 * Bez tego edycja komórki w `EditableSpreadsheetGrid.tsx` nie przeżywa
 * odświeżenia strony. Mocking wzorowany 1:1 na `workbook-clone.routes.test.ts`.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
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

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/workbook', workbookRoutes);
  return app;
}

const ORG = 'org-1';
const ORG_ATTACKER = 'org-2';
const WB_ID = 'wb-1';

const SCHEMA = {
  title: 'Ocena opłacalności projektu (NPV/IRR)',
  sheets: [
    {
      name: 'Założenia',
      columns: [
        { key: 'driver', header: 'Driver' },
        { key: 'wartosc', header: 'Wartość' },
      ],
      rows: [
        {
          cells: {
            driver: { value: 'Stopa dyskontowa' },
            wartosc: {
              value: 0.1,
              style: { bgColor: 'FFF6DF', border: 'thin' },
              comment: 'wejście',
            },
          },
        },
      ],
    },
    {
      name: 'Wyniki',
      columns: [
        { key: 'metryka', header: 'Metryka' },
        { key: 'wartosc', header: 'Wartość' },
      ],
      rows: [
        { cells: { metryka: { value: 'NPV' }, wartosc: { formula: "'Założenia'!$B$2*100" } } },
      ],
    },
  ],
};

function asUser(organizationId: string): void {
  mockUser = { id: 'user-1', organizationId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
  mockQueryRun.mockResolvedValue({ changes: 1 });

  mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
    if (
      typeof sql === 'string' &&
      sql.includes('FROM generated_workbooks') &&
      sql.includes('schema_json')
    ) {
      const [id, orgId] = params as [string, string];
      if (id === WB_ID && orgId === ORG) {
        return { schema_json: JSON.stringify(SCHEMA) };
      }
      return null;
    }
    return null;
  });
});

const validBody = { sheetIndex: 0, rowIndex: 0, columnKey: 'wartosc', value: 0.15 };

describe('PATCH /api/workbook/:id/cell', () => {
  it('401 when unauthenticated', async () => {
    const app = createApp();
    const res = await request(app).patch(`/api/workbook/${WB_ID}/cell`).send(validBody);
    expect(res.status).toBe(401);
  });

  it('404 when the workbook does not exist for this organization', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app).patch('/api/workbook/does-not-exist/cell').send(validBody);
    expect(res.status).toBe(404);
  });

  it('404 for a foreign tenant (cross-org IDOR) even with the correct id', async () => {
    const app = createApp();
    asUser(ORG_ATTACKER);
    const res = await request(app).patch(`/api/workbook/${WB_ID}/cell`).send(validBody);
    expect(res.status).toBe(404);
  });

  it.each([
    [{ ...validBody, sheetIndex: -1 }, 'negative sheetIndex'],
    [{ ...validBody, sheetIndex: 'x' }, 'non-numeric sheetIndex'],
    [{ ...validBody, rowIndex: -1 }, 'negative rowIndex'],
    [{ ...validBody, columnKey: '' }, 'empty columnKey'],
    [{ ...validBody, columnKey: undefined }, 'missing columnKey'],
    [{ ...validBody, formula: 42 }, 'non-string formula'],
    [{ ...validBody, value: { nested: true } }, 'object value'],
  ])('400 for invalid body: %s', async (body) => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/cell`)
      .send(body as any);
    expect(res.status).toBe(400);
  });

  it('400 for out-of-range sheetIndex', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/cell`)
      .send({ ...validBody, sheetIndex: 5 });
    expect(res.status).toBe(400);
  });

  it('400 for out-of-range rowIndex', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/cell`)
      .send({ ...validBody, rowIndex: 99 });
    expect(res.status).toBe(400);
  });

  it('400 for an unknown columnKey', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/cell`)
      .send({ ...validBody, columnKey: 'nope' });
    expect(res.status).toBe(400);
  });

  it('200 writes the new value, preserves style/comment, and persists via UPDATE', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app).patch(`/api/workbook/${WB_ID}/cell`).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.cell).toEqual({
      style: { bgColor: 'FFF6DF', border: 'thin' },
      comment: 'wejście',
      value: 0.15,
    });

    const updateCall = mockQueryRun.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE generated_workbooks')
    );
    expect(updateCall).toBeTruthy();
    const [, updateParams] = updateCall as [string, unknown[]];
    const savedSchema = JSON.parse(updateParams[0] as string);
    expect(savedSchema.sheets[0].rows[0].cells.wartosc.value).toBe(0.15);
    expect(updateParams[1]).toBe(WB_ID);
    expect(updateParams[2]).toBe(ORG);
  });

  it('a formula wins over a simultaneously-provided value, and strips a leading "="', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app).patch(`/api/workbook/${WB_ID}/cell`).send({
      sheetIndex: 0,
      rowIndex: 0,
      columnKey: 'wartosc',
      value: 999,
      formula: '=SUM(A1:A2)',
    });

    expect(res.status).toBe(200);
    expect(res.body.cell.formula).toBe('SUM(A1:A2)');
    expect(res.body.cell.value).toBeUndefined();
  });

  it('omitting both value and formula clears the cell content but keeps style/comment', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/cell`)
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'wartosc' });

    expect(res.status).toBe(200);
    expect(res.body.cell.value).toBeUndefined();
    expect(res.body.cell.formula).toBeUndefined();
    expect(res.body.cell.style).toEqual({ bgColor: 'FFF6DF', border: 'thin' });
  });
});
