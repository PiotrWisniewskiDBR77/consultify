/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const { appState, useAppStoreMock } = vi.hoisted(() => {
  const nextAppState = {
    currentUser: {
      id: 'sa-1',
      role: 'SUPERADMIN',
      isAuthenticated: true,
    },
    isDemoMode: false,
  };

  return {
    appState: nextAppState,
    useAppStoreMock: Object.assign(
      (selector?: (state: typeof nextAppState) => unknown) =>
        typeof selector === 'function' ? selector(nextAppState) : nextAppState,
      {
        getState: () => nextAppState,
      }
    ),
  };
});

vi.mock('@/store/useAppStore', () => ({
  useAppStore: useAppStoreMock,
}));

import { AccessPolicyProvider, usePolicySnapshot } from '@/contexts/AccessPolicyContext';
import { TrialProvider, useTrial } from '@/contexts/TrialContext';

const AccessPolicyProbe: React.FC = () => {
  const { snapshot, loading } = usePolicySnapshot();
  return (
    <div>
      <div data-testid="policy-loading">{String(loading)}</div>
      <div data-testid="policy-snapshot">{snapshot ? 'present' : 'none'}</div>
    </div>
  );
};

const TrialProbe: React.FC = () => {
  const { loading, isTrial } = useTrial();
  return (
    <div>
      <div data-testid="trial-loading">{String(loading)}</div>
      <div data-testid="trial-flag">{String(isTrial)}</div>
    </div>
  );
};

describe('policy contexts bypass superadmin policy fetches', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'superadmin-token');
    localStorage.setItem(
      'consultify-storage',
      JSON.stringify({
        state: {
          currentUser: { token: 'superadmin-token' },
        },
      })
    );
  });

  it('does not fetch access policy snapshots for superadmin users', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AccessPolicyProvider>
        <AccessPolicyProbe />
      </AccessPolicyProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('policy-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('policy-snapshot')).toHaveTextContent('none');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch trial policy snapshots for superadmin users', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AccessPolicyProvider>
        <TrialProvider>
          <TrialProbe />
        </TrialProvider>
      </AccessPolicyProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('trial-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('trial-flag')).toHaveTextContent('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
