import { describe, expect, it } from 'vitest';
import request from 'supertest';

import performanceRoutes from '../../../server/src/routes/performance.routes.ts';
import {
  dbQueryDurationSeconds,
  errorsTotal,
  httpRequestDurationSeconds,
  llmCallDurationSeconds,
} from '../../../server/src/services/metricsService.js';
import { makeTestApp } from '../_helpers/testApp';

describe('Performance routes', () => {
  it('computes latency percentiles from in-process histograms (no placeholder zeros)', async () => {
    httpRequestDurationSeconds.labels('GET', '/api/test', '200').observe(0.12);
    dbQueryDurationSeconds.labels('select', 'sqlite').observe(0.01);
    llmCallDurationSeconds.labels('test-provider', 'test-model').observe(0.5);
    errorsTotal.labels('test', 'performanceRoutes').inc(2);

    const app = makeTestApp({ mountPath: '/api/performance', router: performanceRoutes });

    const res = await request(app).get('/api/performance/metrics');
    expect(res.status).toBe(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        latency: expect.any(Object),
        throughput: expect.any(Object),
        errors: expect.any(Object),
      })
    );

    expect(Number(res.body.latency.http.p95 || 0)).toBeGreaterThan(0);
    expect(Number(res.body.latency.db.p95 || 0)).toBeGreaterThan(0);
    expect(Number(res.body.latency.llm.p95 || 0)).toBeGreaterThan(0);
    expect(Number(res.body.errors.total || 0)).toBeGreaterThanOrEqual(2);
  });
});
