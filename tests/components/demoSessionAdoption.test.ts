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

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      setDemoMode: setDemoModeMock,
      setDemoSessionOrgId: setDemoSessionOrgIdMock,
    }),
  },
}));

import { adoptDemoSession } from '../../src/services/demoSessionAdoption';

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
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('clears the org id when the payload is %s, and still enables demo mode', (_label, payload) => {
    adoptDemoSession(payload as null | undefined);

    expect(setDemoModeMock).toHaveBeenCalledWith(true);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith(null);
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
