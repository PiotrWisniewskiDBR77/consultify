/** @vitest-environment node */

/**
 * R1 doc slice — `POST /api/document-studio/templates/resolve`.
 *
 * WHY THIS SUITE EXISTS (architect review P1): the resolver
 * `resolveDocumentTemplateForCreation` previously existed but had NO
 * production caller — "Użyj wzorca" passed a canonical template id straight
 * through the URL into generation. A unit test of the resolver alone cannot
 * catch that: it passes just as happily when nothing calls it.
 *
 * So this suite asserts the WIRING, at route level:
 *   1. the production route actually invokes the resolver,
 *   2. it invokes it with the LIBRARY ref (index id), never a client-supplied
 *      canonical id,
 *   3. the organization comes from the auth context, not the request body,
 *   4. every typed rejection maps to an honest HTTP status,
 *   5. the canonical blueprint never crosses back to the client.
 *
 * The resolver's own decision logic is covered by
 * `../../services/materials/__tests__/creationIntentResolver.test.ts`; here it
 * is mocked so each branch can be driven deterministically. The real
 * `TemplateResolveError` class is kept (via importOriginal) so the route's
 * error mapping is exercised for real rather than against a stub.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

const mockResolve = vi.fn();

vi.mock('../../services/materials/creationIntent.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/materials/creationIntent.js')>();
  return {
    ...actual, // keeps the REAL TemplateResolveError + isTemplateResolveError
    resolveDocumentTemplateForCreation: (...args: unknown[]) => mockResolve(...args),
  };
});

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

import { TemplateResolveError } from '../../services/materials/creationIntent.js';
import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const ORG = 'org-1';
const USER = 'user-1';
const INDEX_ID = 'artifact-index-777';
const CANONICAL_ID = 'doc-tpl-canonical-42';

function asUser(): void {
  mockUser = { id: USER, organizationId: ORG, role: 'MEMBER' };
}

function resolvedFixture() {
  return {
    originRuntime: 'document_template' as const,
    canonicalTemplateId: CANONICAL_ID,
    format: 'document' as const,
    scope: 'system' as const,
    status: 'approved' as const,
    source: 'canonical' as const,
    legacy: false,
    sectionBlueprint: [
      { title: 'Podsumowanie zarządcze', level: 1, purpose: 'p', expectedLengthHint: 'short' },
      { title: 'Ustalenia', level: 1, purpose: 'p', expectedLengthHint: 'medium' },
    ],
  };
}

describe('POST /api/document-studio/templates/resolve', () => {
  beforeEach(() => {
    mockUser = null;
    mockResolve.mockReset();
    mockDbAll.mockReset();
    mockDbRun.mockReset();
    mockDbGet.mockReset();
  });

  it('★ production route invokes the resolver with the LIBRARY ref and the auth-context org', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedFixture());

    const res = await request(createApp())
      .post('/api/document-studio/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(200);
    // The wiring proof: the resolver ran, exactly once.
    expect(mockResolve).toHaveBeenCalledTimes(1);
    const [ref, ctx] = mockResolve.mock.calls[0];
    // Index id only — a `kind:'internal'` / canonical ref must never originate
    // from an HTTP client.
    expect(ref).toEqual({ kind: 'library', templateArtifactId: INDEX_ID });
    // Org comes from auth, not from the body.
    expect(ctx).toEqual({ organizationId: ORG });
  });

  it('returns the server-resolved canonical id and never leaks the blueprint', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedFixture());

    const res = await request(createApp())
      .post('/api/document-studio/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(200);
    expect(res.body.template.canonicalTemplateId).toBe(CANONICAL_ID);
    expect(res.body.template.originRuntime).toBe('document_template');
    expect(res.body.template.sectionCount).toBe(2);
    // The canonical blueprint stays server-side — Mode 3 re-reads it itself.
    expect(res.body.template.sectionBlueprint).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Podsumowanie zarządcze');
  });

  it('ignores any canonical id supplied by the client', async () => {
    asUser();
    mockResolve.mockResolvedValue(resolvedFixture());

    await request(createApp()).post('/api/document-studio/templates/resolve').send({
      templateArtifactId: INDEX_ID,
      canonicalTemplateId: 'attacker-supplied-id',
      originRuntime: 'document_template',
      organizationId: 'other-org',
    });

    const [ref, ctx] = mockResolve.mock.calls[0];
    expect(ref).toEqual({ kind: 'library', templateArtifactId: INDEX_ID });
    expect(JSON.stringify(ref)).not.toContain('attacker-supplied-id');
    expect(ctx).toEqual({ organizationId: ORG });
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

    const res = await request(createApp())
      .post('/api/document-studio/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(status);
    expect(res.body.error).toBe(code);
    // No canonical id may leak on a rejection path.
    expect(res.body.template).toBeUndefined();
  });

  it('rejects an unauthenticated request before touching the resolver', async () => {
    mockUser = null;

    const res = await request(createApp())
      .post('/api/document-studio/templates/resolve')
      .send({ templateArtifactId: INDEX_ID });

    expect(res.status).toBe(401);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('rejects a missing templateArtifactId before touching the resolver', async () => {
    asUser();

    const res = await request(createApp()).post('/api/document-studio/templates/resolve').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('templateArtifactId_required');
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
