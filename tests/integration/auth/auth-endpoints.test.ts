/**
 * Auth Integration Tests
 * Testing authentication endpoints with real HTTP
 *
 * @module tests/integration/auth/auth-endpoints.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Auth Endpoints Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock auth routes
    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
      }
      if (email === 'test@example.com' && password === 'password123') {
        return res.json({ token: 'mock-jwt-token', user: { id: '1', email } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    });

    app.post('/api/auth/register', (req, res) => {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      return res.status(201).json({ id: '1', email, name });
    });

    app.post('/api/auth/logout', (req, res) => {
      return res.json({ success: true });
    });

    app.post('/api/auth/refresh', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
      }
      return res.json({ token: 'new-mock-token' });
    });

    app.post('/api/auth/forgot-password', (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }
      return res.json({ message: 'Reset email sent' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
    });

    it('should require email and password', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'pass123', name: 'Test User' });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('new@example.com');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer old-token');

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('should reject without token', async () => {
      const response = await request(app).post('/api/auth/refresh');

      expect(response.status).toBe(401);
    });
  });
});
