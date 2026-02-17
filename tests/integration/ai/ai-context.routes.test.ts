import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const buildContext = vi.fn();

vi.mock('../../../server/src/services/aiContextBuilder.js', () => ({
  default: {
    buildContext: (...args: any[]) => buildContext(...args),
  },
}));

describe('AI routes: /context (REAL integration)', () => {
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
    buildContext.mockResolvedValue({ ok: true, screen: 'dashboard' });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai', router });

  it('GET /api/ai/context returns context', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/ai/context?screen=dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, screen: 'dashboard' });
    expect(buildContext).toHaveBeenCalled();
  });
});
