import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabase = vi.fn();
const checkChatPermission = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

vi.mock('../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission: (...args: any[]) => checkChatPermission(...args),
}));

describe('Chat projects routes: list + create (REAL integration)', () => {
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
    checkChatPermission.mockResolvedValue({ allowed: false });
    getDatabase.mockReturnValue({
      query: vi.fn(async () => ({ rows: [] })),
      run: vi.fn(async () => ({})),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/chat-projects', router });

  it('GET /api/chat-projects returns list wrapper', async function () {
    if (!canListen) this.skip();
    getDatabase.mockReturnValueOnce({
      query: vi.fn(async () => ({ rows: [{ id: 'p1', name: 'P1' }] })),
      run: vi.fn(),
    });
    const res = await request(makeApp()).get('/api/chat-projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        projects: expect.any(Array),
        total: 1,
      })
    );
  });

  it('POST /api/chat-projects validates input', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/chat-projects').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('POST /api/chat-projects blocks team scope without permission', async function () {
    if (!canListen) this.skip();
    checkChatPermission.mockResolvedValueOnce({ allowed: false });
    const res = await request(makeApp())
      .post('/api/chat-projects')
      .send({ name: 'Team', scope: 'team' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
