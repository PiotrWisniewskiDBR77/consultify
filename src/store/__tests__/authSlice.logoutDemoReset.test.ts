import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthSlice } from '../slices/authSlice';

describe('auth logout demo isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('clears live demo workspace state before the next account logs in', () => {
    let logoutPatch: Record<string, unknown> = {};
    const set = (patch: Record<string, unknown>) => {
      logoutPatch = { ...logoutPatch, ...patch };
    };
    const slice = createAuthSlice(set as never, (() => ({})) as never, {} as never);

    slice.logout({ reload: false });

    expect(logoutPatch).toMatchObject({
      isDemoMode: false,
      demoSessionOrgId: null,
      demoExperienceType: null,
      demoLocale: null,
      demoOrganization: null,
      demoStats: null,
      demoHints: [],
      isDemoLoading: false,
      demoError: null,
      activeTour: null,
      availableTours: [],
    });
  });
});
