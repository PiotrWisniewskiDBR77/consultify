/** @vitest-environment node */

/**
 * EXCEL org-context grounding — `POST /api/workbook/generate` and
 * `POST /api/workbook/templates/:id/build` (N2, noc 2026-07-27/28).
 *
 * PROBLEM this closes (verified live): `grep -r "factBook|spine|financialEngine"
 * server/src/services/workbook/` = 0 hits — the Excel generator knew NOTHING
 * about the organization it was generating for. This suite proves the ROUTE
 * WIRING end-to-end from a production entry point (an actual POST request
 * through the real `workbook.routes.ts` router), not just that
 * `buildOrgContextSourcePack` itself works (that is already covered by
 * `documentStudio/__tests__/documentOrgContextSourcePack.test.ts` — reused
 * here unmocked, only its DB dependencies are stubbed) — so the assertions
 * are on the CONTENT that reaches `WorkbookGeneratorService.generate`'s
 * `researchContext`/`organizationName` params, not merely that a field was
 * passed through.
 *
 * Covers:
 *   - a fixture organization (name + 2 active projects) → those facts land,
 *     verbatim, in the grounding text handed to the generator;
 *   - a brand-new/empty organization → zero grounding added, generation call
 *     unchanged (no regression);
 *   - an explicit `researchContext` supplied by the caller is preserved
 *     (merged with, not replaced by, the org-context summary);
 *   - the deterministic template-build path also receives the resolved
 *     `organizationName` (Info-sheet visibility), with the same fail-open
 *     behaviour for an empty organization.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stub ONLY the DB-facing dependencies of `buildOrgContextSourcePack` — the
// pack builder itself runs FOR REAL, exactly like it does in production.
// ---------------------------------------------------------------------------

const dbAllMock = vi.fn();
const buildOrganizationContextMock = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

vi.mock('../../services/aiContextBuilder.js', () => ({
  default: {
    _buildOrganizationContext: (...args: unknown[]) => buildOrganizationContextMock(...args),
  },
}));

// ---------------------------------------------------------------------------
// Standard route-test scaffolding (mirrors workbook-clone.routes.test.ts).
// ---------------------------------------------------------------------------

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

const mockQueryRun = vi.fn();
vi.mock('../../utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: vi.fn(),
  queryOne: vi.fn(),
}));

const mockRegisterArtifactOrigin = vi.fn();
const mockAdoptRunArtifactForWorkbook = vi.fn();
vi.mock('../../services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => mockRegisterArtifactOrigin(...args),
  adoptRunArtifactForWorkbook: (...args: unknown[]) => mockAdoptRunArtifactForWorkbook(...args),
}));

// The generator itself is mocked — this suite is about what reaches its
// input, not the LLM pipeline (covered by workbookGeneratorRepairLoop.test.ts
// et al.).
const mockGenerate = vi.fn();
const mockGenerateFromTemplate = vi.fn();
vi.mock('../../services/workbook/WorkbookGeneratorService.js', () => ({
  default: {
    generate: (...args: unknown[]) => mockGenerate(...args),
    generateFromTemplate: (...args: unknown[]) => mockGenerateFromTemplate(...args),
  },
}));

// Template catalog for the /templates/:id/build path.
const mockGetWorkbookTemplate = vi.fn();
const mockBuildTemplateParamsSchema = vi.fn();
vi.mock('../../services/workbook/templates/index.js', () => ({
  getWorkbookTemplate: (...args: unknown[]) => mockGetWorkbookTemplate(...args),
  buildTemplateParamsSchema: (...args: unknown[]) => mockBuildTemplateParamsSchema(...args),
  listWorkbookTemplates: () => [],
}));

import workbookRoutes from '../workbook.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/workbook', workbookRoutes);
  return app;
}

const ORG = 'org-dbr77';

function asUser(organizationId: string): void {
  mockUser = { id: 'user-1', organizationId };
}

function fixtureGenerateResult(id: string) {
  return {
    id,
    schema: { title: 'Model finansowy', description: 'desc', sheets: [] },
    buffer: Buffer.from('fake-xlsx-bytes'),
    fileName: 'Model_finansowy.xlsx',
    validationErrors: [],
    classifiedErrors: [],
    qualityScore: null,
    qualityReport: null,
    pipelineLog: [],
    generatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockRegisterArtifactOrigin.mockResolvedValue({ artifactId: 'artifact-1' });
  mockAdoptRunArtifactForWorkbook.mockResolvedValue(null);
  mockGenerate.mockResolvedValue(fixtureGenerateResult('wb-1'));
  mockGenerateFromTemplate.mockResolvedValue(fixtureGenerateResult('wb-tpl-1'));
});

describe('POST /api/workbook/generate — org-context grounding', () => {
  it('grounds generation with the real organization name + active projects (asserts on CONTENT, not just pass-through)', async () => {
    buildOrganizationContextMock.mockResolvedValue({
      organizationName: 'DBR77',
      industry: 'Consulting',
    });
    dbAllMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects')) {
        return Promise.resolve([{ name: 'Transformacja AI 2026' }, { name: 'Program Vegas' }]);
      }
      if (sql.includes('FROM initiatives')) {
        return Promise.resolve([{ name: 'Automatyzacja raportowania' }]);
      }
      return Promise.resolve([]);
    });

    asUser(ORG);
    const app = createApp();
    const res = await request(app)
      .post('/api/workbook/generate')
      .send({ prompt: 'Zrób budżet operacyjny na przyszły rok' });

    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const call = mockGenerate.mock.calls[0][0];

    // Content assertions — the actual org facts must be readable in the text
    // that reaches the planning prompt, not just "some string was set".
    expect(call.researchContext).toContain('DBR77');
    expect(call.researchContext).toContain('Consulting');
    expect(call.researchContext).toContain('Transformacja AI 2026');
    expect(call.researchContext).toContain('Program Vegas');
    expect(call.researchContext).toContain('Automatyzacja raportowania');
    expect(call.organizationName).toBe('DBR77');
  });

  it('merges org context ONTO an explicit researchContext instead of replacing it', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'DBR77', industry: null });
    dbAllMock.mockResolvedValue([]);

    asUser(ORG);
    const app = createApp();
    const res = await request(app).post('/api/workbook/generate').send({
      prompt: 'Zrób model DCF dla spółki X',
      researchContext: 'Spółka X: przychód 2025 = 12 mln PLN.',
    });

    expect(res.status).toBe(200);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.researchContext).toContain('DBR77');
    expect(call.researchContext).toContain('Spółka X: przychód 2025 = 12 mln PLN.');
  });

  it('brand-new/empty organization: zero grounding added, generation proceeds unchanged (no regression)', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'Unknown', industry: null });
    dbAllMock.mockResolvedValue([]);

    asUser('org-brand-new');
    const app = createApp();
    const res = await request(app)
      .post('/api/workbook/generate')
      .send({ prompt: 'Zrób prosty budżet' });

    expect(res.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.researchContext).toBeUndefined();
    expect(call.organizationName).toBeUndefined();
  });

  it('fails open when the org-context lookup itself throws (generation still succeeds)', async () => {
    buildOrganizationContextMock.mockRejectedValue(new Error('db offline'));
    dbAllMock.mockRejectedValue(new Error('db offline'));

    asUser(ORG);
    const app = createApp();
    const res = await request(app)
      .post('/api/workbook/generate')
      .send({ prompt: 'Zrób prosty budżet' });

    expect(res.status).toBe(200);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.researchContext).toBeUndefined();
    expect(call.organizationName).toBeUndefined();
  });
});

describe('POST /api/workbook/templates/:id/build — org-context visibility', () => {
  beforeEach(() => {
    mockGetWorkbookTemplate.mockReturnValue({
      id: 'breakEven',
      title: 'Break-even',
      description: 'desc',
      params: [],
    });
    mockBuildTemplateParamsSchema.mockReturnValue({
      safeParse: (input: unknown) => ({ success: true, data: input }),
    });
  });

  it('resolves organizationName for the Info sheet even on the deterministic (no-LLM) template path', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'DBR77', industry: null });
    dbAllMock.mockResolvedValue([]);

    asUser(ORG);
    const app = createApp();
    const res = await request(app)
      .post('/api/workbook/templates/breakEven/build')
      .send({ params: {} });

    expect(res.status).toBe(200);
    expect(mockGenerateFromTemplate).toHaveBeenCalledTimes(1);
    const call = mockGenerateFromTemplate.mock.calls[0][0];
    expect(call.organizationName).toBe('DBR77');
  });

  it('brand-new organization: template build still succeeds with organizationName undefined', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'Unknown', industry: null });
    dbAllMock.mockResolvedValue([]);

    asUser('org-brand-new');
    const app = createApp();
    const res = await request(app)
      .post('/api/workbook/templates/breakEven/build')
      .send({ params: {} });

    expect(res.status).toBe(200);
    const call = mockGenerateFromTemplate.mock.calls[0][0];
    expect(call.organizationName).toBeUndefined();
  });
});
