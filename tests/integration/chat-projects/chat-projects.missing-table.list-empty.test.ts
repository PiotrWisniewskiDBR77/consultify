import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabase = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

describe('Chat projects: missing table list returns empty (REAL integration)', () => {
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
    const err: any = new Error('SQLITE_ERROR: no such table: chat_projects');
    err.code = 'SQLITE_ERROR';
    getDatabase.mockReturnValue({
      query: vi.fn(async () => {
        throw err;
      }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/chat-projects', router });

  it('GET /api/chat-projects returns {projects:[], total:0}', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/chat-projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [], total: 0 });
  });
});
