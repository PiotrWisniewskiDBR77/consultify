import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminSessionService from '../../../../server/src/services/adminSessionService.js';

describe('adminSessionService', () => {
  const fakeDb = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adminSessionService.setDependencies({
      db: fakeDb as any,
      uuidv4: (() => 'session-uuid-1') as any,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    fakeDb.run.mockResolvedValue({ changes: 1 });
    fakeDb.get.mockResolvedValue(null);
    fakeDb.all.mockResolvedValue([]);
  });

  it('clamps JIT sessions to short-lived expiry and preserves session metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-11T10:00:00.000Z').getTime());

    const session = await adminSessionService.createSession({
      adminId: 'admin-1',
      sessionType: 'jit',
      requestedCapability: 'billing_ops',
      justification: 'Investigate billing anomaly',
      expiresInHours: 12,
      mfaVerified: true,
    });

    const insertArgs = fakeDb.run.mock.calls[0][1];
    expect(insertArgs[4]).toBe('2026-04-11T12:00:00.000Z');
    expect(session).toEqual(
      expect.objectContaining({
        sessionType: 'jit',
        requestedCapability: 'billing_ops',
        justification: 'Investigate billing anomaly',
      })
    );
    vi.restoreAllMocks();
  });

  it('returns JIT and break-glass counts from extended stats query', async () => {
    fakeDb.get.mockResolvedValueOnce({
      total: 6,
      active: 4,
      mfaVerified: 3,
      jitActive: 2,
      breakGlassActive: 1,
      uniqueAdmins: 2,
    });

    const stats = await adminSessionService.getSessionStats();
    expect(stats).toEqual(
      expect.objectContaining({
        total: 6,
        active: 4,
        mfaVerified: 3,
        jitActive: 2,
        breakGlassActive: 1,
        uniqueAdmins: 2,
      })
    );
  });
});
