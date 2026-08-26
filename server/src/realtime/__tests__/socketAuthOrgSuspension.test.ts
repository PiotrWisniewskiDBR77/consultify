/**
 * DEC-91 / TRI-MUST-12 — organization suspension reaches the realtime channel.
 *
 * ===========================================================================
 * WHY THIS IS A SEPARATE FRONT DOOR
 * ===========================================================================
 * `socketAuth` runs its own `jwt.verify` and never reaches `attachUser`, so the
 * HTTP enforcement does not cover it. Before this, a member of a suspended
 * tenant was refused every REST call and still held a live activity
 * sidechannel: which chats are in flight, when admins rebuild context, etc.
 *
 * Three gates are pinned here, all through the SAME guard and cache:
 *   1. handshake        — a suspended tenant cannot open a new socket;
 *   2. `validateJoinOrg` — a suspended tenant's room cannot be joined, even by
 *                          a multi-org user whose own seat is elsewhere;
 *   3. the sweep        — a tenant suspended DURING an open session has its
 *                          sockets closed, without a second registry or timer.
 *
 * ===========================================================================
 * THE TWO ERROR SHAPES ARE DELIBERATE, AND BOTH ARE ASSERTED
 * ===========================================================================
 * The handshake NAMES the reason (`ORG_SUSPENDED`), because the tenant is the
 * caller's own — derived from their verified token or their own `users` row —
 * so nothing about any other tenant leaks. `validateJoinOrg` stays SILENT,
 * because there the org id is client-supplied and a distinct answer would let a
 * stranger enumerate which tenants exist and which are suspended. Getting this
 * backwards is a real regression, so both are asserted rather than assumed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

/** Users table, for the token-has-no-org fallback path. */
const USER_ORG: Record<string, string> = {
  'user-no-token-org': 'org-suspended',
};

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params?: unknown[]) => {
    const text = String(sql);
    const first = String((params || [])[0] ?? '');
    if (text.includes('FROM organizations')) {
      const status = ORG_STATUS[first];
      return status ? { status } : undefined;
    }
    if (text.includes('FROM users')) {
      const org = USER_ORG[first];
      return org ? { organization_id: org } : undefined;
    }
    if (text.includes('organization_members')) {
      // Membership is never the reason a case below fails: every principal is
      // a member of every org it asks about.
      return { user_id: first };
    }
    return undefined;
  }),
  run: vi.fn(async () => undefined),
  all: vi.fn(async () => []),
}));

/** The demo gate always allows, so refusals here are attributable to DEC-91. */
vi.mock('../demoRealtimeGuard.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    evaluateRealtimeAccess: vi.fn(async () => ({ allowed: true })),
  };
});

const jwtVerifyImpl = vi.fn();
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: (token: string, secret: string, cb: (e: unknown, d: unknown) => void) =>
      jwtVerifyImpl(token, secret, cb),
  },
}));

const { socketAuthMiddleware, validateJoinOrg } = await import('../socketAuth.js');
const { __testing__ } = await import('../../services/organizationSuspensionGuard.js');
const { sweepRealtimeConnections, trackRealtimeConnection, __resetRealtimeTracking } = await import(
  '../demoRealtimeGuard.js'
);

const ORIGINAL_SECRET = process.env.JWT_SECRET;

interface HandshakeResult {
  error: (Error & { data?: Record<string, unknown> }) | undefined;
  connected: boolean;
  trackedOrg: string | undefined;
}

const connect = async (claims: Record<string, unknown>): Promise<HandshakeResult> => {
  jwtVerifyImpl.mockImplementation((_t: string, _s: string, cb: Function) => cb(null, claims));

  const socket = {
    handshake: { auth: { token: 'a.b.c' }, headers: {}, query: {} },
    data: {} as Record<string, unknown>,
    on: vi.fn(),
    disconnect: vi.fn(),
  };

  let error: (Error & { data?: Record<string, unknown> }) | undefined;
  let called = false;
  await new Promise<void>((resolve) => {
    socketAuthMiddleware(socket as never, (err?: Error) => {
      error = err as HandshakeResult['error'];
      called = true;
      resolve();
    });
    // The middleware resolves through two chained promises; give them a turn.
    setTimeout(resolve, 250);
  });

  return {
    error,
    connected: called && !error,
    trackedOrg: (socket.data.user as { organizationId?: string } | undefined)?.organizationId,
  };
};

describe('DEC-91 organization suspension on realtime sockets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testing__.reset();
    __resetRealtimeTracking();
    process.env.JWT_SECRET = 'a'.repeat(48);
  });

  afterEach(() => {
    __testing__.reset();
    __resetRealtimeTracking();
    if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_SECRET;
  });

  describe('handshake', () => {
    it('refuses a socket from a member of a SUSPENDED tenant', async () => {
      const result = await connect({ id: 'user-1', organizationId: 'org-suspended' });

      expect(result.connected).toBe(false);
      expect(result.error?.message).toBe('ORG_SUSPENDED');
    });

    it('names the reason with the same body the HTTP paths return', async () => {
      const { buildOrgSuspendedResponseBody } = await import(
        '../../services/organizationSuspensionGuard.js'
      );
      const result = await connect({ id: 'user-1', organizationId: 'org-suspended' });

      expect(result.error?.data).toEqual(buildOrgSuspendedResponseBody());
    });

    it('NEGATIVE CONTROL: a member of an ACTIVE tenant connects normally', async () => {
      const result = await connect({ id: 'user-2', organizationId: 'org-active' });

      expect(result.connected).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('resolves the tenant from the users row when the token carries no org', async () => {
      // The token claim is absent, so the org must come from the database —
      // otherwise a token minted without an org claim would bypass the gate.
      const result = await connect({ id: 'user-no-token-org' });

      expect(result.connected).toBe(false);
      expect(result.error?.message).toBe('ORG_SUSPENDED');
    });
  });

  describe('validateJoinOrg', () => {
    const socketFor = (userOrg: string) =>
      ({ data: { user: { id: 'user-1', organizationId: userOrg } } }) as never;

    it('refuses joining a SUSPENDED tenant room', async () => {
      await expect(validateJoinOrg(socketFor('org-active'), 'org-suspended')).resolves.toBe(false);
    });

    it('refuses even when the suspended org is the user own seat', async () => {
      await expect(validateJoinOrg(socketFor('org-suspended'), 'org-suspended')).resolves.toBe(
        false
      );
    });

    it('NEGATIVE CONTROL: joining an ACTIVE tenant room still works', async () => {
      await expect(validateJoinOrg(socketFor('org-active'), 'org-active')).resolves.toBe(true);
    });

    it('stays SILENT — the refusal is a bare false, with no reason to probe', async () => {
      // The contract here is the return type itself: a boolean, never a thrown
      // error or a distinguishable code. An org id is client-supplied on this
      // path, so a distinct answer would leak which tenants are suspended.
      const refused = await validateJoinOrg(socketFor('org-active'), 'org-suspended');
      const missing = await validateJoinOrg(socketFor('org-active'), 'org-does-not-exist');

      expect(refused).toBe(false);
      // Indistinguishable from a tenant that simply is not joinable.
      expect(typeof refused).toBe(typeof missing);
    });
  });

  describe('sweep — connections already open when the suspension lands', () => {
    it('closes a tracked socket once its tenant is suspended', async () => {
      const close = vi.fn();
      trackRealtimeConnection('user-1', close, 'org-active');

      // Nothing to do while the tenant is healthy.
      expect(await sweepRealtimeConnections()).toBe(0);
      expect(close).not.toHaveBeenCalled();

      ORG_STATUS['org-active'] = 'suspended';
      __testing__.reset(); // the status writers invalidate; simulate that here

      expect(await sweepRealtimeConnections()).toBe(1);
      expect(close).toHaveBeenCalledTimes(1);

      ORG_STATUS['org-active'] = 'active';
    });

    it('leaves other tenants connected — the sweep is not a kill switch', async () => {
      const closeSuspended = vi.fn();
      const closeHealthy = vi.fn();
      trackRealtimeConnection('user-1', closeSuspended, 'org-suspended');
      trackRealtimeConnection('user-2', closeHealthy, 'org-active');

      expect(await sweepRealtimeConnections()).toBe(1);
      expect(closeSuspended).toHaveBeenCalledTimes(1);
      expect(closeHealthy).not.toHaveBeenCalled();
    });

    it('ignores connections registered without an org — pre-existing callers are unaffected', async () => {
      const close = vi.fn();
      // This is the old two-argument call shape, still valid.
      trackRealtimeConnection('user-1', close);

      expect(await sweepRealtimeConnections()).toBe(0);
      expect(close).not.toHaveBeenCalled();
    });
  });
});
