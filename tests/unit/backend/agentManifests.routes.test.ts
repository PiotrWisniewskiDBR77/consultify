/**
 * Agent Manifests Routes Unit Tests (M01 wiring — HP-2/HP-3, read-only).
 *
 * Tests `GET /api/ai/agent-manifests` and `GET /api/ai/agent-manifests/:id`
 * — the read-only Discovery Tool agent manifest catalog. Auth-gated (verifyToken)
 * but otherwise pure/deterministic (no LLM, no DB), so this is mocked the same
 * way as `tests/unit/backend/helpChat.routes.test.ts`.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => {
    _req.userId = 'test-user';
    _req.organizationId = 'test-org';
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

const { default: agentManifestsRoutes } = await import(
  '../../../server/src/routes/ai/agent-manifests.routes.js'
);

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/ai/agent-manifests', agentManifestsRoutes);
  return app;
}

describe('Agent Manifests Routes', () => {
  it('GET / returns all 31 manifests', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(31);
    expect(res.body.manifests).toHaveLength(31);
    expect(res.body.manifests[0]).toMatchObject({
      id: expect.any(String),
      sourceType: 'discovery_tool',
      status: expect.stringMatching(/^(built|planned)$/),
      displayName: { pl: expect.any(String), en: expect.any(String) },
      wave: expect.any(String),
    });
  });

  it('GET /?status=built returns only the 19 built manifests', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests?status=built');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(19);
    expect(res.body.manifests.every((m: any) => m.status === 'built')).toBe(true);
  });

  it('GET /?status=planned returns only the 12 planned manifests', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests?status=planned');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.manifests.every((m: any) => m.status === 'planned')).toBe(true);
  });

  it('GET /?wave=wave-1 returns only wave-1 manifests', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests?wave=wave-1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
  });

  it('GET /:id resolves a known manifest', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests/market-forces');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.manifest.id).toBe('market-forces');
  });

  it('GET /:id returns 404 for an unknown manifest', async () => {
    const app = createApp();
    const res = await request(app).get('/api/ai/agent-manifests/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
