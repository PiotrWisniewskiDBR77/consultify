/**
 * AdminSessionService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for AdminSessionService - Covering Session Management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB - Hoisted
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    },
  };
});

// Import service via default export from the TS wrapper or JS file
// The test file was originally importing from ../../../../src/services/adminSessionService.js which is the TS wrapper exporting default.
import AdminSessionService from '../../../../src/services/adminSessionService.js';

describe('AdminSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockResolvedValue({ changes: 1, lastID: 1 });

    // Inject mocks
    AdminSessionService.setDependencies({
      db: mockDb,
      uuidv4: () => 'mock-uuid',
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const result = await AdminSessionService.createSession({
        adminId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
        mfaVerified: true,
      });

      expect(result.id).toBe('mock-uuid');
      expect(result.sessionToken).toBeDefined();
      expect(result.mfaVerified).toBe(true);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_sessions'),
        expect.arrayContaining(['mock-uuid', 'admin-1', '127.0.0.1', 'Mozilla', 1])
      );
    });
  });

  describe('verifySession', () => {
    it('should return valid if session exists and is active', async () => {
      const mockSession = {
        id: 'session-1',
        admin_id: 'admin-1',
        is_active: 1,
        expires_at: new Date(Date.now() + 10000).toISOString(),
        mfa_verified: 1,
      };
      mockDb.get.mockResolvedValue(mockSession);

      const result = await AdminSessionService.verifySession('valid-token');
      expect(result.valid).toBe(true);
      expect(result.session.id).toBe('session-1');
    });

    it('should return invalid if session not found', async () => {
      mockDb.get.mockResolvedValue(null);
      const result = await AdminSessionService.verifySession('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Session not found');
    });

    it('should return invalid if session revoked', async () => {
      const mockSession = {
        id: 'session-1',
        is_active: 0,
        expires_at: new Date(Date.now() + 10000).toISOString(),
      };
      mockDb.get.mockResolvedValue(mockSession);

      const result = await AdminSessionService.verifySession('revoked-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Session has been revoked');
    });

    it('should return invalid and revoke if session expired', async () => {
      const mockSession = {
        id: 'session-1',
        is_active: 1,
        expires_at: new Date(Date.now() - 10000).toISOString(), // Expired
      };
      mockDb.get.mockResolvedValue(mockSession);

      const result = await AdminSessionService.verifySession('expired-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Session has expired');

      // Verify auto-revocation
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE admin_sessions SET is_active = 0'),
        ['session-1']
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke session', async () => {
      await AdminSessionService.revokeSession('session-1');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE admin_sessions SET is_active = 0'),
        ['session-1']
      );
    });
  });
});
