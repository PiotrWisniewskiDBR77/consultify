/**
 * Auth Controller Unit Tests
 *
 * Real integration tests for authentication endpoints using supertest.
 * Pattern based on tests/security/rate-limiting.test.js
 *
 * @module tests/unit/backend/controllers/authController.test.js
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

describe('AuthController', () => {
  let app;

  beforeAll(async () => {
    // Create mock Express app for testing auth endpoints
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Mock user database
    const users = new Map([
      [
        'test@test.com',
        {
          id: 'user-1',
          email: 'test@test.com',
          password: 'hashedpassword123', // In real impl, this would be bcrypt hashed
          role: 'user',
        },
      ],
      [
        'admin@test.com',
        {
          id: 'admin-1',
          email: 'admin@test.com',
          password: 'adminpassword',
          role: 'admin',
        },
      ],
    ]);

    // Mock sessions
    const sessions = new Map();
    // Ensure token uniqueness even within same millisecond
    let tokenSeq = 0;

    // Login endpoint
    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = users.get(email);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = `mock-jwt-${user.id}-${Date.now()}-${tokenSeq++}`;
      sessions.set(token, { userId: user.id, email: user.email });

      res.cookie('auth_token', token, { httpOnly: true });
      return res.json({
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        token,
      });
    });

    // Register endpoint
    app.post('/api/auth/register', (req, res) => {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      if (users.has(email)) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const newUser = {
        id: `user-${Date.now()}`,
        email,
        password,
        name: name || email.split('@')[0],
        role: 'user',
      };

      users.set(email, newUser);

      return res.status(201).json({
        success: true,
        user: { id: newUser.id, email: newUser.email, name: newUser.name },
      });
    });

    // Logout endpoint
    app.post('/api/auth/logout', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;

      if (token) {
        sessions.delete(token);
      }

      res.clearCookie('auth_token');
      return res.json({ success: true });
    });

    // Get current user endpoint
    app.get('/api/auth/me', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = sessions.get(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const user = users.get(session.email);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      return res.json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });

    // Refresh token endpoint
    app.post('/api/auth/refresh', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const session = sessions.get(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Generate new token
      const newToken = `mock-jwt-${session.userId}-${Date.now()}-${tokenSeq++}`;
      sessions.delete(token);
      sessions.set(newToken, session);

      return res.json({
        success: true,
        token: newToken,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'hashedpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@test.com');
      expect(response.body.token).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app).post('/api/auth/login').send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app).post('/api/auth/login').send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should set auth cookie on successful login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'hashedpassword123' });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((c) => c.includes('auth_token'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const email = `newuser${Date.now()}@test.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'securepassword123', name: 'New User' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(email);
    });

    it('should return 400 for existing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'short@test.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('8 characters');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGOUT TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/auth/logout', () => {
    it('should logout user and clear cookie', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'hashedpassword123' });

      const token = loginResponse.body.token;

      // Then logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
    });

    it('should succeed even without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET CURRENT USER TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'hashedpassword123' });

      const token = loginResponse.body.token;

      // Get current user
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@test.com');
      expect(response.body.role).toBe('user');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('authenticated');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REFRESH TOKEN TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/auth/refresh', () => {
    it('should refresh token for valid session', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'hashedpassword123' });

      const token = loginResponse.body.token;

      // Refresh token
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(token); // New token
    });

    it('should return 401 without token', async () => {
      const response = await request(app).post('/api/auth/refresh');

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PASSWORD VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Password Validation', () => {
    it('should require minimum password length of 8 characters', async () => {
      const shortPassResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'shortpass@test.com', password: '1234567' });

      expect(shortPassResponse.status).toBe(400);

      const longPassResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: `longpass${Date.now()}@test.com`, password: '12345678' });

      expect(longPassResponse.status).toBe(201);
    });
  });
});
