/**
 * OPS-DEMO-002 — unit contract of the shared demo-session adoption helper.
 *
 * Both public entries (`DemoModeModal`, `AuthView`) funnel through this, so the
 * two behaviours that matter are pinned here once: demo mode always goes on, and
 * a missing session CLEARS the org id rather than leaving whatever was pinned
 * before (a stale tenant would keep being sent as `X-Demo-Session-Org`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDemoModeMock = vi.fn();
const setDemoSessionOrgIdMock = vi.fn();
const setCurrentOrganizationMock = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      setDemoMode: setDemoModeMock,
      setDemoSessionOrgId: setDemoSessionOrgIdMock,
      setCurrentOrganization: setCurrentOrganizationMock,
    }),
  },
}));

import {
  adoptDemoSession,
  bindUserToDemoSession,
  reconcileDemoAuthProfile,
} from '../../src/services/demoSessionAdoption';

describe('adoptDemoSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pins the session organization and turns demo mode on', () => {
    adoptDemoSession({
      id: 's-1',
      organizationId: 'demo-org-session-unit-1',
      locale: 'pl',
      expiresAt: '2026-08-02T00:00:00.000Z',
      anchorDate: '2026-08-01T00:00:00.000Z',
    });

    expect(setDemoModeMock).toHaveBeenCalledWith(true);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-unit-1');
    expect(setCurrentOrganizationMock).toHaveBeenCalledWith({
      id: 'demo-org-session-unit-1',
      name: 'Demo workspace',
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('clears the org id when the payload is %s, and still enables demo mode', (_label, payload) => {
    adoptDemoSession(payload as null | undefined);

    expect(setDemoModeMock).toHaveBeenCalledWith(true);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith(null);
    expect(setCurrentOrganizationMock).toHaveBeenCalledWith(null);
  });

  it('writes demo mode before the org id, so no request can observe a half state', () => {
    const order: string[] = [];
    setDemoModeMock.mockImplementation(() => order.push('demoMode'));
    setDemoSessionOrgIdMock.mockImplementation(() => order.push('orgId'));

    adoptDemoSession({
      id: 's-2',
      organizationId: 'demo-org-session-unit-2',
      locale: 'en',
      expiresAt: '2026-08-02T00:00:00.000Z',
      anchorDate: '2026-08-01T00:00:00.000Z',
    });

    expect(order).toEqual(['demoMode', 'orgId']);
  });
});

const baseUser = {
  id: 'user-1',
  email: 'demo@example.com',
  firstName: 'Demo',
  lastName: 'User',
  status: 'active',
  role: 'USER',
  accessLevel: 'full',
  isAuthenticated: true,
  isEmailVerified: true,
} as const;

const session = {
  id: 'session-1',
  organizationId: 'demo-org-session-unit-1',
  locale: 'en' as const,
  expiresAt: '2026-08-02T00:00:00.000Z',
  anchorDate: '2026-08-01T00:00:00.000Z',
};

describe('demo user context', () => {
  it('binds the authenticated user to the isolated demo organization', () => {
    expect(bindUserToDemoSession(baseUser, session)).toMatchObject({
      organizationId: session.organizationId,
      organizationName: 'Demo workspace',
      isDemo: true,
    });
  });

  it('preserves the demo role only for the same restored demo principal', () => {
    const restored = { ...baseUser, role: 'ADMIN' as const, isDemo: true };
    expect(reconcileDemoAuthProfile(baseUser, restored, session.organizationId)).toMatchObject({
      role: 'ADMIN',
      organizationId: session.organizationId,
      isDemo: true,
    });
  });

  it('does not inherit a stale role from another or non-demo user', () => {
    const stale = { ...baseUser, id: 'other-user', role: 'ADMIN' as const, isDemo: true };
    expect(reconcileDemoAuthProfile(baseUser, stale, session.organizationId).role).toBe('USER');
    expect(
      reconcileDemoAuthProfile(
        baseUser,
        { ...baseUser, role: 'ADMIN' as const },
        session.organizationId
      ).role
    ).toBe('USER');
  });
});
