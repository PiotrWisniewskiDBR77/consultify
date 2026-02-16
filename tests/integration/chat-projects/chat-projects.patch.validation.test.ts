import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabase = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

describe('Chat projects: patch validation (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/chat-projects.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/chat-projects', router });

  it('PATCH /api/chat-projects/:id returns 400 on invalid body', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .patch('/api/chat-projects/p1')
      .send({ color: 'not-a-hex' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
