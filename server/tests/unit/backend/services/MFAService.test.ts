/**
 * MFAService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for MFAService - Covering TOTP, Backup Codes, and Security Logic
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

// Mock Database Module
vi.mock('../../../../src/database/Database.ts', () => ({
  getDatabase: () => mockDb,
}));

// Mock External Libraries
vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(() => ({ base32: 'MOCK_SECRET', otpauth_url: 'otpauth://url' })),
    totp: {
      verify: vi.fn(),
    },
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hashSync: vi.fn(() => 'hashed_backup_code'),
    compareSync: vi.fn((plain, hash) => plain === 'VALID-CODE' || hash === 'hashed_backup_code'),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

// Mock Crypto (needs to support top-level execution in service)
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn((size) => ({
      toString: () => 'a'.repeat(size * 2), // Valid hex
    })),
    createCipheriv: vi.fn(() => ({
      update: vi.fn().mockReturnValue('encrypted'),
      final: vi.fn().mockReturnValue(''),
      getAuthTag: vi.fn().mockReturnValue({ toString: () => 'authtag' }),
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn().mockReturnValue('decrypted_secret'),
      final: vi.fn().mockReturnValue(''),
    })),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('hashed_fingerprint'),
    })),
  },
}));

import speakeasy from 'speakeasy';

import MFAService from '../../../../src/services/MFAService.js';

describe('MFAService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DB mocks for Callback style (used by service wrappers)
    mockDb.run.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      if (callback) callback.call({ changes: 1, lastID: 1 }, null);
      return mockDb;
    });

    // Smart DB Get Mock
    mockDb.get.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      const query = sql.toLowerCase();

      if (query.includes('count(*)')) {
        callback(null, { count: 0 });
      } else if (query.includes('mfa_secret') || query.includes('mfa_enabled')) {
        callback(null, {
          mfa_enabled: 1,
          mfa_secret: '1234:5678:abcd', // Format: iv:tag:encrypted
          mfa_sms_enabled: 0,
          phone_number: null,
        });
      } else if (query.includes('mfa_backup_codes')) {
        callback(null, {
          mfa_backup_codes: JSON.stringify(['hashed_backup_code', 'other_hash']),
        });
      } else {
        callback(null, null);
      }
      return mockDb;
    });

    mockDb.all.mockImplementation((sql, params, cb) => {
      const callback = typeof params === 'function' ? params : cb;
      if (callback) callback(null, []);
      return mockDb;
    });
  });

  describe('setupMFA', () => {
    it('should generate secret and return QR code', async () => {
      const result = await MFAService.setupMFA('user-1', 'test@test.com');

      expect(result.secret).toBe('MOCK_SECRET');
      expect(result.qrCode).toBe('data:image/png;base64,mockqr');
    });
  });

  describe('verifyAndEnableMFA', () => {
    it('should enable MFA if token is valid', async () => {
      (speakeasy.totp.verify as any).mockReturnValue(true);

      const result = await MFAService.verifyAndEnableMFA('user-1', '123456');

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);

      // Verify DB Update: mfa_enabled = 1 in SQL, user-1 in params
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('mfa_enabled = 1'),
        expect.arrayContaining(['user-1']),
        expect.any(Function)
      );
    });

    it('should return error if token is invalid', async () => {
      (speakeasy.totp.verify as any).mockReturnValue(false);

      const result = await MFAService.verifyAndEnableMFA('user-1', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });
  });

  describe('verifyTOTP', () => {
    it('should verify valid token during login', async () => {
      (speakeasy.totp.verify as any).mockReturnValue(true);

      const result = await MFAService.verifyTOTP('user-1', '123456');
      expect(result.success).toBe(true);
    });

    it('should block if too many attempts', async () => {
      // Override mock for this test
      mockDb.get.mockImplementation((sql, params, cb) => {
        const callback = typeof params === 'function' ? params : cb;
        if (sql.toLowerCase().includes('count(*)')) {
          callback(null, { count: 10 });
        } else {
          callback(null, {});
        }
        return mockDb;
      });

      const result = await MFAService.verifyTOTP('user-1', '123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
      expect(result.blocked).toBe(true);
    });
  });

  describe('useBackupCode', () => {
    it('should accept valid backup code and invalidate it', async () => {
      const result = await MFAService.useBackupCode('user-1', 'VALID-CODE');

      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET mfa_backup_codes'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });
});
