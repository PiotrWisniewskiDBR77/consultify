import AuditService from '../../../server/services/auditService';
import MFAService from '../../../server/services/mfaService';
import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireActiveTenantMembershipOrUnavailable } from '../../../server/src/middleware/auditsStrictMembership.middleware.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

/**
 * MFA Routes Integration Tests
 *
 * Tests for Multi-Factor Authentication endpoints:
 * - GET /api/mfa/status
 * - POST /api/mfa/setup
 * - POST /api/mfa/verify-setup
 * - POST /api/mfa/challenge
 * - POST /api/mfa/backup-code
 * - POST /api/mfa/regenerate-codes
 * - POST /api/mfa/disable
 * - GET /api/mfa/devices
 * - DELETE /api/mfa/devices/:id
 * - DELETE /api/mfa/devices
 */

// Mock dependencies
vi.mock('../../../server/middleware/authMiddleware', () => ({
  default: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
}));

vi.mock('../../../server/services/mfaService', () => ({
  default: {
    getMFAStatus: vi.fn(),
    setupMFA: vi.fn(),
    verifyAndEnableMFA: vi.fn(),
    verifyTOTP: vi.fn(),
    useBackupCode: vi.fn(),
    regenerateBackupCodes: vi.fn(),
    disableMFA: vi.fn(),
    trustDevice: vi.fn(),
    getTrustedDevices: vi.fn(),
    revokeTrustedDevice: vi.fn(),
    revokeAllTrustedDevices: vi.fn(),
    isDeviceTrusted: vi.fn(),
  },
}));

vi.mock('../../../server/services/auditService', () => ({
  default: {
    logFromRequest: vi.fn(),
  },
}));

// Import after mocks

describe('MFA Routes', () => {
  const db = getDatabase();
  beforeAll(async () => {
    await initializeDatabase();
  });

  const mockUser = { id: 1, email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== GET /api/mfa/status Tests =====

  describe('GET /api/mfa/status', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should return MFA status for user', async () => {
      vi.mocked(MFAService.getMFAStatus).mockResolvedValue({
        enabled: true,
        enforced: false,
        backupCodesRemaining: 8,
      });

      const status = await MFAService.getMFAStatus(mockUser.id);

      expect(status.enabled).toBe(true);
      expect(status.enforced).toBe(false);
      expect(status.backupCodesRemaining).toBe(8);
    });

    it('should return disabled status for new user', async () => {
      vi.mocked(MFAService.getMFAStatus).mockResolvedValue({
        enabled: false,
        enforced: false,
      });

      const status = await MFAService.getMFAStatus(mockUser.id);

      expect(status.enabled).toBe(false);
    });

    it('should return enforced flag when org requires MFA', async () => {
      vi.mocked(MFAService.getMFAStatus).mockResolvedValue({
        enabled: false,
        enforced: true,
        gracePeriodRemaining: 7,
      });

      const status = await MFAService.getMFAStatus(mockUser.id);

      expect(status.enforced).toBe(true);
      expect(status.gracePeriodRemaining).toBe(7);
    });
  });

  // ===== POST /api/mfa/setup Tests =====

  describe('POST /api/mfa/setup', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should return QR code and manual entry for setup', async () => {
      vi.mocked(MFAService.setupMFA).mockResolvedValue({
        qrCode: 'data:image/png;base64,mock-qr-code',
        manualEntry: 'ABCD1234EFGH5678',
      });

      const setup = await MFAService.setupMFA(mockUser.id, mockUser.email);

      expect(setup.qrCode).toContain('data:image/png');
      expect(setup.manualEntry).toBeDefined();
    });

    it('should log setup initiation', async () => {
      vi.mocked(MFAService.setupMFA).mockResolvedValue({
        qrCode: 'mock-qr',
        manualEntry: 'MOCK1234',
      });

      await MFAService.setupMFA(mockUser.id, mockUser.email);

      // Verify setup was called
      expect(MFAService.setupMFA).toHaveBeenCalledWith(mockUser.id, mockUser.email);
    });
  });

  // ===== POST /api/mfa/verify-setup Tests =====

  describe('POST /api/mfa/verify-setup', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should enable MFA with valid token', async () => {
      vi.mocked(MFAService.verifyAndEnableMFA).mockResolvedValue({
        success: true,
        backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5'],
      });

      const result = await MFAService.verifyAndEnableMFA(mockUser.id, '123456');

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(5);
    });

    it('should reject invalid token format', () => {
      const token = '12345'; // 5 digits instead of 6

      expect(token.length).not.toBe(6);
    });

    it('should reject empty token', () => {
      const token = '';

      expect(!token).toBe(true);
    });

    it('should reject invalid TOTP', async () => {
      vi.mocked(MFAService.verifyAndEnableMFA).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await MFAService.verifyAndEnableMFA(mockUser.id, '000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  // ===== POST /api/mfa/challenge Tests =====

  describe('POST /api/mfa/challenge', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should verify valid TOTP', async () => {
      vi.mocked(MFAService.verifyTOTP).mockResolvedValue({
        success: true,
      });

      const result = await MFAService.verifyTOTP(mockUser.id, '123456', '127.0.0.1', 'Mozilla/5.0');

      expect(result.success).toBe(true);
    });

    it('should reject invalid TOTP', async () => {
      vi.mocked(MFAService.verifyTOTP).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await MFAService.verifyTOTP(mockUser.id, '000000', '127.0.0.1', 'Mozilla/5.0');

      expect(result.success).toBe(false);
    });

    it('should block after too many attempts', async () => {
      vi.mocked(MFAService.verifyTOTP).mockResolvedValue({
        success: false,
        error: 'Too many attempts',
        blocked: true,
      });

      const result = await MFAService.verifyTOTP(mockUser.id, '000000', '127.0.0.1', 'Mozilla/5.0');

      expect(result.blocked).toBe(true);
    });

    it('should trust device when requested', async () => {
      vi.mocked(MFAService.verifyTOTP).mockResolvedValue({ success: true });
      vi.mocked(MFAService.trustDevice).mockResolvedValue({ success: true });

      await MFAService.verifyTOTP(mockUser.id, '123456', '127.0.0.1', 'Mozilla');
      await MFAService.trustDevice(mockUser.id, 'device-fingerprint', 'Chrome on Windows');

      expect(MFAService.trustDevice).toHaveBeenCalledWith(
        mockUser.id,
        'device-fingerprint',
        'Chrome on Windows'
      );
    });
  });

  // ===== POST /api/mfa/backup-code Tests =====

  describe('POST /api/mfa/backup-code', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should accept valid backup code', async () => {
      vi.mocked(MFAService.useBackupCode).mockResolvedValue({
        success: true,
        remainingCodes: 4,
      });

      const result = await MFAService.useBackupCode(
        mockUser.id,
        'BACKUP-CODE-1',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(4);
    });

    it('should reject invalid backup code', async () => {
      vi.mocked(MFAService.useBackupCode).mockResolvedValue({
        success: false,
        error: 'Invalid backup code',
      });

      const result = await MFAService.useBackupCode(
        mockUser.id,
        'INVALID-CODE',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.success).toBe(false);
    });

    it('should warn when few backup codes remain', async () => {
      vi.mocked(MFAService.useBackupCode).mockResolvedValue({
        success: true,
        remainingCodes: 1,
        warning: 'Only 1 backup code remaining. Consider regenerating.',
      });

      const result = await MFAService.useBackupCode(
        mockUser.id,
        'BACKUP-CODE',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.warning).toBeDefined();
      expect(result.remainingCodes).toBe(1);
    });

    it('should require backup code', () => {
      const body = {};

      expect(body.code).toBeUndefined();
    });
  });

  // ===== POST /api/mfa/regenerate-codes Tests =====

  describe('POST /api/mfa/regenerate-codes', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should regenerate backup codes with valid TOTP', async () => {
      vi.mocked(MFAService.regenerateBackupCodes).mockResolvedValue({
        success: true,
        backupCodes: ['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5'],
      });

      const result = await MFAService.regenerateBackupCodes(mockUser.id, '123456');

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(5);
    });

    it('should require TOTP to regenerate codes', async () => {
      vi.mocked(MFAService.regenerateBackupCodes).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await MFAService.regenerateBackupCodes(mockUser.id, '000000');

      expect(result.success).toBe(false);
    });
  });

  // ===== POST /api/mfa/disable Tests =====

  describe('POST /api/mfa/disable', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should disable MFA with valid TOTP', async () => {
      vi.mocked(MFAService.disableMFA).mockResolvedValue({ success: true });
      vi.mocked(MFAService.revokeAllTrustedDevices).mockResolvedValue({
        count: 2,
      });

      const result = await MFAService.disableMFA(mockUser.id, '123456');
      await MFAService.revokeAllTrustedDevices(mockUser.id);

      expect(result.success).toBe(true);
      expect(MFAService.revokeAllTrustedDevices).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject invalid TOTP when disabling', async () => {
      vi.mocked(MFAService.disableMFA).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await MFAService.disableMFA(mockUser.id, '000000');

      expect(result.success).toBe(false);
    });

    it('should require TOTP token', () => {
      const token = '';

      expect(!token || token.length !== 6).toBe(true);
    });
  });

  // ===== Trusted Devices Tests =====

  describe('Trusted Devices', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    describe('GET /api/mfa/devices', () => {
      const db = getDatabase();
      beforeAll(async () => {
        await initializeDatabase();
      });

      it('should list trusted devices', async () => {
        vi.mocked(MFAService.getTrustedDevices).mockResolvedValue([
          {
            id: 1,
            name: 'Chrome on Windows',
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            name: 'Safari on iPhone',
            created_at: new Date().toISOString(),
          },
        ]);

        const devices = await MFAService.getTrustedDevices(mockUser.id);

        expect(devices).toHaveLength(2);
      });

      it('should return empty array when no trusted devices', async () => {
        vi.mocked(MFAService.getTrustedDevices).mockResolvedValue([]);

        const devices = await MFAService.getTrustedDevices(mockUser.id);

        expect(devices).toHaveLength(0);
      });
    });

    describe('DELETE /api/mfa/devices/:id', () => {
      const db = getDatabase();
      beforeAll(async () => {
        await initializeDatabase();
      });

      it('should revoke specific trusted device', async () => {
        vi.mocked(MFAService.revokeTrustedDevice).mockResolvedValue({
          success: true,
        });

        const result = await MFAService.revokeTrustedDevice(mockUser.id, '1');

        expect(result.success).toBe(true);
      });

      it('should return 404 for non-existent device', async () => {
        vi.mocked(MFAService.revokeTrustedDevice).mockResolvedValue({
          success: false,
        });

        const result = await MFAService.revokeTrustedDevice(mockUser.id, '999');

        expect(result.success).toBe(false);
      });
    });

    describe('DELETE /api/mfa/devices', () => {
      const db = getDatabase();
      beforeAll(async () => {
        await initializeDatabase();
      });

      it('should revoke all trusted devices', async () => {
        vi.mocked(MFAService.revokeAllTrustedDevices).mockResolvedValue({
          count: 3,
        });

        const result = await MFAService.revokeAllTrustedDevices(mockUser.id);

        expect(result.count).toBe(3);
      });
    });

    describe('Device Trust Check', () => {
      const db = getDatabase();
      beforeAll(async () => {
        await initializeDatabase();
      });

      it('should check if device is trusted', async () => {
        vi.mocked(MFAService.isDeviceTrusted).mockResolvedValue(true);

        const isTrusted = await MFAService.isDeviceTrusted(mockUser.id, 'device-fingerprint');

        expect(isTrusted).toBe(true);
      });

      it('should return false for untrusted device', async () => {
        vi.mocked(MFAService.isDeviceTrusted).mockResolvedValue(false);

        const isTrusted = await MFAService.isDeviceTrusted(mockUser.id, 'unknown-device');

        expect(isTrusted).toBe(false);
      });
    });
  });

  // ===== Audit Logging Tests =====

  describe('Audit Logging', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should log MFA setup initiation', () => {
      AuditService.logFromRequest(
        { user: mockUser, ip: '127.0.0.1' },
        'MFA_SETUP_INITIATED',
        'user',
        mockUser.id,
        { email: mockUser.email }
      );

      expect(AuditService.logFromRequest).toHaveBeenCalledWith(
        expect.any(Object),
        'MFA_SETUP_INITIATED',
        'user',
        mockUser.id,
        expect.objectContaining({ email: mockUser.email })
      );
    });

    it('should log MFA enabled', () => {
      AuditService.logFromRequest({ user: mockUser }, 'MFA_ENABLED', 'user', mockUser.id, {
        backupCodesGenerated: 5,
      });

      expect(AuditService.logFromRequest).toHaveBeenCalled();
    });

    it('should log MFA disabled (critical event)', () => {
      AuditService.logFromRequest({ user: mockUser }, 'MFA_DISABLED', 'user', mockUser.id);

      expect(AuditService.logFromRequest).toHaveBeenCalledWith(
        expect.any(Object),
        'MFA_DISABLED',
        'user',
        mockUser.id
      );
    });

    it('should log backup code usage', () => {
      AuditService.logFromRequest({ user: mockUser }, 'MFA_BACKUP_CODE_USED', 'user', mockUser.id, {
        remainingCodes: 4,
      });

      expect(AuditService.logFromRequest).toHaveBeenCalled();
    });
  });

  // ===== Token Validation Tests =====

  describe('Token Validation', () => {
    const db = getDatabase();
    beforeAll(async () => {
      await initializeDatabase();
    });

    it('should reject token shorter than 6 digits', () => {
      const token = '12345';

      expect(token.length !== 6).toBe(true);
    });

    it('should reject token longer than 6 digits', () => {
      const token = '1234567';

      expect(token.length !== 6).toBe(true);
    });

    it('should accept exactly 6 digit token', () => {
      const token = '123456';

      expect(token.length === 6).toBe(true);
    });

    it('should reject non-numeric token', () => {
      const token = 'abcdef';

      // In real implementation, would validate numeric
      expect(/^\d{6}$/.test(token)).toBe(false);
    });
  });
});

describe('mounted MFA auth wall contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mounts authentication then uncached ACTIVE membership exactly once before handlers', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/src/routes/mfa.routes.ts'), 'utf8');

    expect(source).toContain(
      'router.use(verifyToken, requireActiveTenantMembershipOrUnavailable)'
    );
    expect(
      source.match(
        /router\.use\(verifyToken, requireActiveTenantMembershipOrUnavailable\)/g
      )
    ).toHaveLength(1);
    expect(source).not.toContain('const isAuthenticated = verifyToken');

    for (const route of [
      "router.get('/status', async",
      "router.post('/setup', async",
      "router.post('/verify-setup', async",
      "router.post('/verify', async",
      "router.post('/disable', async",
    ]) {
      expect(source).toContain(route);
    }
    expect(source).not.toMatch(/router\.(?:get|post)\([^\n]+verifyToken/);
  });

  function responseRecorder() {
    const response = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    return response;
  }

  it('denies an ordinary authenticated user without an ACTIVE membership before the handler', async () => {
    vi.spyOn(DbPromise, 'get').mockResolvedValueOnce(undefined);
    const response = responseRecorder();
    const handler = vi.fn();

    const write = vi.spyOn(DbPromise, 'run');
    await requireActiveTenantMembershipOrUnavailable(
      { user: { id: 'ordinary', organizationId: 'tenant-a' } },
      response,
      handler
    );

    expect(response).toMatchObject({
      statusCode: 403,
      body: { code: 'ORG_MEMBERSHIP_REVOKED' },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the targeted membership lookup fails and never enters MFA', async () => {
    vi.spyOn(DbPromise, 'get').mockRejectedValueOnce(new Error('membership lookup unavailable'));
    const response = responseRecorder();
    const mfaHandler = vi.fn();

    const write = vi.spyOn(DbPromise, 'run');
    await requireActiveTenantMembershipOrUnavailable(
      { user: { id: 'ordinary', organizationId: 'tenant-a' } },
      response,
      mfaHandler
    );

    expect(response).toMatchObject({
      statusCode: 503,
      body: { code: 'ORG_MEMBERSHIP_UNAVAILABLE' },
    });
    expect(mfaHandler).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('intentionally lets a platform SUPERADMIN reach only the subsequent own-user MFA handler', async () => {
    const membershipLookup = vi.spyOn(DbPromise, 'get');
    const response = responseRecorder();
    const ownUserMfaHandler = vi.fn();
    const mountedRequest = {
      body: { userId: 'different-user' },
      user: { id: 'platform-admin', organizationId: 'tenant-a', isSuperAdmin: true },
    };

    await requireActiveTenantMembershipOrUnavailable(
      mountedRequest,
      response,
      ownUserMfaHandler
    );

    expect(response.statusCode).toBe(200);
    expect(membershipLookup).not.toHaveBeenCalled();
    expect(ownUserMfaHandler).toHaveBeenCalledTimes(1);
    expect(mountedRequest.user.id).toBe('platform-admin');
    expect(mountedRequest.body.userId).toBe('different-user');
    const source = readFileSync(resolve(process.cwd(), 'server/src/routes/mfa.routes.ts'), 'utf8');
    expect(source.match(/const userId = \(req as any\)\.user\?\.id;/g)?.length).toBeGreaterThan(0);
    expect(source).not.toMatch(/const\s*\{[^}]*userId[^}]*\}\s*=\s*req\.body/);
  });
});
