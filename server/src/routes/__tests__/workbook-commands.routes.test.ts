/** @vitest-environment node */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockQueryAll = vi.fn();
const mockGetArtifactApprovalStatus = vi.fn();
const mockSubmitForReview = vi.fn();
const mockApproveArtifact = vi.fn();
const mockRejectArtifact = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  transaction: (callback: (db: unknown) => Promise<unknown>) => callback({}),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
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
vi.mock('../../services/artifactApprovalService.js', () => ({
  default: {
    getArtifactApprovalStatus: (...args: unknown[]) => mockGetArtifactApprovalStatus(...args),
    submitForReview: (...args: unknown[]) => mockSubmitForReview(...args),
    approveArtifact: (...args: unknown[]) => mockApproveArtifact(...args),
    rejectArtifact: (...args: unknown[]) => mockRejectArtifact(...args),
  },
}));

import workbookRoutes from '../workbook.routes.js';

const schema = {
  title: 'KPI',
  sheets: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Control',
      columns: [
        { key: 'metric', header: 'Metric' },
        { key: 'actual', header: 'Actual' },
      ],
      rows: [
        { cells: { metric: { value: 'Conversion' }, actual: { value: 0.2 } } },
        { cells: { metric: { value: 'Margin' }, actual: { value: 0.6 } } },
      ],
    },
  ],
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/workbook', workbookRoutes);
  return app;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    commandId: 'xlsx.range.paste',
    baseVersion: 4,
    idempotencyKey: 'mutation-1',
    operations: [
      { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'actual', value: 0.24 },
      { type: 'setCell', sheetIndex: 0, rowIndex: 1, columnKey: 'actual', formula: '=1-0.32' },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  // Ordered query queues are part of each request's fixture. Reset their
  // implementations as well as call history so an early return cannot leak an
  // unused `mockResolvedValueOnce` into the next workbook contract.
  [
    mockQueryOne,
    mockQueryRun,
    mockQueryAll,
    mockGetArtifactApprovalStatus,
    mockSubmitForReview,
    mockApproveArtifact,
    mockRejectArtifact,
  ].forEach((mock) => mock.mockReset());
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockQueryAll.mockResolvedValue([]);
  mockGetArtifactApprovalStatus.mockResolvedValue({ state: 'draft', assignment: null });
  mockSubmitForReview.mockResolvedValue({
    id: 'approval-1',
    assigned_to_user_id: 'reviewer-2',
    status: 'PENDING',
  });
  mockApproveArtifact.mockResolvedValue({
    id: 'approval-1',
    assigned_to_user_id: 'user-1',
    status: 'DONE',
  });
  mockRejectArtifact.mockResolvedValue({
    id: 'approval-1',
    assigned_to_user_id: 'user-1',
    status: 'REJECTED',
  });
  mockQueryOne.mockResolvedValue({
    schema_json: JSON.stringify(schema),
    version: 4,
    last_mutation_key: null,
  });
});

describe('POST /api/workbook/:id/commands', () => {
  it('persists a fully validated batch with one optimistic UPDATE', async () => {
    const response = await request(createApp()).post('/api/workbook/wb-1/commands').send(body());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ version: 5, operationCount: 2, duplicate: false });
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    expect(update).toBeTruthy();
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets[0].rows[0].cells.actual.value).toBe(0.24);
    expect(saved.sheets[0].rows[1].cells.actual.formula).toBe('1-0.32');
    expect(update![1].slice(1)).toEqual([5, 'mutation-1', 'wb-1', 'org-1', 4]);
    expect(
      mockQueryRun.mock.calls.some((call) =>
        String(call[0]).includes('INSERT INTO generated_workbook_revisions')
      )
    ).toBe(true);
  });

  it('rejects the whole batch before UPDATE when any operation is invalid', async () => {
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          operations: [
            { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'actual', value: 0.24 },
            { type: 'setCell', sheetIndex: 0, rowIndex: 99, columnKey: 'actual', value: 1 },
          ],
        })
      );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('WORKBOOK_MUTATION_INVALID');
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });

  it('formats a rectangular range without changing values or formulas', async () => {
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.format.bold',
          operations: [
            {
              type: 'setCellStyle',
              sheetIndex: 0,
              startRow: 0,
              endRow: 1,
              startColumn: 1,
              endColumn: 1,
              patch: { bold: true, alignment: 'right', wrapText: true },
            },
          ],
        })
      );

    expect(response.status).toBe(200);
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets[0].rows[0].cells.actual).toMatchObject({
      value: 0.2,
      style: { bold: true, alignment: 'right', wrapText: true },
    });
    expect(saved.sheets[0].rows[1].cells.actual).toMatchObject({
      value: 0.6,
      style: { bold: true, alignment: 'right', wrapText: true },
    });
  });

  it('rejects unsupported or out-of-bounds formatting before persistence', async () => {
    for (const operation of [
      {
        type: 'setCellStyle',
        sheetIndex: 0,
        startRow: 0,
        endRow: 99,
        startColumn: 0,
        endColumn: 0,
        patch: { bold: true },
      },
      {
        type: 'setCellStyle',
        sheetIndex: 0,
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
        patch: { unsupported: true },
      },
    ]) {
      const response = await request(createApp())
        .post('/api/workbook/wb-1/commands')
        .send(body({ operations: [operation] }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WORKBOOK_MUTATION_INVALID');
    }
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });

  it('fails closed for a stale baseVersion', async () => {
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(body({ baseVersion: 3 }));

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'WORKBOOK_VERSION_CONFLICT',
      expectedVersion: 3,
      currentVersion: 4,
    });
  });

  it('returns the previous result for a repeated idempotency key', async () => {
    mockQueryOne.mockResolvedValue({
      schema_json: JSON.stringify(schema),
      version: 5,
      last_mutation_key: 'mutation-1',
    });
    const response = await request(createApp()).post('/api/workbook/wb-1/commands').send(body());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ duplicate: true, version: 5 });
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });

  it('detects a race when the conditional UPDATE changes no row', async () => {
    mockQueryRun.mockImplementation(async (sql: string) => ({
      changes: String(sql).includes('UPDATE generated_workbooks') ? 0 : 1,
    }));
    const response = await request(createApp()).post('/api/workbook/wb-1/commands').send(body());

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WORKBOOK_VERSION_CONFLICT');
  });

  it('applies sheet add, rename, duplicate, reorder and hide as one revision', async () => {
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.sheet.structure',
          operations: [
            { type: 'addSheet', name: 'Data', afterIndex: 0 },
            { type: 'renameSheet', sheetId: '11111111-1111-4111-8111-111111111111', name: 'KPI' },
            { type: 'duplicateSheet', sheetId: '11111111-1111-4111-8111-111111111111' },
            {
              type: 'reorderSheet',
              sheetId: '11111111-1111-4111-8111-111111111111',
              targetIndex: 2,
            },
            {
              type: 'setSheetHidden',
              sheetId: '11111111-1111-4111-8111-111111111111',
              hidden: true,
            },
          ],
        })
      );

    expect(response.status).toBe(200);
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets).toHaveLength(3);
    expect(saved.sheets.map((sheet: any) => sheet.name)).toEqual(['KPI kopia', 'Data', 'KPI']);
    expect(saved.sheets[2]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      hidden: true,
    });
    expect(saved.sheets[0].id).toMatch(/[0-9a-f-]{36}/);
    expect(saved.sheets[1].id).not.toBe(saved.sheets[2].id);
  });

  it('preserves validated client sheet ids so optimistic UI and comment anchors stay stable', async () => {
    const addedId = '33333333-3333-4333-8333-333333333333';
    const duplicatedId = '44444444-4444-4444-8444-444444444444';
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.sheet.structure',
          operations: [
            { type: 'addSheet', name: 'Data', sheetId: addedId },
            {
              type: 'duplicateSheet',
              sheetId: '11111111-1111-4111-8111-111111111111',
              name: 'Control copy',
              newSheetId: duplicatedId,
            },
          ],
        })
      );

    expect(response.status).toBe(200);
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets.map((sheet: any) => sheet.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      duplicatedId,
      addedId,
    ]);
  });

  it('rejects malformed or colliding client sheet ids before persistence', async () => {
    for (const operation of [
      { type: 'addSheet', name: 'Bad', sheetId: 'not-a-uuid' },
      {
        type: 'duplicateSheet',
        sheetId: '11111111-1111-4111-8111-111111111111',
        newSheetId: '11111111-1111-4111-8111-111111111111',
      },
    ]) {
      const response = await request(createApp())
        .post('/api/workbook/wb-1/commands')
        .send(body({ operations: [operation] }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WORKBOOK_MUTATION_INVALID');
    }
    expect(
      mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE generated_workbooks'))
    ).toBe(false);
  });

  it('rejects deleting the last sheet and hiding the last visible sheet', async () => {
    for (const operation of [
      { type: 'deleteSheet', sheetId: '11111111-1111-4111-8111-111111111111' },
      { type: 'setSheetHidden', sheetId: '11111111-1111-4111-8111-111111111111', hidden: true },
    ]) {
      const response = await request(createApp())
        .post('/api/workbook/wb-1/commands')
        .send(body({ operations: [operation] }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WORKBOOK_MUTATION_INVALID');
    }
    expect(
      mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE generated_workbooks'))
    ).toBe(false);
  });

  it('orphans comments anchored to a deleted sheet', async () => {
    const twoSheets = {
      ...schema,
      sheets: [
        ...schema.sheets,
        { id: '22222222-2222-4222-8222-222222222222', name: 'Data', columns: [], rows: [] },
      ],
    };
    mockQueryOne.mockResolvedValue({
      schema_json: JSON.stringify(twoSheets),
      version: 4,
      last_mutation_key: null,
    });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.sheet.delete',
          operations: [{ type: 'deleteSheet', sheetId: '22222222-2222-4222-8222-222222222222' }],
        })
      );

    expect(response.status).toBe(200);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('generated_workbook_comments') &&
          String(call[0]).includes("SET anchor_state = 'orphaned'") &&
          call[1].includes('22222222-2222-4222-8222-222222222222')
      )
    ).toBe(true);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('generated_workbook_source_bindings') &&
          String(call[0]).includes("SET anchor_state = 'orphaned'") &&
          call[1].includes('22222222-2222-4222-8222-222222222222')
      )
    ).toBe(true);
  });

  it('inserts rows atomically and shifts same-sheet and qualified cross-sheet formulas', async () => {
    const structuralSchema = {
      title: 'Formula model',
      sheets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Control',
          columns: [
            { key: 'metric', header: 'Metric' },
            { key: 'actual', header: 'Actual' },
          ],
          rows: [
            { cells: { metric: { value: 'Conversion' }, actual: { value: 0.2 } } },
            { cells: { metric: { value: 'Margin' }, actual: { formula: 'B2*2' } } },
          ],
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Summary',
          columns: [{ key: 'value', header: 'Value' }],
          rows: [{ cells: { value: { formula: "'Control'!$B$3" } } }],
        },
      ],
    };
    mockQueryOne.mockResolvedValue({
      schema_json: JSON.stringify(structuralSchema),
      version: 4,
      last_mutation_key: null,
    });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.row.insertAbove',
          operations: [{ type: 'insertRows', sheetIndex: 0, atIndex: 0, count: 1 }],
        })
      );

    expect(response.status).toBe(200);
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets[0].rows).toHaveLength(3);
    expect(saved.sheets[0].rows[0].cells).toEqual({});
    expect(saved.sheets[0].rows[2].cells.actual.formula).toBe('B3*2');
    expect(saved.sheets[1].rows[0].cells.value.formula).toBe("'Control'!$B$4");
  });

  it('deletes columns, removes their cell payloads and makes deleted references explicit', async () => {
    const structuralSchema = {
      title: 'Formula model',
      sheets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Control',
          columns: [
            { key: 'metric', header: 'Metric' },
            { key: 'actual', header: 'Actual' },
            { key: 'variance', header: 'Variance' },
          ],
          rows: [
            {
              cells: {
                metric: { value: 'Conversion' },
                actual: { value: 0.2 },
                variance: { formula: 'C2-B2' },
              },
            },
          ],
        },
      ],
    };
    mockQueryOne.mockResolvedValue({
      schema_json: JSON.stringify(structuralSchema),
      version: 4,
      last_mutation_key: null,
    });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.column.delete',
          operations: [{ type: 'deleteColumns', sheetIndex: 0, atIndex: 1, count: 1 }],
        })
      );

    expect(response.status).toBe(200);
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    const saved = JSON.parse(update![1][0]);
    expect(saved.sheets[0].columns.map((column: any) => column.key)).toEqual([
      'metric',
      'variance',
    ]);
    expect(saved.sheets[0].rows[0].cells.actual).toBeUndefined();
    expect(saved.sheets[0].rows[0].cells.variance.formula).toBe('B2-#REF!');
  });

  it('moves comment anchors after structural insertion', async () => {
    mockQueryAll
      .mockResolvedValueOnce([
        { id: 'comment-move', sheet_id: '11111111-1111-4111-8111-111111111111', range_ref: 'A2:B3' },
      ])
      .mockResolvedValueOnce([]);

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.row.insertAbove',
          operations: [{ type: 'insertRows', sheetIndex: 0, atIndex: 1, count: 1 }],
        })
      );

    expect(response.status).toBe(200);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('SET range_ref = ?') &&
          call[1][0] === 'A2:B4' &&
          call[1][2] === 'comment-move'
      )
    ).toBe(true);
  });

  it('orphans a comment whose complete anchor is deleted', async () => {
    mockQueryAll
      .mockResolvedValueOnce([
        { id: 'comment-delete', sheet_id: '11111111-1111-4111-8111-111111111111', range_ref: 'A2' },
      ])
      .mockResolvedValueOnce([]);
    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.row.delete',
          operations: [{ type: 'deleteRows', sheetIndex: 0, atIndex: 0, count: 1 }],
        })
      );
    expect(response.status).toBe(200);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes("SET anchor_state = 'orphaned'") &&
          call[1][0] === 'comment-delete'
      )
    ).toBe(true);
  });

  it('moves source anchors after structural insertion', async () => {
    mockQueryAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'source-move', sheet_id: '11111111-1111-4111-8111-111111111111', range_ref: 'A2:B3' },
      ]);

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.row.insertAbove',
          operations: [{ type: 'insertRows', sheetIndex: 0, atIndex: 1, count: 1 }],
        })
      );

    expect(response.status).toBe(200);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('generated_workbook_source_bindings') &&
          String(call[0]).includes('SET range_ref = ?') &&
          call[1][0] === 'A2:B4' &&
          call[1][2] === 'source-move'
      )
    ).toBe(true);
  });

  it('orphans a source binding whose complete anchor is deleted', async () => {
    mockQueryAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'source-delete', sheet_id: '11111111-1111-4111-8111-111111111111', range_ref: 'A2' },
      ]);

    const response = await request(createApp())
      .post('/api/workbook/wb-1/commands')
      .send(
        body({
          commandId: 'xlsx.row.delete',
          operations: [{ type: 'deleteRows', sheetIndex: 0, atIndex: 0, count: 1 }],
        })
      );

    expect(response.status).toBe(200);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('generated_workbook_source_bindings') &&
          String(call[0]).includes("SET anchor_state = 'orphaned'") &&
          call[1][0] === 'source-delete'
      )
    ).toBe(true);
  });

  it('rejects deleting every row or every column before persistence', async () => {
    for (const operation of [
      { type: 'deleteRows', sheetIndex: 0, atIndex: 0, count: 2 },
      { type: 'deleteColumns', sheetIndex: 0, atIndex: 0, count: 2 },
    ]) {
      const response = await request(createApp())
        .post('/api/workbook/wb-1/commands')
        .send(body({ operations: [operation] }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WORKBOOK_MUTATION_INVALID');
    }
    expect(
      mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE generated_workbooks'))
    ).toBe(false);
  });

  it('lists append-only revisions for the organization', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'rev-5',
        version: 5,
        command_id: 'xlsx.range.paste',
        created_by: 'user-1',
      },
    ]);

    const response = await request(createApp()).get('/api/workbook/wb-1/revisions');

    expect(response.status).toBe(200);
    expect(response.body.revisions[0]).toMatchObject({ version: 5 });
    expect(mockQueryAll.mock.calls.at(-1)?.[1]).toEqual(['wb-1', 'org-1']);
  });

  it('undoes an atomic command as a new revision and reconnects restored sheet comments', async () => {
    const deletedSheetId = '22222222-2222-4222-8222-222222222222';
    const schemaBeforeDelete = {
      ...schema,
      sheets: [...schema.sheets, { id: deletedSheetId, name: 'Data', columns: [], rows: [] }],
    };
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 })
      .mockResolvedValueOnce({ base_schema_json: JSON.stringify(schemaBeforeDelete) });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/revisions/5/undo')
      .send({ baseVersion: 5 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      commandVersion: 5,
      version: 6,
      restoredCommentSheetIds: [deletedSheetId],
      orphanedCommentSheetIds: [],
    });
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    expect(update?.[1][0]).toBe(JSON.stringify(schemaBeforeDelete));
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes("SET anchor_state = 'active'") &&
          call[1].includes(deletedSheetId)
      )
    ).toBe(true);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_revisions') &&
          call[1].includes('xlsx.history.undo')
      )
    ).toBe(true);
  });

  it('fails closed when undo is attempted from a stale workbook head', async () => {
    mockQueryOne.mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 6 });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/revisions/5/undo')
      .send({ baseVersion: 5 });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'WORKBOOK_VERSION_CONFLICT',
      expectedVersion: 5,
      currentVersion: 6,
    });
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });

  it('restores a revision as a new head without deleting later history', async () => {
    const restoredSheetId = '22222222-2222-4222-8222-222222222222';
    const restored = JSON.stringify({
      ...schema,
      title: 'Restored KPI',
      sheets: [{ ...schema.sheets[0], id: restoredSheetId }],
    });
    mockQueryOne
      .mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 })
      .mockResolvedValueOnce({ schema_json: restored });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/revisions/3/restore')
      .send({ baseVersion: 5 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sourceVersion: 3,
      version: 6,
      restoredCommentSheetIds: [restoredSheetId],
      orphanedCommentSheetIds: [schema.sheets[0].id],
    });
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    expect(update?.[1][0]).toBe(restored);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_revisions') &&
          call[1].includes('xlsx.versions.restore')
      )
    ).toBe(true);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes("anchor_state = 'active'") && call[1].includes(restoredSheetId)
      )
    ).toBe(true);
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes("anchor_state = 'orphaned'") &&
          call[1].includes(schema.sheets[0].id)
      )
    ).toBe(true);
  });

  it('renames a workbook as an optimistic, versioned mutation', async () => {
    mockQueryOne.mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 5 });

    const response = await request(createApp())
      .patch('/api/workbook/wb-1/title')
      .send({ title: 'Executive KPI Control 2027', baseVersion: 5 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      title: 'Executive KPI Control 2027',
      version: 6,
      unchanged: false,
    });
    const update = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE generated_workbooks')
    );
    expect(update?.[1][0]).toBe('Executive KPI Control 2027');
    expect(JSON.parse(update?.[1][1] as string).title).toBe('Executive KPI Control 2027');
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_revisions') &&
          call[1].includes('xlsx.workbook.rename')
      )
    ).toBe(true);
  });

  it('rejects a stale workbook rename without updating the workbook', async () => {
    mockQueryOne.mockResolvedValueOnce({ schema_json: JSON.stringify(schema), version: 6 });

    const response = await request(createApp())
      .patch('/api/workbook/wb-1/title')
      .send({ title: 'Stale title', baseVersion: 5 });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'WORKBOOK_VERSION_CONFLICT',
      expectedVersion: 5,
      currentVersion: 6,
    });
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });

  it('requires an audited reason when lowering workbook classification', async () => {
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'draft',
      approval_current: 0,
      quality_report_json: null,
    });

    const rejected = await request(createApp()).patch('/api/workbook/wb-1/governance').send({
      field: 'classification',
      value: 'public',
      baseVersion: 5,
    });

    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe('CLASSIFICATION_DOWNGRADE_REASON_REQUIRED');
    expect(mockQueryRun.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);

    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'draft',
      approval_current: 0,
      quality_report_json: null,
    });

    const accepted = await request(createApp()).patch('/api/workbook/wb-1/governance').send({
      field: 'classification',
      value: 'public',
      reason: 'Materiał zatwierdzony do publikacji.',
      baseVersion: 5,
    });

    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      classification: 'public',
      lifecycleStatus: 'draft',
      unchanged: false,
    });
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('INSERT INTO generated_workbook_governance_events') &&
          call[1].includes('classification.changed') &&
          call[1].includes('Materiał zatwierdzony do publikacji.')
      )
    ).toBe(true);
  });

  it('fails closed when final lifecycle lacks approval or has critical QA findings', async () => {
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'draft',
      approval_current: 0,
      quality_report_json: null,
    });

    const withoutApproval = await request(createApp())
      .patch('/api/workbook/wb-1/governance')
      .send({ field: 'lifecycleStatus', value: 'final', baseVersion: 5 });

    expect(withoutApproval.status).toBe(409);
    expect(withoutApproval.body.code).toBe('WORKBOOK_APPROVAL_REQUIRED');

    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'approved',
      approval_current: 1,
      quality_report_json: JSON.stringify({
        issues: [{ severity: 'critical', blocking: true, code: 'MISSING_SOURCE' }],
      }),
    });

    const blockedByQa = await request(createApp())
      .patch('/api/workbook/wb-1/governance')
      .send({ field: 'lifecycleStatus', value: 'final', baseVersion: 5 });

    expect(blockedByQa.status).toBe(409);
    expect(blockedByQa.body.code).toBe('WORKBOOK_QA_BLOCKED');
  });
});

describe('workbook approval governance', () => {
  it('returns tenant-scoped governance events in a user-facing audit envelope', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'wb-1' });
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'event-1',
        event_type: 'classification.changed',
        previous_value: 'internal',
        next_value: 'public',
        reason: 'Approved for publication.',
        workbook_version: 5,
        created_by: 'user-1',
        created_at: '2026-08-09T10:00:00.000Z',
      },
    ]);

    const response = await request(createApp()).get('/api/workbook/wb-1/governance-events');

    expect(response.status).toBe(200);
    expect(response.body.events).toEqual([
      expect.objectContaining({
        eventType: 'classification.changed',
        previousValue: 'internal',
        nextValue: 'public',
        reason: 'Approved for publication.',
        workbookVersion: 5,
        createdBy: 'user-1',
      }),
    ]);
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'wb-1',
      'org-1',
    ]);
    expect(mockQueryAll).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'wb-1',
      'org-1',
    ]);
  });

  it('blocks a direct lifecycle transition into review without a reviewer assignment', async () => {
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'draft',
      approval_current: 0,
      quality_report_json: null,
    });

    const response = await request(createApp()).patch('/api/workbook/wb-1/governance').send({
      field: 'lifecycleStatus',
      value: 'in_review',
      baseVersion: 5,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WORKBOOK_REVIEW_ASSIGNMENT_REQUIRED');
    expect(mockSubmitForReview).not.toHaveBeenCalled();
    expect(
      mockQueryRun.mock.calls.some((call) =>
        String(call[0]).includes("SET lifecycle_status = 'in_review'")
      )
    ).toBe(false);
  });

  it('submits review to a distinct reviewer and records a governance event', async () => {
    mockQueryOne.mockResolvedValueOnce({ version: 5 });

    const response = await request(createApp())
      .post('/api/workbook/wb-1/approval/submit')
      .send({ assignedToUserId: 'reviewer-2' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      state: 'review',
      currentForVersion: false,
      workbookVersion: 5,
    });
    expect(mockSubmitForReview).toHaveBeenCalledWith({
      orgId: 'org-1',
      artifactType: 'workbook',
      artifactId: 'wb-1',
      assignedToUserId: 'reviewer-2',
      submittedBy: 'user-1',
    });
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes('generated_workbook_governance_events') &&
          String(call[0]).includes('approval.submitted') &&
          call[1].includes('Assigned reviewer: reviewer-2')
      )
    ).toBe(true);
  });

  it('marks only the approved current version as approved', async () => {
    mockQueryOne.mockResolvedValueOnce({ version: 5 });

    const response = await request(createApp()).post('/api/workbook/wb-1/approval/approve');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ state: 'approved', currentForVersion: true });
    expect(mockApproveArtifact).toHaveBeenCalledWith({
      orgId: 'org-1',
      artifactType: 'workbook',
      artifactId: 'wb-1',
      approvedByUserId: 'user-1',
    });
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          String(call[0]).includes("lifecycle_status = 'approved'") && call[1].includes('wb-1')
      )
    ).toBe(true);
  });

  it('invalidates a current approval when classification changes', async () => {
    mockQueryOne.mockResolvedValueOnce({
      version: 5,
      classification: 'internal',
      lifecycle_status: 'approved',
      approval_current: 1,
      quality_report_json: null,
    });

    const response = await request(createApp()).patch('/api/workbook/wb-1/governance').send({
      field: 'classification',
      value: 'confidential',
      baseVersion: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.approvalCurrent).toBe(false);
    expect(
      mockQueryRun.mock.calls.some(
        (call) => String(call[0]).includes('approval_current = 0') && call[1][0] === 'confidential'
      )
    ).toBe(true);
  });
});
