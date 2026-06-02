import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

// --- Mocks for the heavy deps the /chat/quick handler dynamically imports ---
const select = vi.fn();
const callText = vi.fn();
const checkAccess = vi.fn();
const incrementUsage = vi.fn();

vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  modelRouter: {
    select: (...args: any[]) => select(...args),
  },
  default: {
    select: (...args: any[]) => select(...args),
  },
}));

vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    callText: (...args: any[]) => callText(...args),
  },
  default: {
    callText: (...args: any[]) => callText(...args),
  },
}));

vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: {
    checkAccess: (...args: any[]) => checkAccess(...args),
    incrementUsage: (...args: any[]) => incrementUsage(...args),
  },
}));

describe('AI routes: /chat/quick (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const origKey = process.env.OPENROUTER_API_KEY;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    // hasEnvProvider must be true so the provider check passes without a db row.
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
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
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    select.mockResolvedValue({ id: 'fake-model', provider: 'openrouter' });
    callText.mockResolvedValue({ content: 'EDITED TEXT' });
    checkAccess.mockResolvedValue({ allowed: true });
    incrementUsage.mockResolvedValue(undefined);
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai', router });

  it('POST /api/ai/chat/quick returns the edited text on the happy path', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .post('/api/ai/chat/quick')
      .send({ message: 'Make this shorter', language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ response: 'EDITED TEXT' });

    // The model was selected and the LLM was called once.
    expect(select).toHaveBeenCalledTimes(1);
    expect(callText).toHaveBeenCalledTimes(1);

    // System prompt instructs returning ONLY the modified text, and the user
    // message is forwarded verbatim.
    const callArg = callText.mock.calls[0][0];
    expect(callArg.systemPrompt).toContain('Return ONLY the modified text');
    expect(callArg.messages).toEqual([{ role: 'user', content: 'Make this shorter' }]);
  });

  it('POST /api/ai/chat/quick returns 502 EMPTY_LLM_RESPONSE on empty LLM output', async function () {
    if (!canListen) this.skip();
    callText.mockResolvedValueOnce({ content: '' });

    const res = await request(makeApp())
      .post('/api/ai/chat/quick')
      .send({ message: 'Do the thing' });

    expect(res.status).toBe(502);
    expect(res.body).toEqual(
      expect.objectContaining({ code: 'EMPTY_LLM_RESPONSE' })
    );
  });

  it('POST /api/ai/chat/quick returns 403 ACCESS_BLOCKED when access denied', async function () {
    if (!canListen) this.skip();
    checkAccess.mockResolvedValueOnce({ allowed: false, errorCode: 'ACCESS_BLOCKED' });

    const res = await request(makeApp())
      .post('/api/ai/chat/quick')
      .send({ message: 'Do the thing' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ code: 'ACCESS_BLOCKED' }));
    // Should short-circuit before calling the LLM.
    expect(callText).not.toHaveBeenCalled();
  });

  it('POST /api/ai/chat/quick returns 403 AI_BUDGET_EXHAUSTED on budget error', async function () {
    if (!canListen) this.skip();
    callText.mockRejectedValueOnce(
      Object.assign(new Error('Budget exhausted'), {
        isBudgetError: true,
        budgetStatus: { spent: 100 },
      })
    );

    const res = await request(makeApp())
      .post('/api/ai/chat/quick')
      .send({ message: 'Do the thing' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ code: 'AI_BUDGET_EXHAUSTED' }));
  });

  it('POST /api/ai/chat/quick returns 400 when message is missing', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/ai/chat/quick').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array),
      })
    );
    // Validation rejects before any provider/LLM work happens.
    expect(callText).not.toHaveBeenCalled();
  });
});
