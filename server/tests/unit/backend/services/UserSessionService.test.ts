/**
 * UserSessionService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for UserSessionService - Covering Redis Session Management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Session Cache - Hoisted
const { mockSessionCache } = vi.hoisted(() => {
  return {
    mockSessionCache: {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    },
  };
});

vi.mock('../../../../src/services/redis/CacheService.js', () => ({
  sessionCache: mockSessionCache,
}));

vi.mock('../../../../src/utils/Logger.ts', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import UserSessionService from '../../../../src/services/userSessionService.js';

describe('UserSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create session in redis', async () => {
      const userId = 'user-1';
      const token = 'token-123';

      await UserSessionService.createSession(userId, token, { role: 'user' });

      expect(mockSessionCache.set).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          userId,
          token,
          metadata: { role: 'user' },
        }),
        86400
      );
    });
  });

  describe('isValidSession', () => {
    it('should return true for valid session', async () => {
      const validSession = {
        userId: 'user-1',
        token: 'token-123',
        expiresAt: Date.now() + 10000,
      };
      mockSessionCache.get.mockResolvedValue(validSession);

      const isValid = await UserSessionService.isValidSession('user-1', 'token-123');
      expect(isValid).toBe(true);
    });

    it('should return false if session not found', async () => {
      mockSessionCache.get.mockResolvedValue(null);
      const isValid = await UserSessionService.isValidSession('user-1', 'token-123');
      expect(isValid).toBe(false);
    });

    it('should return false if token mismatch', async () => {
      const validSession = {
        userId: 'user-1',
        token: 'other-token',
        expiresAt: Date.now() + 10000,
      };
      mockSessionCache.get.mockResolvedValue(validSession);

      const isValid = await UserSessionService.isValidSession('user-1', 'token-123');
      expect(isValid).toBe(false);
    });

    it('should return false if expired', async () => {
      const expiredSession = {
        userId: 'user-1',
        token: 'token-123',
        expiresAt: Date.now() - 10000,
      };
      mockSessionCache.get.mockResolvedValue(expiredSession);

      const isValid = await UserSessionService.isValidSession('user-1', 'token-123');
      expect(isValid).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    it('should delete session from redis', async () => {
      await UserSessionService.invalidateSession('user-1');
      expect(mockSessionCache.del).toHaveBeenCalledWith('user-1');
    });
  });
});
