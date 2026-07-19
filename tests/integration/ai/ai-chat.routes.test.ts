import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const processMessage = vi.fn();
const logSuggestion = vi.fn();

vi.mock('../../../server/src/services/aiOrchestrator.js', () => ({
  default: {
    processMessage: (...args: any[]) => processMessage(...args),
    getRoleDescription: (role: string) => `desc:${role}`,
  },
}));

vi.mock('../../../server/src/services/aiAuditLogger.js', () => ({
  default: {
    logSuggestion: (...args: any[]) => logSuggestion(...args),
  },
}));

describe('AI routes: /chat (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/ai.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    processMessage.mockResolvedValue({
      role: 'assistant',
      intent: 'chat',
      contextSummary: 'ctx',
      responseContext: { dataSources: [{ id: 'ds1' }] },
      prompt: 'p',
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai', router });

  it('POST /api/ai/chat returns orchestrator result shape', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/ai/chat').send({ message: 'Hello AI' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        role: 'assistant',
        roleDescription: 'desc:assistant',
        intent: 'chat',
        contextSummary: 'ctx',
        dataSources: expect.any(Array),
        prompt: 'p',
        policyLevel: expect.any(String),
      })
    );
    expect(logSuggestion).toHaveBeenCalledTimes(1);
  });

  it('POST /api/ai/chat validates body', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/ai/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array),
      })
    );
  });

  it('POST /api/ai/chat returns 500 when orchestrator throws (H6.4: coded, no err.message leak)', async function () {
    if (!canListen) this.skip();
    processMessage.mockRejectedValueOnce(new Error('boom'));
    const res = await request(makeApp()).post('/api/ai/chat').send({ message: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ code: 'AI_CHAT_FAILED' }));
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
