import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminSessionService from '../../server/src/services/adminSessionService.ts';

describe('Admin session service (enterprise verification path) - REAL_CODE', () => {
  const db = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSessionService.setDependencies({
      db: db as any,
      uuidv4: () => 'sess-1' as any,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('getActiveSessions queries all active sessions (optionally filtered by adminId)', async () => {
    db.all.mockResolvedValueOnce([{ id: 'x' }]);
    const rows = await adminSessionService.getActiveSessions('admin-1');
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'x',
        sessionType: 'standard',
        mfaVerified: false,
        isActive: false,
      }),
    ]);
    expect(db.all).toHaveBeenCalledWith(expect.stringContaining('WHERE s.is_active = 1'), [
      'admin-1',
    ]);
  });

  it('createSession writes mfa_verified as integer and returns created row', async () => {
    db.get.mockResolvedValueOnce({ id: 'sess-1', user_id: 'u1' });
    await adminSessionService.createSession({
      userId: 'u1',
      mfaVerified: true,
      ipAddress: '127.0.0.1',
      userAgent: 'ua',
    });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_sessions'),
      expect.arrayContaining(['sess-1', 'u1', 1, 1])
    );
    expect(db.get).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM admin_sessions'), [
      'sess-1',
    ]);
  });

  it('revokeSession returns true when changes > 0', async () => {
    db.run.mockResolvedValueOnce({ changes: 1 });
    const ok = await adminSessionService.revokeSession('sess-1');
    expect(ok).toBe(true);
  });

  it('revokeAllSessions supports exceptSessionId', async () => {
    db.run.mockResolvedValueOnce({ changes: 3 });
    const n = await adminSessionService.revokeAllSessions('u1', 'keep-1');
    expect(n).toBe(3);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('AND id != ?'), ['u1', 'keep-1']);
  });

  it('getSessionStats returns scalar row', async () => {
    db.get.mockResolvedValueOnce({ total: 3, active: 2, mfaVerified: 1, uniqueAdmins: 2 });
    const s = await adminSessionService.getSessionStats();
    expect(s).toEqual({
      total: 3,
      active: 2,
      mfaVerified: 1,
      jitActive: 0,
      breakGlassActive: 0,
      uniqueAdmins: 2,
    });
  });
});
