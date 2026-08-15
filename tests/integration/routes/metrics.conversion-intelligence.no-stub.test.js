import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

// @vitest-environment node

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Metrics conversion intelligence (honest 503)', () => {
  it('GET /api/metrics/conversion-intelligence returns 503', async () => {
    const res = await request(app).get('/api/metrics/conversion-intelligence');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('FEATURE_UNAVAILABLE');
  });
});
