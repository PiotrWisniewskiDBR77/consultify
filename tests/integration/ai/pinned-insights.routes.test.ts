import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('AI routes: /pinned-insights (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/ai/pinned-insights.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai/pinned-insights', router });

  it('POST / pins an insight scoped to the test org/user', async function () {
    if (!canListen) this.skip();

    const res = await request(makeApp())
      .post('/api/ai/pinned-insights')
      .send({ content: 'Key insight from the conversation', tags: ['finance'] });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Key insight from the conversation');
    expect(res.body.organizationId).toBe('test-org-id');
    expect(res.body.userId).toBe('test-user-id');
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pinned_insights'),
      expect.arrayContaining(['test-org-id', 'test-user-id'])
    );
  });

  it('POST / rejects empty content', async function () {
    if (!canListen) this.skip();

    const res = await request(makeApp()).post('/api/ai/pinned-insights').send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('GET / lists insights scoped to organization_id + user_id', async function () {
    if (!canListen) this.skip();

    dbAll.mockResolvedValueOnce([
      {
        id: 'ins-1',
        organization_id: 'test-org-id',
        user_id: 'test-user-id',
        conversation_id: null,
        message_id: null,
        content: 'Pinned thing',
        tags: '["a","b"]',
        is_shared: false,
        created_at: '2026-07-15T00:00:00.000Z',
      },
    ]);

    const res = await request(makeApp()).get('/api/ai/pinned-insights?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.insights[0].tags).toEqual(['a', 'b']);
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toContain('organization_id = ?');
    expect(params[0]).toBe('test-org-id');
  });

  it('DELETE /:id unpins by id + user ownership', async function () {
    if (!canListen) this.skip();

    const id = '11111111-1111-4111-8111-111111111111';
    const res = await request(makeApp()).delete(`/api/ai/pinned-insights/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: id });
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pinned_insights'), [
      id,
      'test-user-id',
    ]);
  });

  it('PATCH /:id 404s when the underlying service finds no matching row', async function () {
    if (!canListen) this.skip();

    dbGet.mockResolvedValueOnce(undefined);
    const id = '22222222-2222-4222-8222-222222222222';

    const res = await request(makeApp())
      .patch(`/api/ai/pinned-insights/${id}`)
      .send({ content: 'updated' });

    expect(res.status).toBe(404);
  });
});
