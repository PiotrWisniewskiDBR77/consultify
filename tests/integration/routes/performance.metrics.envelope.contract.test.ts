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

describe('performance metrics envelope contract', () => {
  it('returns finite latency/throughput/error envelope with measurable seeded values', async () => {
    httpRequestDurationSeconds.labels('GET', '/api/perf-s3', '200').observe(0.24);
    dbQueryDurationSeconds.labels('select', 'sqlite').observe(0.03);
    llmCallDurationSeconds.labels('provider-s3', 'model-s3').observe(0.41);
    errorsTotal.labels('test', 'performance-envelope-s3').inc(2);

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

    for (const lane of ['http', 'db', 'llm'] as const) {
      expect(res.body.latency[lane]).toEqual(
        expect.objectContaining({
          p50: expect.any(Number),
          p95: expect.any(Number),
          p99: expect.any(Number),
          avg: expect.any(Number),
        })
      );
      for (const key of ['p50', 'p95', 'p99', 'avg'] as const) {
        expect(Number.isFinite(res.body.latency[lane][key])).toBe(true);
      }
    }

    expect(res.body.throughput).toEqual(
      expect.objectContaining({
        http: expect.any(Number),
        db: expect.any(Number),
        llm: expect.any(Number),
      })
    );
    expect(
      [res.body.throughput.http, res.body.throughput.db, res.body.throughput.llm].every((n: number) =>
        Number.isFinite(n)
      )
    ).toBe(true);

    expect(res.body.errors).toEqual(
      expect.objectContaining({
        rate: expect.any(Number),
        total: expect.any(Number),
      })
    );
    expect(Number.isFinite(res.body.errors.rate)).toBe(true);
    expect(res.body.errors.total).toBeGreaterThanOrEqual(2);
    expect(Number(res.body.latency.http.p95)).toBeGreaterThan(0);
    expect(Number(res.body.latency.db.p95)).toBeGreaterThan(0);
    expect(Number(res.body.latency.llm.p95)).toBeGreaterThan(0);
  });
});

