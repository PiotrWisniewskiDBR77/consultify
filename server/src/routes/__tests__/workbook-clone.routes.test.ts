/** @vitest-environment node */

/**
 * EXCEL clone mode — `POST /api/workbook/:id/clone`.
 *
 * Brief §1/§10 ("Komplet od razu"): duplicates an existing workbook's
 * schema into a NEW `generated_workbooks` row (fresh id + fresh .xlsx
 * buffer) as an editable starting point — mirrors Deck's
 * `POST /templates/:id/clone`. Reuses `finalizeGeneratedWorkbook` (the
 * same tail as `/generate`, `/blank`, `/templates/:id/build`), so this
 * suite focuses on the clone-specific lookup/mapping logic: source
 * fetch + org scoping, title defaulting, and the persisted/returned shape.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
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

const mockBuildWorkbookBuffer = vi.fn();
vi.mock('../../services/workbook/WorkbookBuilder.js', () => ({
  buildWorkbookBuffer: (...args: unknown[]) => mockBuildWorkbookBuffer(...args),
}));

const mockRegisterArtifactOrigin = vi.fn();
const mockAdoptRunArtifactForWorkbook = vi.fn();
vi.mock('../../services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => mockRegisterArtifactOrigin(...args),
  adoptRunArtifactForWorkbook: (...args: unknown[]) => mockAdoptRunArtifactForWorkbook(...args),
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
const SOURCE_ID = 'wb-source-1';

const SOURCE_SCHEMA = {
  title: 'Model finansowy Q3',
  description: 'Prognoza przychodów',
  sheets: [
    {
      name: 'Arkusz1',
      columns: [{ key: 'a', header: 'Kolumna A' }],
      rows: [{ cells: { a: { value: 1 } } }],
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
  mockBuildWorkbookBuffer.mockResolvedValue(Buffer.from('fake-xlsx-bytes'));
  mockRegisterArtifactOrigin.mockResolvedValue({ artifactId: 'artifact-999' });

  mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
    if (
      typeof sql === 'string' &&
      sql.includes('FROM generated_workbooks') &&
      sql.includes('schema_json')
    ) {
      const [id, orgId] = params as [string, string];
      if (id === SOURCE_ID && orgId === ORG) {
        return {
          title: SOURCE_SCHEMA.title,
          description: SOURCE_SCHEMA.description,
          schema_json: JSON.stringify(SOURCE_SCHEMA),
        };
      }
      return null;
    }
    return null;
  });
});

describe('POST /api/workbook/:id/clone', () => {
  it('401 when unauthenticated', async () => {
    const app = createApp();
    const res = await request(app).post(`/api/workbook/${SOURCE_ID}/clone`).send({});
    expect(res.status).toBe(401);
  });

  it('404 when the source workbook does not exist for this organization', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app).post('/api/workbook/does-not-exist/clone').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Workbook not found');
  });

  it('404 for a foreign tenant (cross-org IDOR) even with the correct id', async () => {
    const app = createApp();
    asUser(ORG_ATTACKER);
    const res = await request(app).post(`/api/workbook/${SOURCE_ID}/clone`).send({});
    expect(res.status).toBe(404);
  });

  it('500 when the stored schema_json is corrupted', async () => {
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('schema_json')) {
        const [id, orgId] = params as [string, string];
        if (id === SOURCE_ID && orgId === ORG) {
          return { title: 'x', description: null, schema_json: '{not valid json' };
        }
      }
      return null;
    });
    const app = createApp();
    asUser(ORG);
    const res = await request(app).post(`/api/workbook/${SOURCE_ID}/clone`).send({});
    expect(res.status).toBe(500);
  });

  it('201 clones into a NEW id, defaults the title to "<source title> (Copy)", and persists+registers it', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app).post(`/api/workbook/${SOURCE_ID}/clone`).send({});

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(SOURCE_ID);
    expect(res.body.title).toBe('Model finansowy Q3 (Copy)');
    expect(res.body.clonedFrom).toBe(SOURCE_ID);
    expect(res.body.artifactId).toBe('artifact-999');
    expect(res.body.downloadUrl).toBe(`/api/workbook/${res.body.id}/download`);
    expect(res.body.sheets).toHaveLength(1);

    // Built a fresh buffer from the cloned (renamed) schema.
    expect(mockBuildWorkbookBuffer).toHaveBeenCalledTimes(1);
    const builtSchema = mockBuildWorkbookBuffer.mock.calls[0][0];
    expect(builtSchema.title).toBe('Model finansowy Q3 (Copy)');
    expect(builtSchema.sheets).toEqual([
      expect.objectContaining({
        ...SOURCE_SCHEMA.sheets[0],
        id: expect.any(String),
      }),
    ]);

    // Persisted a NEW row (new id) under the caller's org.
    const insertCall = mockQueryRun.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO generated_workbooks')
    );
    expect(insertCall).toBeTruthy();
    const [, insertParams] = insertCall as [string, unknown[]];
    expect(insertParams[0]).toBe(res.body.id);
    expect(insertParams[1]).toBe(ORG);
    expect(insertParams[2]).toBe('Model finansowy Q3 (Copy)');

    // Registered in the Outputs artifact registry against the NEW workbook id.
    expect(mockRegisterArtifactOrigin).toHaveBeenCalledTimes(1);
    const registerArgs = mockRegisterArtifactOrigin.mock.calls[0][0];
    expect(registerArgs.originRecordId).toBe(res.body.id);
    expect(registerArgs.organizationId).toBe(ORG);
    expect(registerArgs.originRuntime).toBe('sheet');
  });

  it('honors an explicit title override in the request body', async () => {
    const app = createApp();
    asUser(ORG);
    const res = await request(app)
      .post(`/api/workbook/${SOURCE_ID}/clone`)
      .send({ title: 'Mój własny tytuł' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Mój własny tytuł');
  });
});
