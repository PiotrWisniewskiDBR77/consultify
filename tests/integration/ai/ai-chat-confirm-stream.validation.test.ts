import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

describe('AI routes: chat validation (REAL integration)', () => {
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

  const makeApp = () => makeTestApp({ mountPath: '/api/ai', router });

  it('POST /api/ai/chat/confirm requires message', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/ai/chat/confirm').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('POST /api/ai/chat/stream requires message', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/ai/chat/stream').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
