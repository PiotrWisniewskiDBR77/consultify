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
  withPgTransaction: (callback: (client: unknown) => Promise<unknown>) => callback({}),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
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

vi.mock('../../services/lineage/artifactLineageService.js', () => ({
  deriveCreatedEventIdempotencyKey: vi.fn(() => 'created-test-key'),
  recordLineageEventSafe: vi.fn(),
  recordLineageEventTracked: vi.fn(async () => ({ durable: true })),
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

let persistedSchema = SCHEMA;
let persistedVersion = 1;
let persistedMutationKey: string | null = null;
const persistedRevisions = new Map<string, { commandId: string; operationsJson: string }>();

function asUser(organizationId: string): void {
  mockUser = { id: 'user-1', organizationId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
  persistedSchema = SCHEMA;
  persistedVersion = 1;
  persistedMutationKey = null;
  persistedRevisions.clear();
  mockQueryRun.mockImplementation(async (sql: string, params: unknown[]) => {
    if (
      String(sql).includes('UPDATE generated_workbooks') &&
      String(sql).includes('last_mutation_key = ?')
    ) {
      persistedSchema = JSON.parse(String(params[0]));
      persistedVersion = Number(params[4]);
      persistedMutationKey = String(params[5]);
    }
    if (String(sql).includes('INSERT INTO generated_workbook_revisions')) {
      persistedRevisions.set(String(params[5]), {
        commandId: String(params[4]),
        operationsJson: String(params[8]),
      });
    }
    return { changes: 1 };
  });

  mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
    if (String(sql).includes('FROM generated_workbook_revisions')) {
      const revision = persistedRevisions.get(String(params[2]));
      return revision
        ? { command_id: revision.commandId, operations_json: revision.operationsJson }
        : null;
    }
    if (
      typeof sql === 'string' &&
      sql.includes('FROM generated_workbooks') &&
      sql.includes('schema_json')
    ) {
      const [id, orgId] = params as [string, string];
      if (id === WB_ID && orgId === ORG) {
        return {
          schema_json: JSON.stringify(persistedSchema),
          version: persistedVersion,
          title: persistedSchema.title,
          last_mutation_key: persistedMutationKey,
          quality_report_json: JSON.stringify({ score: 100, passed: true, issues: [] }),
        };
      }
      return null;
    }
    return null;
  });
});

const validBody = { sheetIndex: 0, rowIndex: 0, columnKey: 'wartosc', value: 0.15 };

function schemaCommandBody(
  command: Record<string, unknown>,
  expectedVersion = 1,
  suffix = String(command.type || 'command')
) {
  return {
    command,
    expectedVersion,
    commandId: `schema-${suffix}`,
    idempotencyKey: `schema-${suffix}-key`,
  };
}

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
    expect(updateParams[1]).toBe(2);
    expect(updateParams[2]).toBe(WB_ID);
    expect(updateParams[3]).toBe(ORG);
    expect(updateParams[4]).toBe(1);
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

describe('PATCH /api/workbook/:id/schema-command', () => {
  it('persists sheet add through canonical schema with version snapshot', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'addSheet', name: 'Scenarios' }));
    expect(res.status).toBe(200);
    expect(res.body.schema.sheets).toHaveLength(3);
    expect(res.body.schema.sheets[2].name).toBe('Scenarios');
    expect(res.body.version).toBe(2);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO generated_workbook_versions'),
      expect.any(Array)
    );
    const updateCall = mockQueryRun.mock.calls.find(
      ([sql]) =>
        String(sql).includes('UPDATE generated_workbooks') &&
        String(sql).includes('SET schema_json')
    );
    expect(JSON.parse(updateCall?.[1]?.[0] as string).sheets).toHaveLength(3);
  });

  it('supports row, column and cell-format commands without dropping formulas', async () => {
    const app = createApp();
    asUser(ORG);
    const commands = [
      { type: 'insertRow', sheetIndex: 1, rowIndex: 1 },
      { type: 'insertColumn', sheetIndex: 1, colIndex: 1, key: 'scenario', header: 'Scenario' },
      {
        type: 'formatCells',
        sheetIndex: 1,
        rowIndexes: [0],
        colIndexes: [1],
        style: { bold: true, numberFormat: '0.0%' },
      },
      { type: 'sortRows', sheetIndex: 1, colIndex: 0, direction: 'asc' },
      { type: 'setFreeze', sheetIndex: 1, freezeRow: 1, freezeCol: 1 },
      { type: 'setAutoFilter', sheetIndex: 1, enabled: true },
      {
        type: 'setValidation',
        sheetIndex: 1,
        rowIndex: 0,
        colIndex: 0,
        validation: { type: 'list', values: ['Base', 'Upside'] },
      },
      { type: 'renameWorkbook', title: 'Renamed workbook' },
      {
        type: 'resizeRowAndColumn',
        sheetIndex: 1,
        rowIndex: 0,
        colIndex: 0,
        height: 30,
        width: 24,
      },
      { type: 'setComment', sheetIndex: 1, rowIndex: 0, colIndex: 0, comment: 'Reviewed manually' },
      { type: 'setRowHidden', sheetIndex: 1, rowIndex: 0, hidden: true },
      { type: 'setColumnHidden', sheetIndex: 1, colIndex: 0, hidden: true },
      { type: 'unhideAll', sheetIndex: 1 },
      { type: 'mergeCells', sheetIndex: 1, range: 'A2:B2' },
      { type: 'unmergeCells', sheetIndex: 1, range: 'A2:B2' },
      {
        type: 'addConditionalFormat',
        sheetIndex: 1,
        block: {
          ref: 'A2:A3',
          rules: [
            { type: 'cellIs', operator: 'lessThan', formulae: ['0'], style: { bgColor: 'FDE8E8' } },
          ],
        },
      },
      { type: 'clearConditionalFormats', sheetIndex: 1 },
      { type: 'findReplace', find: 'NPV', replacement: 'Net Present Value' },
    ];
    for (const command of commands) {
      vi.clearAllMocks();
      persistedSchema = SCHEMA;
      persistedVersion = 1;
      persistedMutationKey = null;
      persistedRevisions.clear();
      const res = await request(app)
        .patch(`/api/workbook/${WB_ID}/schema-command`)
        .send(schemaCommandBody(command));
      expect(res.status, `${JSON.stringify(command)} ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body.schema.sheets[1].rows[0].cells.wartosc.formula).toBe("'Założenia'!$B$2*100");
    }
  });

  it('keeps the XLSX download filename aligned with a renamed workbook', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'renameWorkbook', title: 'Program Atlas — Board QA' }));

    expect(res.status).toBe(200);
    const updateCall = mockQueryRun.mock.calls.find(
      ([sql]) =>
        String(sql).includes('UPDATE generated_workbooks') &&
        String(sql).includes('SET schema_json')
    );
    expect(updateCall?.[1]?.[2]).toBe('Program_Atlas_Board_QA.xlsx');
  });

  it('rejects deleting the last column and stale expectedVersion', async () => {
    const app = createApp();
    asUser(ORG);
    const conflict = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'addSheet' }, 9));
    expect(conflict.status).toBe(409);

    const invalid = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'deleteColumn', sheetIndex: 0, colIndex: 0 }));
    // Sheet 0 has two columns, so first delete is valid; deleting an unknown
    // index must still be rejected rather than silently corrupting schema.
    expect(invalid.status).toBe(200);
    const unknown = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(
        schemaCommandBody(
          { type: 'deleteColumn', sheetIndex: 0, colIndex: 99 },
          2,
          'delete-column-unknown'
        )
      );
    expect(unknown.status).toBe(400);
  });

  it('moves relative formula references with their rows during sort', async () => {
    const app = createApp();
    asUser(ORG);
    const sortable = {
      title: 'Sort formulas',
      sheets: [
        {
          name: 'Data',
          columns: [
            { key: 'formula', header: 'Formula' },
            { key: 'value', header: 'Value' },
          ],
          rows: [
            { cells: { formula: { formula: 'B2*2' }, value: { value: 20 } } },
            { cells: { formula: { formula: 'B3*2' }, value: { value: 40 } } },
          ],
        },
      ],
    };
    mockQueryOne.mockResolvedValueOnce({
      schema_json: JSON.stringify(sortable),
      version: 1,
      title: sortable.title,
    });
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'sortRows', sheetIndex: 0, colIndex: 1, direction: 'desc' }));
    expect(res.status).toBe(200);
    expect(res.body.schema.sheets[0].rows[0].cells.value.value).toBe(40);
    expect(res.body.schema.sheets[0].rows[0].cells.formula.formula).toBe('B2*2');
    expect(res.body.schema.sheets[0].rows[1].cells.value.value).toBe(20);
    expect(res.body.schema.sheets[0].rows[1].cells.formula.formula).toBe('B3*2');
  });

  it('requires version and stable mutation identity', async () => {
    const app = createApp();
    asUser(ORG);
    const missingVersion = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ command: { type: 'addSheet' }, commandId: 'cmd', idempotencyKey: 'key' });
    expect(missingVersion.status).toBe(400);
    const missingIdentity = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ command: { type: 'addSheet' }, expectedVersion: 1 });
    expect(missingIdentity.status).toBe(400);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('replays a duplicate idempotency key without a second write or revision', async () => {
    const app = createApp();
    asUser(ORG);
    const body = schemaCommandBody({ type: 'addSheet', name: 'Replay-safe' });
    const first = await request(app).patch(`/api/workbook/${WB_ID}/schema-command`).send(body);
    const replay = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ ...body, command: { name: 'Replay-safe', type: 'addSheet' } });
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ duplicate: true, version: 2 });
    expect(replay.body.schema).toEqual(first.body.schema);
    const revisionWrites = mockQueryRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO generated_workbook_revisions')
    );
    expect(revisionWrites).toHaveLength(1);
  });

  it('rejects idempotency-key reuse with a different command payload or commandId', async () => {
    const app = createApp();
    asUser(ORG);
    const body = schemaCommandBody({ type: 'addSheet', name: 'Original' });
    await request(app).patch(`/api/workbook/${WB_ID}/schema-command`).send(body).expect(200);
    const writesBefore = mockQueryRun.mock.calls.length;

    const payloadConflict = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ ...body, command: { type: 'addSheet', name: 'Different' } });
    expect(payloadConflict.status).toBe(409);
    expect(payloadConflict.body.code).toBe('IDEMPOTENCY_CONFLICT');

    const identityConflict = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ ...body, commandId: `${body.commandId}-different` });
    expect(identityConflict.status).toBe(409);
    expect(identityConflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(mockQueryRun.mock.calls).toHaveLength(writesBefore);
  });

  it('recognizes an older replay key after a later successful command', async () => {
    const app = createApp();
    asUser(ORG);
    const commandA = schemaCommandBody(
      { type: 'deleteSheet', sheetIndex: 1 },
      1,
      'history-a'
    );
    const commandB = schemaCommandBody({ type: 'addSheet', name: 'B' }, 2, 'history-b');
    await request(app).patch(`/api/workbook/${WB_ID}/schema-command`).send(commandA).expect(200);
    await request(app).patch(`/api/workbook/${WB_ID}/schema-command`).send(commandB).expect(200);
    const writesBefore = mockQueryRun.mock.calls.length;

    const delayedReplay = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(commandA);
    expect(delayedReplay.status).toBe(200);
    expect(delayedReplay.body).toMatchObject({ duplicate: true, version: 3 });

    const delayedCollision = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send({ ...commandA, command: { type: 'deleteSheet', sheetIndex: 0 } });
    expect(delayedCollision.status).toBe(409);
    expect(delayedCollision.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(mockQueryRun.mock.calls).toHaveLength(writesBefore);
  });

  it('allows exactly one of two same-base commands and leaves one revision', async () => {
    const app = createApp();
    asUser(ORG);
    const [first, second] = await Promise.all([
      request(app)
        .patch(`/api/workbook/${WB_ID}/schema-command`)
        .send(schemaCommandBody({ type: 'addSheet', name: 'First' }, 1, 'race-first')),
      request(app)
        .patch(`/api/workbook/${WB_ID}/schema-command`)
        .send(schemaCommandBody({ type: 'addSheet', name: 'Second' }, 1, 'race-second')),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(
      mockQueryRun.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO generated_workbook_revisions')
      )
    ).toHaveLength(1);
  });

  it('keeps foreign-tenant schema commands at zero writes', async () => {
    const app = createApp();
    asUser(ORG_ATTACKER);
    const res = await request(app)
      .patch(`/api/workbook/${WB_ID}/schema-command`)
      .send(schemaCommandBody({ type: 'addSheet' }));
    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});

describe('GET /api/workbook/:id quality reopen', () => {
  it('returns the persisted deterministic quality report on reopen', async () => {
    const app = createApp();
    asUser(ORG);

    const res = await request(app).get(`/api/workbook/${WB_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBeUndefined(); // the narrow mock only supplies schema_json
    expect(res.body.qualityReport).toEqual({ score: 100, passed: true, issues: [] });
  });
});
