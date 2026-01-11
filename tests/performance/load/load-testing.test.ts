/**
 * Load Performance Tests
 * Testing system under load
 *
 * @module tests/performance/load/load-testing.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Load Performance Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

    app.post('/api/echo', (req, res) => res.json(req.body));

    app.get('/api/compute', (req, res) => {
      // Simulate some computation
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      res.json({ result: sum });
    });
  });

  describe('Concurrent Request Load', () => {
    it('should handle 20 concurrent requests', async () => {
      const requests = Array.from({ length: 20 }, () => request(app).get('/api/status'));

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      const allSuccessful = responses.every((r) => r.status === 200);
      expect(allSuccessful).toBe(true);
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle 50 concurrent POST requests', async () => {
      const requests = Array.from({ length: 50 }, (_, i) =>
        request(app).post('/api/echo').send({ index: i })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      const allSuccessful = responses.every((r) => r.status === 200);
      expect(allSuccessful).toBe(true);
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Sequential Load', () => {
    it('should handle 100 sequential requests under 5s', async () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/api/status');
        expect(response.status).toBe(200);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Compute-Heavy Load', () => {
    it('should handle 10 compute requests concurrently', async () => {
      const requests = Array.from({ length: 10 }, () => request(app).get('/api/compute'));

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      responses.forEach((r) => {
        expect(r.status).toBe(200);
        expect(r.body.result).toBe(499500);
      });
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('Mixed Load', () => {
    it('should handle mixed GET and POST under load', async () => {
      const requests = [
        ...Array.from({ length: 15 }, () => request(app).get('/api/status')),
        ...Array.from({ length: 15 }, (_, i) => request(app).post('/api/echo').send({ i })),
      ];

      const start = Date.now();
      const responses = await Promise.all(requests);
      const elapsed = Date.now() - start;

      const allSuccessful = responses.every((r) => r.status === 200);
      expect(allSuccessful).toBe(true);
      expect(elapsed).toBeLessThan(1500);
    });
  });
});
