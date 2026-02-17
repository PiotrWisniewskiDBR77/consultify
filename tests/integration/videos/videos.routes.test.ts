import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('Videos routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/videos.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/videos', router });

  it('GET /api/videos supports category/status filters', async function () {
    if (!canListen) this.skip();
    await request(makeApp()).get('/api/videos?category=general&status=active').expect(200);
    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('AND category = ?'),
      expect.any(Array)
    );
    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('AND status = ?'),
      expect.any(Array)
    );
  });

  it('POST /api/videos validates title/url', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/videos').send({ title: 'x' });
    expect(res.status).toBe(400);
  });

  it('POST /api/videos creates a video', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/videos').send({
      title: 'Intro',
      url: 'https://example.com',
      duration: 10,
      category: 'general',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    expect(dbRun).toHaveBeenCalled();
  });

  it('DELETE /api/videos/:id deletes a video', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).delete('/api/videos/v1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
  });
});
