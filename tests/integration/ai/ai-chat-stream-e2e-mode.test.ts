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

vi.mock('../../../server/src/middleware/auditsStrictMembership.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auditsStrictMembership.middleware.js'
  )) as any;
  return {
    ...actual,
    requireActiveTenantMembership: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = (await vi.importActual('../../../server/src/utils/DbPromise.js')) as any;
  return {
    ...actual,
    get: async (sql: string, ...args: any[]) =>
      /FROM organization_members/i.test(sql) ? { status: 'ACTIVE' } : actual.get(sql, ...args),
  };
});

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

function parseSseData(text: string): any[] {
  return String(text || '')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => JSON.parse(line));
}

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

    const startedAt = performance.now();
    const res = await request(app).post('/api/ai/chat/stream').send({
      message: 'hello',
      history: [],
      projectId: '11111111-1111-4111-8111-111111111111',
    });
    const durationMs = performance.now() - startedAt;

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/event-stream/i);
    expect(res.text).toContain('data:');
    expect(res.text).toContain('E2E_OK:');
    expect(res.text).toContain('[DONE]');
    expect(durationMs).toBeLessThan(2_000);

    const events = parseSseData(res.text);
    const trustEvent = events.find((event) => event?.type === 'trust_bundle');
    expect(trustEvent?.bundle).toEqual(
      expect.objectContaining({
        version: 'TrustBundleV1',
        answerId: expect.any(String),
        conversationId: null,
        messageId: null,
        assistant: 'teresa',
        assistantSurface: 'workspace_copilot',
        actionSurface: 'governed_execution',
        sourceClasses: ['general'],
        citationsCount: 0,
        sourceLedgerSummary: null,
        confidence: expect.any(Number),
        tokens: expect.objectContaining({
          input: expect.any(Number),
          output: expect.any(Number),
          total: expect.any(Number),
        }),
        warnings: expect.arrayContaining(['deterministic_stream']),
        degraded: expect.objectContaining({ mode: 'e2e_mode' }),
      })
    );
    expect(trustEvent?.bundle).not.toHaveProperty('sourceLedger');
  });
});
