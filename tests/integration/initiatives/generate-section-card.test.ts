/**
 * R2 adoption — POST /api/initiatives/:id/generate-section-card.
 *
 * Reachable surface for `generateSectionCardSpec` (CardSpec emission + critic
 * gate). Auth/rbac middleware mocked to pass-through; the generation service is
 * mocked so this exercises the ROUTE contract (validation, org guard, payload
 * mapping, response passthrough). Zod validation stays REAL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { mockGenerateSectionCardSpec } = vi.hoisted(() => ({
  mockGenerateSectionCardSpec: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  default: { generateSectionCardSpec: (...a: any[]) => mockGenerateSectionCardSpec(...a) },
}));

async function makeApp(orgId: string | null = 'org-1') {
  const router = (await import('../../../server/src/routes/initiativeGeneratorBrain.routes.ts'))
    .default;
  return makeTestApp({
    mountPath: '/api/initiatives',
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        if (orgId) req.user = { id: 'u1', organizationId: orgId, role: 'ADMIN' };
        next();
      });
    },
  });
}

describe('POST /api/initiatives/:id/generate-section-card (R2)', () => {
  const origEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
  });
  beforeEach(() => vi.clearAllMocks());

  it('400 when sectionKey is missing (zod)', async () => {
    const app = await makeApp();
    const res = await request(app).post('/api/initiatives/init-1/generate-section-card').send({});
    expect(res.status).toBe(400);
    expect(mockGenerateSectionCardSpec).not.toHaveBeenCalled();
  });

  it('passes id + sectionKey + context to the service and returns the CardSpec result', async () => {
    mockGenerateSectionCardSpec.mockResolvedValueOnce({
      cardSpec: { sectionKey: 'scope', title: 'Zakres', blocks: [{ type: 'bullet_list', items: ['A'] }] },
      issues: [],
      ok: true,
      regenerated: false,
      tokensUsed: 10,
      model: 'premium',
    });
    const app = await makeApp('org-7');
    const res = await request(app)
      .post('/api/initiatives/init-9/generate-section-card')
      .send({ sectionKey: 'scope', initiativeName: 'X', language: 'pl', brief: 'opis' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.cardSpec.sectionKey).toBe('scope');
    expect(mockGenerateSectionCardSpec).toHaveBeenCalledWith(
      'scope',
      expect.objectContaining({ initiativeId: 'init-9', initiativeName: 'X', language: 'pl', summary: 'opis' }),
      'org-7',
      undefined,
    );
  });

  it('forwards maxRegen when provided', async () => {
    mockGenerateSectionCardSpec.mockResolvedValueOnce({ cardSpec: null, issues: [], ok: false, regenerated: false, tokensUsed: 0, model: 'x' });
    const app = await makeApp();
    const res = await request(app)
      .post('/api/initiatives/i/generate-section-card')
      .send({ sectionKey: 'kpis', maxRegen: 0 });
    expect(res.status).toBe(200);
    expect(mockGenerateSectionCardSpec).toHaveBeenCalledWith('kpis', expect.any(Object), 'org-1', { maxRegen: 0 });
  });

  it('401 when no org context', async () => {
    const app = await makeApp(null);
    const res = await request(app)
      .post('/api/initiatives/i/generate-section-card')
      .send({ sectionKey: 'scope' });
    expect(res.status).toBe(401);
    expect(mockGenerateSectionCardSpec).not.toHaveBeenCalled();
  });
});
