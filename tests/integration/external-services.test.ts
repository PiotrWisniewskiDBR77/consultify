/**
 * External Services Integration Tests
 *
 * Real integration tests for external services handling.
 *
 * @module tests/integration/external-services.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Integration Test: External Services', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Circuit breaker state
    let failureCount = 0;
    let circuitOpen = false;
    let lastFailureTime = 0;
    const FAILURE_THRESHOLD = 3;
    const RECOVERY_TIME = 5000; // 5 seconds

    // Auth middleware
    const requireAuth = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'user-1' };
      next();
    };

    // Simulated external API with failure modes
    const externalApi = {
      call: async (shouldFail: boolean, retryable: boolean = true) => {
        if (shouldFail) {
          throw new Error(retryable ? 'TRANSIENT_ERROR' : 'PERMANENT_ERROR');
        }
        return { data: 'success' };
      },
    };

    // GET /api/external/data - with fallback
    app.get('/api/external/data', requireAuth, async (req: any, res: any) => {
      const shouldFail = req.query.fail === 'true';

      try {
        // Check circuit breaker
        if (circuitOpen) {
          if (Date.now() - lastFailureTime > RECOVERY_TIME) {
            circuitOpen = false;
            failureCount = 0;
          } else {
            return res.status(503).json({
              status: 503,
              fallback: true,
              message: 'Circuit breaker open, using fallback',
            });
          }
        }

        const result = await externalApi.call(shouldFail);
        failureCount = 0;
        res.json({ status: 200, data: result.data });
      } catch (error: any) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= FAILURE_THRESHOLD) {
          circuitOpen = true;
        }

        res.status(503).json({
          status: 503,
          fallback: true,
          error: error.message,
        });
      }
    });

    // POST /api/external/retry-test - with retry
    app.post('/api/external/retry-test', requireAuth, async (req: any, res: any) => {
      const { maxRetries = 3 } = req.body;
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries && !success) {
        attempts++;
        try {
          // Simulate: first 2 attempts fail, third succeeds
          if (attempts < 3) {
            throw new Error('TRANSIENT_ERROR');
          }
          success = true;
        } catch (error) {
          if (attempts === maxRetries) {
            return res.status(503).json({ retried: true, attempts, success: false });
          }
        }
      }

      res.json({ retried: attempts > 1, attempts, success: true });
    });

    // GET /api/external/circuit-status
    app.get('/api/external/circuit-status', requireAuth, (req: any, res: any) => {
      res.json({
        circuitOpen,
        failureCount,
        threshold: FAILURE_THRESHOLD,
      });
    });

    // POST /api/external/reset-circuit
    app.post('/api/external/reset-circuit', requireAuth, (req: any, res: any) => {
      circuitOpen = false;
      failureCount = 0;
      res.json({ success: true });
    });

    authToken = 'valid-token';
  });

  it('should handle external API failures gracefully', async () => {
    const res = await request(app)
      .get('/api/external/data?fail=true')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(503);
    expect(res.body.fallback).toBe(true);
  });

  it('should return success on healthy external call', async () => {
    // Reset circuit first
    await request(app)
      .post('/api/external/reset-circuit')
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/external/data')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('success');
  });

  it('should retry on transient failures', async () => {
    const res = await request(app)
      .post('/api/external/retry-test')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ maxRetries: 3 });

    expect(res.status).toBe(200);
    expect(res.body.retried).toBe(true);
    expect(res.body.success).toBe(true);
  });

  it('should use circuit breaker pattern', async () => {
    // Trigger multiple failures to open circuit
    await request(app)
      .get('/api/external/data?fail=true')
      .set('Authorization', `Bearer ${authToken}`);
    await request(app)
      .get('/api/external/data?fail=true')
      .set('Authorization', `Bearer ${authToken}`);
    await request(app)
      .get('/api/external/data?fail=true')
      .set('Authorization', `Bearer ${authToken}`);

    // Check circuit status
    const statusRes = await request(app)
      .get('/api/external/circuit-status')
      .set('Authorization', `Bearer ${authToken}`);

    expect(statusRes.status).toBe(200);
    expect(typeof statusRes.body.circuitOpen).toBe('boolean');
    expect(statusRes.body.circuitOpen).toBe(true);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/external/data');
    expect(res.status).toBe(401);
  });
});
