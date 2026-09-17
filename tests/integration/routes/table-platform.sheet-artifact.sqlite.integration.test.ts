/**
 * Integration: table-platform governed sheet registration + XLSX export with registerArtifact,
 * using real artifactRegistryService + SQLite (DbPromise mock) and a stubbed Postgres pool for tp_tables / schema probes.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyArtifactSubstrateDdl,
  clearArtifactSubstrateTables,
} from '../helpers/artifactSubstrateSqliteContext.js';
import {
  createTestSqliteDatabase,
  type NodeSqliteCompatDatabase,
} from '../helpers/nodeSqliteCompat.js';

const sqliteCtx = vi.hoisted(() => {
  return { db: null as unknown as NodeSqliteCompatDatabase };
});
sqliteCtx.db = createTestSqliteDatabase() as NodeSqliteCompatDatabase;

const queryMock = vi.hoisted(() =>
  vi.fn((sql: string, params?: unknown[]) => {
    if (sql.includes('FROM tp_bases')) {
      return Promise.resolve({ rows: [] });
    }
    if (sql.includes('FROM tp_tables') && params?.[0] === 'tbl-governed-1') {
      return Promise.resolve({
        rows: [{ name: 'Governed matrix', governance_mode: 'governed' }],
      });
    }
    if (sql.includes('FROM tp_tables') && params?.[0] === 'tbl-operational-1') {
      return Promise.resolve({
        rows: [{ name: 'Ops only', governance_mode: 'operational' }],
      });
    }
    return Promise.resolve({ rows: [] });
  })
);

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: <T = unknown>(
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean }
  ): Promise<T | null> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.get(sql, params || [], (err: Error | null, row: unknown) => {
        if (err) {
          if (fallback) resolve(null);
          else reject(err);
          return;
        }
        resolve((row || null) as T | null);
      });
    }),
  all: <T = unknown>(
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean }
  ): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.all(sql, params || [], (err: Error | null, rows: unknown[]) => {
        if (err) {
          if (fallback) resolve([]);
          else reject(err);
          return;
        }
        resolve((rows || []) as T[]);
      });
    }),
  run: (
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean }
  ): Promise<{ success: boolean; changes?: number; lastID?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.run(
        sql,
        params || [],
        function (this: { changes: number; lastID?: number }, err: Error | null) {
          if (err) {
            if (fallback) resolve({ success: false, error: err.message });
            else reject(err);
            return;
          }
          resolve({ success: true, changes: this.changes, lastID: this.lastID });
        }
      );
    }),
  default: {},
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]])),
  }),
}));

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  ipKeyGenerator: vi.fn(() => () => 'test-ip'),
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = 'user-tp-sheet';
    req.organizationId = 'org-tp';
    req.user = { id: 'user-tp-sheet', organizationId: 'org-tp' };
    next();
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/tablePlatform/PermissionsService.js', () => ({
  default: {
    requireBaseAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireTableAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireFieldAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRecordAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireFormAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireViewAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireGovernedModelAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRole: vi.fn().mockResolvedValue({ role: 'owner' }),
    canAccessBase: vi.fn().mockResolvedValue(true),
    SCHEMA_ROLES: ['owner'],
    DATA_ROLES: ['owner'],
    VIEW_ROLES: ['owner'],
    INTERFACE_ROLES: ['owner'],
    ALL_ROLES: ['owner'],
  },
}));

const buildXlsxBufferMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from([80, 75, 3, 4]))
);
const getTableNameMock = vi.hoisted(() => vi.fn().mockResolvedValue('Export display name'));
const resolveXlsxProfileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../server/src/services/tablePlatform/ExportService.js', () => ({
  default: {
    getTableName: (...a: unknown[]) => getTableNameMock(...a),
    resolveXlsxProfile: (...a: unknown[]) => resolveXlsxProfileMock(...a),
    buildXlsxBuffer: (...a: unknown[]) => buildXlsxBufferMock(...a),
    streamCsvExport: vi.fn(),
  },
}));

import tablePlatformRoutes from '../../../server/src/routes/table-platform.routes.js';

describe('table-platform sheet artifact routes (SQLite registry + stubbed tp_tables)', () => {
  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db as never);
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    queryMock.mockClear();
    buildXlsxBufferMock.mockClear();
    getTableNameMock.mockClear();
    resolveXlsxProfileMock.mockReset();
    buildXlsxBufferMock.mockResolvedValue(Buffer.from([80, 75, 3, 4]));
    getTableNameMock.mockResolvedValue('Export display name');
    resolveXlsxProfileMock.mockResolvedValue(undefined);
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      })
  );

  it('POST /tables/:tableId/register-sheet-artifact registers governed sheet in canonical registry', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/table-platform', tablePlatformRoutes);

    const res = await request(app)
      .post('/api/table-platform/tables/tbl-governed-1/register-sheet-artifact')
      .expect(201);

    expect(res.body?.data?.outputType).toBe('sheet');
    expect(res.body?.data?.artifactFamily).toBe('sheet');
    expect(res.body?.data?.artifactId).toBeTruthy();
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT name, governance_mode FROM tp_tables WHERE id = $1',
      ['tbl-governed-1']
    );
  });

  it('GET export/xlsx?registerArtifact=1 sets X-Artifact-Id and returns workbook bytes', async () => {
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    const res = await request(app)
      .get('/api/table-platform/tables/tbl-governed-1/export/xlsx')
      .query({ registerArtifact: '1' })
      .expect(200);

    expect(res.headers['x-artifact-id']).toBeTruthy();
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Buffer.isBuffer(res.body) ? res.body.length : res.text?.length).toBeGreaterThan(0);
    expect(buildXlsxBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'tbl-governed-1' })
    );
  });

  it('export with registerArtifact reuses same artifact id on second request (idempotent registration)', async () => {
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    const first = await request(app)
      .get('/api/table-platform/tables/tbl-governed-1/export/xlsx')
      .query({ registerArtifact: '1' })
      .expect(200);
    const second = await request(app)
      .get('/api/table-platform/tables/tbl-governed-1/export/xlsx')
      .query({ registerArtifact: '1' })
      .expect(200);

    expect(first.headers['x-artifact-id']).toBe(second.headers['x-artifact-id']);
  });

  it('auto-selects the supplier scorecard profile for a SHEET-BASE table', async () => {
    resolveXlsxProfileMock.mockResolvedValue('consultify-supplier-scorecard');
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    await request(app).get('/api/table-platform/tables/tbl-governed-1/export/xlsx').expect(200);

    expect(resolveXlsxProfileMock).toHaveBeenCalledWith('tbl-governed-1');
    expect(buildXlsxBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'tbl-governed-1',
        profile: 'consultify-supplier-scorecard',
      })
    );
  });

  it('accepts the explicit supplier scorecard profile without provenance lookup', async () => {
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    await request(app)
      .get('/api/table-platform/tables/tbl-operational-1/export/xlsx')
      .query({ profile: 'consultify-supplier-scorecard' })
      .expect(200);

    expect(resolveXlsxProfileMock).not.toHaveBeenCalled();
    expect(buildXlsxBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({ profile: 'consultify-supplier-scorecard' })
    );
  });

  it('rejects an unknown XLSX profile with HTTP 400 before export', async () => {
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    const res = await request(app)
      .get('/api/table-platform/tables/tbl-operational-1/export/xlsx')
      .query({ profile: 'header-sniffing-profile' })
      .expect(400);

    expect(res.body).toMatchObject({ code: 'XLSX_EXPORT_PROFILE_INVALID' });
    expect(resolveXlsxProfileMock).not.toHaveBeenCalled();
    expect(buildXlsxBufferMock).not.toHaveBeenCalled();
  });

  it('keeps a generic table on the generic export profile', async () => {
    const app = express();
    app.use('/api/table-platform', tablePlatformRoutes);

    await request(app).get('/api/table-platform/tables/tbl-operational-1/export/xlsx').expect(200);

    expect(resolveXlsxProfileMock).toHaveBeenCalledWith('tbl-operational-1');
    expect(buildXlsxBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'tbl-operational-1', profile: undefined })
    );
  });

  it('register-sheet-artifact returns 400 when table is not governed', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/table-platform', tablePlatformRoutes);

    const res = await request(app)
      .post('/api/table-platform/tables/tbl-operational-1/register-sheet-artifact')
      .expect(400);

    expect(res.body?.error).toMatch(/governed/i);
  });
});
