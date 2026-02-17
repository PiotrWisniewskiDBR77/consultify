import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

async function loadReportCommentsRouter() {
  return (await import('../../../server/src/routes/report-comments.routes.ts')).default;
}

describe('Report comments routes (stub) - REAL integration', () => {
  it('returns 501 Not implemented for any request', async () => {
    const router = await loadReportCommentsRouter();
    const app = makeTestApp({ mountPath: '/api/report-comments', router });
    const res = await request(app).get('/api/report-comments');
    expect(res.status).toBe(501);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
