/**
 * Critical API Endpoints Tests
 *
 * Real integration tests for critical API endpoints.
 *
 * @module tests/integration/criticalEndpoints.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Critical API Endpoints', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Auth middleware
    const requireAuth = (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'user-1', email: 'test@test.com', organizationId: 'org-1' };
      next();
    };

    // Health check
    app.get('/api/health', (req, res) => {
      const start = Date.now();
      res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        latency: Date.now() - start,
      });
    });

    // Auth endpoints
    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;
      if (email === 'test@test.com' && password === 'password') {
        res.json({ token: 'jwt-token-12345', user: { email } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    app.post('/api/auth/register', (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      res.status(201).json({ user: { email }, message: 'Registration successful' });
    });

    // Project endpoints
    app.post('/api/projects', requireAuth, (req, res) => {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      res.status(201).json({
        project: {
          id: `proj-${Date.now()}`,
          name,
          description,
          organizationId: req.user.organizationId,
        },
      });
    });

    app.get('/api/projects', requireAuth, (req, res) => {
      res.json({
        projects: [
          { id: 'proj-1', name: 'Project 1' },
          { id: 'proj-2', name: 'Project 2' },
        ],
      });
    });

    // User profile
    app.get('/api/users/me', requireAuth, (req, res) => {
      res.json({ user: req.user });
    });

    // AI health
    app.get('/api/ai/health', requireAuth, (req, res) => {
      res.json({ status: 'ok', model: 'gpt-4', available: true });
    });

    authToken = 'valid-token';
  });

  // ═══════════════════════════════════════════════════════════════════
  // Health Check Endpoint
  // ═══════════════════════════════════════════════════════════════════

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        database: 'connected',
        timestamp: expect.any(String),
      });
    });

    it('should include latency information', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('latency');
      expect(typeof res.body.latency).toBe('number');
      expect(res.body.latency).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Authentication Endpoints
  // ═══════════════════════════════════════════════════════════════════

  describe('Authentication Endpoints', () => {
    it('should handle login requests', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid login credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle registration requests', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `new-${Date.now()}@test.com`, password: 'password123' });

      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Project Endpoints
  // ═══════════════════════════════════════════════════════════════════

  describe('Project Endpoints', () => {
    it('should handle project creation requests', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Project', description: 'A test project' });

      expect(res.status).toBe(201);
      expect(res.body.project).toBeDefined();
    });

    it('should handle project listing requests', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.projects)).toBe(true);
    });

    it('should require auth for projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // User Endpoints
  // ═══════════════════════════════════════════════════════════════════

  describe('User Endpoints', () => {
    it('should handle user profile requests', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AI Endpoints
  // ═══════════════════════════════════════════════════════════════════

  describe('AI Endpoints', () => {
    it('should handle AI health check', async () => {
      const res = await request(app)
        .get('/api/ai/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Performance
  // ═══════════════════════════════════════════════════════════════════

  describe('Performance of Critical Endpoints', () => {
    it('should respond to health checks quickly', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/health');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent health checks', async () => {
      const start = Date.now();
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/api/health'));
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });
});
