import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabase = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

describe('Chat projects: create personal success (REAL integration)', () => {
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
    getDatabase.mockReturnValue({
      query: vi.fn(async () => ({ rows: [] })),
      queryOne: vi.fn(async () => null),
      run: vi.fn(async () => ({})),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/chat-projects', router });

  it('POST /api/chat-projects returns 201 project', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/chat-projects').send({ name: 'P1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        user_id: 'test-user-id',
        name: 'P1',
        scope: 'personal',
        conversation_count: 0,
      })
    );
  });
});
