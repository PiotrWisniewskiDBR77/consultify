/**
 * Auth Routes Tests
 * Tests authentication endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Use vi.hoisted to ensure the mock is available before vi.mock is called
const mocks = vi.hoisted(() => {
  return {
    authController: {
      login: vi.fn((req, res) => res.status(200).json({ token: 'mock-token' })),
      register: vi.fn((req, res) => res.status(201).json({ id: 'user-123' })),
      logout: vi.fn((req, res) => res.status(200).json({ success: true })),
      refreshToken: vi.fn((req, res) => res.status(200).json({ token: 'new-token' })),
      changePassword: vi.fn((req, res) => res.status(200).json({ success: true })),
      resetPassword: vi.fn((req, res) => res.status(200).json({ success: true })),
      verifyEmail: vi.fn((req, res) => res.status(200).json({ success: true })),
      revokeAllTokens: vi.fn((req, res) => res.status(200).json({ success: true }))
    },
    mfaService: {
      setupMFA: vi.fn(),
      enableMFA: vi.fn(),
      disableMFA: vi.fn(),
      verifyTOTP: vi.fn()
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Mock the controller
vi.mock('../../../../server/src/controllers/AuthController.js', () => ({
  login: mocks.authController.login,
  register: mocks.authController.register,
  logout: mocks.authController.logout,
  refreshToken: mocks.authController.refreshToken,
  changePassword: mocks.authController.changePassword,
  resetPassword: mocks.authController.resetPassword,
  verifyEmail: mocks.authController.verifyEmail,
  revokeAllTokens: mocks.authController.revokeAllTokens
}));

// Mock services used in routes
vi.mock('../../../../server/src/services/MFAService.js', () => ({
  default: mocks.mfaService
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mocks.logger
}));

// Mock middlewares to avoid side effects
vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'USER' };
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: any) => next()
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (req: any, res: any, next: any) => next()
}));

// Import routes after mocks
import authRoutes from '../../../../server/src/routes/auth.routes.ts';

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  describe('POST /api/auth/login', () => {
    it('should call authController.login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      mocks.authController.login.mockImplementationOnce((req, res) => {
          return res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(mocks.authController.login).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should call authController.register', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      mocks.authController.register.mockImplementationOnce((req, res) => {
          return res.status(201).json({ id: 'user-123' });
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData);

      expect(response.status).toBe(201);
      expect(mocks.authController.register).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should call authController.logout', async () => {
      mocks.authController.logout.mockImplementationOnce((req, res) => {
          return res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(mocks.authController.logout).toHaveBeenCalled();
    });
  });
});
