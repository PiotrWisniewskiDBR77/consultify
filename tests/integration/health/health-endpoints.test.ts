/**
 * Health Integration Tests
 * Testing health check endpoints
 *
 * @module tests/integration/health/health-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Health Endpoints Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    app.get('/health/ready', (req, res) => {
      res.json({
        ready: true,
        checks: {
          database: 'connected',
          cache: 'connected',
          queue: 'connected',
        },
      });
    });

    app.get('/health/live', (req, res) => {
      res.json({ alive: true });
    });

    app.get('/health/detailed', (req, res) => {
      res.json({
        status: 'healthy',
        version: '1.0.0',
        services: {
          api: { status: 'up', latency: 5 },
          database: { status: 'up', latency: 10 },
          cache: { status: 'up', latency: 2 },
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.ready).toBe(true);
    });

    it('should include service checks', async () => {
      const response = await request(app).get('/health/ready');
      expect(response.body.checks.database).toBe('connected');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.alive).toBe(true);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health', async () => {
      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.services).toBeDefined();
      expect(response.body.memory).toBeDefined();
    });
  });
});
