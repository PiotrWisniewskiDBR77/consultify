/**
 * DEC-91 / TRI-MUST-12 — a suspended organization cannot mint new sessions.
 *
 * `AuthController.login` already branched on `pending` and `blocked`, but
 * `suspended` fell straight through: Day-15 acceptance (DEC-85) confirmed the
 * suspension was written and audited while login carried on working. These
 * cases pin the missing branch, with two negative controls (active tenant,
 * SUPERADMIN) proving the refusal comes from the status and not the harness.
 */

import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { login, setDependencies } from '../AuthController.js';

const mockDb = { get: vi.fn(), run: vi.fn() };
const mockBcrypt = { compareSync: vi.fn() };
const mockActivityService = { log: vi.fn() };
const mockMFAService = {
  getMFAStatus: vi.fn(),
  isDeviceTrusted: vi.fn(),
  verifyTOTP: vi.fn(),
  trustDevice: vi.fn(),
};
const mockRefreshTokenService = { generateTokenPair: vi.fn() };
const mockRedisStore = vi
  .fn()
  .mockImplementation(() => ({ resetKey: vi.fn().mockResolvedValue(undefined) }));

/** Wire the db double to one tenant status + one user role. */
const seedDb = (orgStatus: string, userRole: string) => {
  mockDb.get.mockImplementation((sql: string, _params: unknown[], cb: Function) => {
    if (sql.includes('FROM organization_members')) return cb(null, { role: userRole });
    if (sql.includes('FROM users')) {
      return cb(null, {
        id: 'u1',
        role: userRole,
        password: 'hashed',
        organization_id: 'o1',
        email: 'member@example.com',
        status: 'active',
        first_name: 'Member',
        last_name: 'One',
      });
    }
    if (sql.includes('FROM organizations')) {
      return cb(null, { id: 'o1', status: orgStatus, plan: 'pro', name: 'Acme' });
    }
    return cb(null, null);
  });
};

describe('DEC-91 login refuses a suspended organization', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let statusFn: ReturnType<typeof vi.fn>;
  let sendFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    req = {
      body: { email: 'member@example.com', password: 'correct' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('TestAgent'),
    } as Partial<Request>;

    jsonFn = vi.fn().mockReturnThis();
    statusFn = vi.fn().mockReturnThis();
    sendFn = vi.fn().mockReturnThis();
    res = {
      status: statusFn,
      json: jsonFn,
      send: sendFn,
      cookie: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    } as unknown as Partial<Response>;

    mockBcrypt.compareSync.mockReturnValue(true);
    mockMFAService.getMFAStatus.mockResolvedValue({ enabled: false });
    mockRefreshTokenService.generateTokenPair.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
    });
    mockDb.run.mockImplementation((_sql: string, _params: unknown[], cb: Function) => cb?.(null));

    await setDependencies({
      db: mockDb as never,
      bcrypt: mockBcrypt,
      ActivityService: mockActivityService,
      MFAService: mockMFAService as never,
      RefreshTokenService: mockRefreshTokenService as never,
      RedisStore: mockRedisStore as never,
    });
  });

  it('returns 403 with the ORG_SUSPENDED code for a member of a suspended tenant', async () => {
    seedDb('suspended', 'USER');

    await login(req as Request, res as Response);

    expect(statusFn).toHaveBeenCalledWith(403);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ORG_SUSPENDED',
        messageKey: 'errors.organizationSuspended',
      })
    );
    expect(mockRefreshTokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('does not leak a human sentence as the only signal — the code is machine-readable', async () => {
    seedDb('suspended', 'USER');

    await login(req as Request, res as Response);

    const body = jsonFn.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(body.code).toBe('ORG_SUSPENDED');
    expect(typeof body.error).toBe('string');
  });

  it('NEGATIVE CONTROL: the same login succeeds for an ACTIVE tenant', async () => {
    seedDb('active', 'USER');

    await login(req as Request, res as Response);

    expect(statusFn).not.toHaveBeenCalledWith(403);
    expect(mockRefreshTokenService.generateTokenPair).toHaveBeenCalled();
  });

  it('NEGATIVE CONTROL: a SUPERADMIN can still log in to a suspended tenant to fix it', async () => {
    seedDb('suspended', 'SUPERADMIN');

    await login(req as Request, res as Response);

    expect(statusFn).not.toHaveBeenCalledWith(403);
    expect(mockRefreshTokenService.generateTokenPair).toHaveBeenCalled();
  });
});
