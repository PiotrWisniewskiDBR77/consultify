import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabase = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

describe('Chat projects: team scope requires org (REAL integration)', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabase.mockReturnValue({ run: vi.fn(async () => ({})) });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/chat-projects', router });

  it('POST /api/chat-projects with scope=team returns 400 without org', async function () {
    if (!canListen) this.skip();
    const token = jwt.sign({ id: 'u-1', role: 'guest' }, process.env.JWT_SECRET || 'test');
    const res = await request(makeApp())
      .post('/api/chat-projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'T', scope: 'team' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
