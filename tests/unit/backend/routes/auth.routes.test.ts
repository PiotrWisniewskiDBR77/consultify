/**
 * Auth Routes Tests
 * Tests authentication endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../../../server/src/routes/auth.routes.ts';

// Mock services
const mockAuthService = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  verifyToken: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../../server/src/services/AuthService.ts', () => ({
  default: mockAuthService,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mockLogger,
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        user: { id: 'user-123', email: 'test@example.com' },
        token: 'jwt-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = { email: 'test@example.com', password: 'wrong' };
      const error = new Error('Invalid credentials');

      mockAuthService.login.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockResponse = {
        user: { id: 'user-456', email: 'new@example.com' },
        token: 'jwt-token',
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toEqual(mockResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
    });

    it('should return 409 for existing email', async () => {
      const registerData = { email: 'existing@example.com', password: 'pass' };
      const error = new Error('User already exists');

      mockAuthService.register.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user', async () => {
      const token = 'valid-jwt-token';

      mockAuthService.logout.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockAuthService.logout).toHaveBeenCalledWith(token);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockResponse = {
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshToken.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshToken);
    });
  });
});
