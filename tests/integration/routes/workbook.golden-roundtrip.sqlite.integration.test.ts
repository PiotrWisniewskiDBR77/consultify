/** @vitest-environment node */

/**
 * MAT-003A — real workbook runtime golden round-trip.
 *
 * Keeps the production route, queryHelpers, WorkbookBuilder and ExcelJS active.
 * Only infrastructure edges are substituted: auth and artifact registration,
 * while generated_workbooks is a real in-memory SQLite table.
 */
import ExcelJS from 'exceljs';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => sqliteCtx.db,
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = 'user-mat-003a';
    req.organizationId = 'org-mat-003a';
    req.user = { id: 'user-mat-003a', organizationId: 'org-mat-003a' };
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-mat-003a' }),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
}));

import workbookRoutes from '../../../server/src/routes/workbook.routes.js';

function runSql(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, (error) => (error ? reject(error) : resolve()));
  });
}

describe('MAT-003A workbook golden round-trip (SQLite + real XLSX)', () => {
  beforeAll(async () => {
    await runSql(`
      CREATE TABLE generated_workbooks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        prompt TEXT,
        schema_json TEXT,
        sheet_count INTEGER DEFAULT 1,
        file_name TEXT,
        file_size INTEGER,
        validation_errors TEXT,
        quality_score REAL,
        pipeline_log TEXT,
        action_contract_json TEXT DEFAULT '{}',
        source_pack_json TEXT DEFAULT '{}',
        evidence_refs_json TEXT DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runSql(`
      CREATE TABLE tp_base_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        schema_snapshot TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((error) => (error ? reject(error) : resolve()));
      })
  );

  it('creates blank → saves value and formula → reopens → exports matching XLSX', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);

    const created = await request(app)
      .post('/api/workbook/blank')
      .send({ title: 'MAT-003A Roundtrip' })
      .expect(201);
    const workbookId = String(created.body.id);
    expect(workbookId).toBeTruthy();
    expect(created.body.artifactId).toBe('artifact-mat-003a');

    await request(app)
      .patch(`/api/workbook/${workbookId}/cell`)
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 })
      .expect(200);
    await request(app)
      .patch(`/api/workbook/${workbookId}/cell`)
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'B', formula: '=A2*2' })
      .expect(200);

    const reopened = await request(app).get(`/api/workbook/${workbookId}`).expect(200);
    const cells = reopened.body.schema_json.sheets[0].rows[0].cells;
    expect(cells.A).toEqual(expect.objectContaining({ value: 21 }));
    expect(cells.B).toEqual(expect.objectContaining({ formula: 'A2*2' }));

    const download = await request(app)
      .get(`/api/workbook/${workbookId}/download`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      })
      .expect(200);
    expect(download.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Buffer.isBuffer(download.body)).toBe(true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(download.body as Buffer);
    const sheet = workbook.getWorksheet('Arkusz1');
    expect(sheet).toBeDefined();
    expect(sheet!.getCell('A2').value).toBe(21);
    expect(sheet!.getCell('B2').value).toEqual(expect.objectContaining({ formula: 'A2*2' }));
  });

  it('saved custom template → build → persisted schema reopen → XLSX download', async () => {
    const schemaSnapshot = {
      title: 'Saved margin model',
      sheets: [
        {
          name: 'Model',
          columns: [
            { key: 'A', header: 'Revenue', type: 'currency', numberFormat: '#,##0.00' },
            { key: 'B', header: 'Margin', type: 'percent', numberFormat: '0.0%' },
          ],
          rows: [{ cells: { A: { value: 1000 }, B: { formula: 'A2/2000' } } }],
        },
      ],
    };
    await runSql(
      `INSERT OR REPLACE INTO tp_base_templates
         (id, name, description, schema_snapshot, organization_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'custom-template-1',
        'Saved margin model',
        'Created by Template Builder',
        JSON.stringify(schemaSnapshot),
        'org-mat-003a',
        'user-mat-003a',
      ]
    );

    const app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);

    const built = await request(app)
      .post('/api/workbook/templates/custom-template-1/build')
      .send({ params: {} });
    expect(built.status, JSON.stringify(built.body)).toBe(200);
    const workbookId = String(built.body.id);
    expect(workbookId).toBeTruthy();
    expect(built.body.downloadUrl).toBe(`/api/workbook/${workbookId}/download`);

    const reopened = await request(app).get(`/api/workbook/${workbookId}/schema`).expect(200);
    expect(reopened.body.sheets[0].columns[1]).toEqual(
      expect.objectContaining({ key: 'B', numberFormat: '0.0%' })
    );
    expect(reopened.body.sheets[0].rows[0].cells.B.formula).toBe('A2/2000');

    const download = await request(app)
      .get(`/api/workbook/${workbookId}/download`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      })
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(download.body as Buffer);
    expect(workbook.getWorksheet('Model')!.getCell('B2').value).toEqual(
      expect.objectContaining({ formula: 'A2/2000' })
    );
  });

  it('fails closed when a blank workbook cannot be persisted', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);

    // ensureWorkbookSchema has already completed in the preceding golden test,
    // so removing the durable store simulates a runtime persistence outage.
    await runSql('DROP TABLE generated_workbooks');

    const response = await request(app)
      .post('/api/workbook/blank')
      .send({ title: 'Must not become memory-only' })
      .expect(500);
    expect(response.body.id).toBeUndefined();
  });
});
