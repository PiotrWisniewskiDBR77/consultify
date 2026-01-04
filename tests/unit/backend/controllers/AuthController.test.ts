/**
 * Auth Controller Tests
 * Tests authentication controller endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import AuthController from '../../../../server/src/controllers/AuthController.ts';

// Mock services
const mockAuthService = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  verifyToken: vi.fn(),
  getCurrentUser: vi.fn(),
  updatePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
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

describe('AuthController', () => {
  let controller: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: vi.SpyInstance;
  let statusSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();

    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    };
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResult = {
        user: { id: 'user-123', email: 'test@example.com' },
        token: 'jwt-token',
        refreshToken: 'refresh-token',
      };

      mockRequest = { body: loginData };
      mockAuthService.login.mockResolvedValue(mockResult);

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
    });

    it('should handle invalid credentials', async () => {
      const loginData = { email: 'test@example.com', password: 'wrong' };
      const error = new Error('Invalid credentials');

      mockRequest = { body: loginData };
      mockAuthService.login.mockRejectedValue(error);

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid credentials' });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      mockRequest = { body: {} };

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockResult = {
        user: { id: 'user-456', email: 'new@example.com' },
        token: 'jwt-token',
      };

      mockRequest = { body: registerData };
      mockAuthService.register.mockResolvedValue(mockResult);

      await controller.register(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith(mockResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
    });

    it('should handle existing user', async () => {
      const registerData = { email: 'existing@example.com', password: 'pass' };
      const error = new Error('User already exists');

      mockRequest = { body: registerData };
      mockAuthService.register.mockRejectedValue(error);

      await controller.register(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'User already exists' });
    });
  });

  describe('logout', () => {
    it('should logout user', async () => {
      const token = 'valid-jwt-token';

      mockRequest = {
        headers: { authorization: `Bearer ${token}` },
      };
      mockAuthService.logout.mockResolvedValue({ success: true });

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ success: true });
      expect(mockAuthService.logout).toHaveBeenCalledWith(token);
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockResult = {
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
      };

      mockRequest = { body: { refreshToken } };
      mockAuthService.refreshToken.mockResolvedValue(mockResult);

      await controller.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user profile', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockRequest = { user: { id: userId } };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      await controller.getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockUser);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const userId = 'user-123';
      const passwordData = {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      };

      mockRequest = {
        user: { id: userId },
        body: passwordData,
      };
      mockAuthService.updatePassword.mockResolvedValue({ success: true });

      await controller.updatePassword(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ success: true });
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(userId, passwordData);
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';

      mockRequest = { body: { email } };
      mockAuthService.requestPasswordReset.mockResolvedValue({ success: true });

      await controller.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Password reset email sent',
        success: true,
      });
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(email);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      };

      mockRequest = { body: resetData };
      mockAuthService.resetPassword.mockResolvedValue({ success: true });

      await controller.resetPassword(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ success: true });
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetData);
    });
  });
});