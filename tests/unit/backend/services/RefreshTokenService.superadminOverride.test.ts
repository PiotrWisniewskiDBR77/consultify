import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { RefreshTokenService } from '../../../../server/src/services/RefreshTokenService.js';

describe('RefreshTokenService - forced SUPERADMIN', () => {
  const originalEnv = process.env.FORCE_SUPERADMIN_EMAILS;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Ensure deterministic forced list for this test.
    process.env.FORCE_SUPERADMIN_EMAILS = 'admin@dbr77.com';
  });

  afterEach(() => {
    process.env.FORCE_SUPERADMIN_EMAILS = originalEnv;
  });

  it('should issue access token with SUPERADMIN role for admin@dbr77.com even if DB returns ADMIN', async () => {
    const mockDb = {
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };

    // Stored refresh token row from JOIN users
    const storedTokenRow = {
      id: 'rt-1',
      user_id: 'u-admin',
      token_hash: 'hash',
      token_family: 'fam-1',
      device_info: 'Device',
      ip_address: null,
      user_agent: null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: null,
      revoked_reason: null,
      created_at: new Date().toISOString(),
      last_used_at: null,
      email: 'admin@dbr77.com',
      role: 'ADMIN',
      organization_id: 'org-1',
      user_status: 'active',
    };

    mockDb.get.mockImplementation((sql: string, params: any[], cb: any) => {
      if (sql.includes('FROM refresh_tokens') && sql.includes('JOIN users')) {
        cb(null, storedTokenRow);
        return;
      }
      // Revoked token lookup etc.
      cb(null, null);
    });

    mockDb.run.mockImplementation(function (sql: string, params: any[], cb: any) {
      // dbRun expects callback signature (err) with `this.lastID/changes`
      cb.call({ lastID: 1, changes: 1 }, null);
    });

    const service = new RefreshTokenService(mockDb as any);
    const result = await service.refreshAccessToken('some-refresh-token', {
      ip: '127.0.0.1',
      userAgent: 'TestAgent',
    });

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeTruthy();

    const decoded: any = jwt.decode(result!.accessToken);
    expect(decoded).toBeTruthy();
    expect(decoded.email).toBe('admin@dbr77.com');
    expect(decoded.role).toBe('SUPERADMIN');

    // Best-effort role persistence should be attempted
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET role'),
      ['SUPERADMIN', 'u-admin'],
      expect.any(Function)
    );
  });
});
