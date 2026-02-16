import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import net from 'node:net';

// Avoid rate-limit flakiness and auth complexity:
// - verifyToken is mocked to attach a deterministic user/org
// - aiRateLimiter is mocked to no-op
vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'e2e-user-id', organizationId: 'e2e-org-id', role: 'ADMIN' };
      req.userId = 'e2e-user-id';
      req.organizationId = 'e2e-org-id';
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    aiRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

describe('AI chat stream (E2E_MODE deterministic)', () => {
  const origE2eMode = process.env.E2E_MODE;
  const origNodeEnv = process.env.NODE_ENV;
  let canListen = true;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
  });

  beforeAll(async () => {
    canListen = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(0, '127.0.0.1', () => s.close(() => resolve(true)));
    });
  });

  afterAll(() => {
    if (origE2eMode === undefined) delete process.env.E2E_MODE;
    else process.env.E2E_MODE = origE2eMode;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });

  const makeApp = () => {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/ai', aiRouter);
    return app;
  };

  it('streams deterministic SSE chunks and terminates with [DONE]', async function () {
    if (!canListen) this.skip();
    const app = makeApp();

    const res = await request(app).post('/api/ai/chat/stream').send({
      message: 'hello',
      history: [],
      projectId: '11111111-1111-4111-8111-111111111111',
    });

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/event-stream/i);
    expect(res.text).toContain('data:');
    expect(res.text).toContain('E2E_OK:');
    expect(res.text).toContain('[DONE]');
  });
});
