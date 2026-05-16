import { describe, expect, it } from 'vitest';
import request from 'supertest';

import performanceRoutes from '../../../server/src/routes/performance.routes.ts';
import { makeTestApp } from '../_helpers/testApp';

describe('performance metrics sli budgets contract', () => {
  it('returns canonical sli budgets and keeps raw payload out of non-dev responses', async () => {
    const app = makeTestApp({ mountPath: '/api/performance', router: performanceRoutes });
    const res = await request(app).get('/api/performance/metrics');

    expect(res.status).toBe(200);
    expect(res.body.sliBudgetsMs).toEqual({
      loginP95: 1500,
      notificationsP95: 300,
      unreadCountP95: 200,
      organizationProfileP95: 400,
      llmProviderSnapshotP95: 200,
    });
    expect(res.body.raw).toBeUndefined();
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

