import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

describe('Contract: projects routes response shapes', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/projects.routes.ts')).default;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/projects', router });

  it('GET /api/projects/:id returns success wrapper with null data', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/projects/p1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });

  it('DELETE /api/projects/:id returns success wrapper', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).delete('/api/projects/p1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
