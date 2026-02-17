import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

describe('Projects routes (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/projects.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/projects', router });

  it('GET /api/projects returns success wrapper', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('POST /api/projects echoes body', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/projects').send({ name: 'P1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { name: 'P1' } });
  });
});
