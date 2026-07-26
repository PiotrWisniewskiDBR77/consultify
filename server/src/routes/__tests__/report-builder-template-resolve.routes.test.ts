/** @vitest-environment node */

/**
 * R1 Library „Użyj wzorca" (raport, 2026-07-26) —
 * `POST /api/report-builder/templates/resolve`.
 *
 * WHY THIS SUITE EXISTS: the audit found that the Library's "Użyj wzorca" for
 * a legacy `report_template` routed to `/wordy?templateArtifactId=...`, whose
 * generator (`POST /artifact-runs/from-chat`) does not know that param — the
 * template's `sections_json` was silently dropped and the user got a plain
 * chat-generated document instead. `resolveDocumentTemplateForCreation`
 * already supported `report_template`, but its ONLY production caller was
 * Document Studio's own resolve route (document format only, no restriction
 * to a single runtime). A unit test of the resolver alone would not catch a
 * missing/wrong route wiring — hence a route-level test, mirroring
 * `document-studio-template-resolve.routes.test.ts`.
 *
 * Asserts:
 *   1. the production route invokes the resolver with the LIBRARY ref (index
 *      id), never a client-supplied canonical id,
 *   2. the organization comes from the auth context, not the request body,
 *   3. a resolved `document_template` (same index, wrong runtime for this
 *      route) is rejected — that belongs to Document Studio's route, not here,
 *   4. every typed rejection from the resolver maps to an honest HTTP status,
 *   5. the section blueprint never crosses back to the client.
 *
 * The resolver's own decision logic is covered by
 * `../../services/materials/__tests__/creationIntentResolver.test.ts`; here it
 * is mocked so each branch is deterministic. The real `TemplateResolveError`
 * class is kept (via importOriginal) so the route's error mapping is
 * exercised for real.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ───────────────────

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
const mockResolve = vi.fn();

let mockUser: { id: string; role: string; organizationId: string } | null = null;

// ── Auth / RBAC / infra middleware mocks (same baseline as
//    cross-org-idor-m17.test.ts, which already imports this same route file) ──

vi.mock('../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  default: (_req: any, _res: any, next: () => void) => next(),
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => mockDbAll(...a),
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
}));

vi.mock('../../services/materials/creationIntent.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/materials/creationIntent.js')>();
  return {
    ...actual, // keeps the REAL TemplateResolveError + isTemplateResolveError
    resolveDocumentTemplateForCreation: (...args: unknown[]) => mockResolve(...args),
  };
});

import { TemplateResolveError } from '../../services/materials/creationIntent.js';

async function createApp(): Promise<Express> {
  const mod = await import('../report-builder.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder', mod.default);
  return app;
}

const ORG = 'org-1';
const USER = 'user-1';
const INDEX_ID = 'artifact-index-report-tpl-1';
const CANONICAL_ID = 'rbt-canonical-42';

function asUser(): void {
  mockUser = { id: USER, role: 'MEMBER', organizationId: ORG };
}

function resolvedReportTemplateFixture(overrides: Record<string, unknown> = {}) {
  return {
    originRuntime: 'report_template' as const,
    canonicalTemplateId: CANONICAL_ID,
    format: 'document' as const,
    scope: 'organization' as const,
    status: 'published' as const,
    source: 'legacy' as const,
    legacy: true,
    sectionBlueprint: [
      { key: 'exec_summary', title: 'Executive summary' },
      { key: 'findings', title: 'Findings' },
    ],
    ...overrides,
  };
}

describe('POST /api/report-builder/templates/resolve', () => {
  beforeEach(() => {
    mockUser = null;
    mockResolve.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockDbAll.mockReset();
    mockDbAll.mockResolvedValue([]);
  });

  it('★ production route invokes the resolver with the LIBRARY ref and the auth-context org', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedReportTemplateFixture());

    const app = await createApp();
    const res = await request(app)
      .post('/api/report-builder/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    const [ref, ctx] = mockResolve.mock.calls[0];
    expect(ref).toEqual({ kind: 'library', templateArtifactId: INDEX_ID });
    expect(ctx).toEqual({ organizationId: ORG });
  });

  it('returns the server-resolved canonical id and never leaks the section blueprint', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedReportTemplateFixture());

    const app = await createApp();
    const res = await request(app)
      .post('/api/report-builder/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(200);
    expect(res.body.template.canonicalTemplateId).toBe(CANONICAL_ID);
    expect(res.body.template.originRuntime).toBe('report_template');
    expect(res.body.template.legacy).toBe(true);
    expect(res.body.template.sectionCount).toBe(2);
    expect(res.body.template.sectionBlueprint).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Executive summary');
  });

  it('ignores any canonical id supplied by the client', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedReportTemplateFixture());

    const app = await createApp();
    await request(app).post('/api/report-builder/templates/resolve').send({
      templateArtifactId: INDEX_ID,
      canonicalTemplateId: 'attacker-supplied-id',
      originRuntime: 'report_template',
      organizationId: 'other-org',
    });

    const [ref, ctx] = mockResolve.mock.calls[0];
    expect(ref).toEqual({ kind: 'library', templateArtifactId: INDEX_ID });
    expect(JSON.stringify(ref)).not.toContain('attacker-supplied-id');
    expect(ctx).toEqual({ organizationId: ORG });
  });

  it('rejects a resolved document_template — that belongs to Document Studio, not this route', async () => {
    asUser();
    mockResolve.mockResolvedValue(
      resolvedReportTemplateFixture({
        originRuntime: 'document_template',
        source: 'canonical',
        legacy: false,
      })
    );

    const app = await createApp();
    const res = await request(app)
      .post('/api/report-builder/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('TEMPLATE_FORMAT_UNSUPPORTED');
    expect(res.body.template).toBeUndefined();
  });

  it.each([
    ['TEMPLATE_ORPHANED', 404],
    ['TEMPLATE_NOT_INDEXED', 404],
    ['TEMPLATE_FORBIDDEN', 403],
    ['TEMPLATE_DEPRECATED', 409],
    ['TEMPLATE_FORMAT_UNSUPPORTED', 422],
  ] as const)('maps %s to HTTP %i with an honest error code', async (code, status) => {
    asUser();
    mockResolve.mockRejectedValue(new TemplateResolveError(code, `rejected: ${code}`));

    const app = await createApp();
    const res = await request(app)
      .post('/api/report-builder/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(status);
    expect(res.body.error).toBe(code);
    expect(res.body.template).toBeUndefined();
  });

  it('rejects an unauthenticated request before touching the resolver', async () => {
    mockUser = null;

    const app = await createApp();
    const res = await request(app)
      .post('/api/report-builder/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(401);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('rejects a missing templateArtifactId before touching the resolver', async () => {
    asUser();

    const app = await createApp();
    const res = await request(app).post('/api/report-builder/templates/resolve').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('templateArtifactId_required');
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
