/**
 * @vitest-environment jsdom
 *
 * D-99 / W1 (DEC-573): this is the missing executable guard for the REAL
 * `AppRoutes` wiring. The older `executionRetiredDeepLinkRedirect.test.tsx`
 * exercises a local mirror of `ExecutionRetiredTabGate` and `RolloutLegacyRedirect`,
 * so mutations in `src/routes/AppRoutes.tsx` could stay green there. This file
 * mounts the real route table and stubs only the app shell plus the heavy
 * `ExecutionHub` leaf.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../routeConfig';

vi.mock('react-router-dom', async (importOriginal) => importOriginal());

const { storeState } = vi.hoisted(() => ({
  storeState: {
    currentView: 'EXECUTION',
    currentUser: {
      id: 'u-d99',
      email: 'admin@example.test',
      name: 'Admin',
      role: 'ADMIN',
      isAuthenticated: true,
    },
    currentOrganization: { id: 'org-d99', name: 'D99 Org', plan: 'professional' },
    currentProjectId: null,
    setCurrentView: vi.fn(),
    setCurrentUser: vi.fn(),
    setCurrentOrganization: vi.fn(),
    setCurrentProjectId: vi.fn(),
    setSessionMode: vi.fn(),
    setAuthInitialStep: vi.fn(),
    authInitialStep: 0,
    sessionMode: 'FREE',
    logout: vi.fn(),
    fullSessionData: null,
    setFullSessionData: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    setNavigateFn: vi.fn(),
    isAuthInitializing: false,
    setDemoMode: vi.fn(),
    resetDemoState: vi.fn(),
    language: 'en',
    isAuthenticated: true,
  } as Record<string, unknown>,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('@/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout-stub">{children}</div>
  ),
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout-stub">{children}</div>
  ),
}));

vi.mock('@/components/Execution/ExecutionHub', () => ({
  ExecutionHub: () => <div data-testid="real-app-routes-execution-hub" />,
  default: () => <div data-testid="real-app-routes-execution-hub" />,
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { AppRoutes } from '../AppRoutes';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <output data-testid="location-probe">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
};

function mountAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <AppRoutes />
    </MemoryRouter>
  );
}

const readLocation = () => screen.getByTestId('location-probe').textContent || '';

describe('D-99 — W1 retired Execution redirects on real AppRoutes', () => {
  beforeEach(() => {
    storeState.isAuthInitializing = false;
    vi.mocked(trackFunnelEvent).mockClear();
    storeState.currentUser = {
      id: 'u-d99',
      email: 'admin@example.test',
      name: 'Admin',
      role: 'ADMIN',
      isAuthenticated: true,
    };
  });

  it('real /execution route runs ExecutionRetiredTabGate and redirects retired tabs to list', async () => {
    mountAt(`${ROUTES.EXECUTION}?tab=rollout&view=kanban#row-1`);

    await waitFor(() =>
      expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=list&view=kanban#row-1`)
    );
    expect(await screen.findByTestId('real-app-routes-execution-hub')).toBeInTheDocument();
  });

  it('real /rollout route uses RedirectToCanonicalTab tab="list"', async () => {
    mountAt(`${ROUTES.ROLLOUT}?view=kanban#risk`);

    await waitFor(() =>
      expect(readLocation()).toBe(`${ROUTES.EXECUTION}?view=kanban&tab=list#risk`)
    );
    expect(await screen.findByTestId('real-app-routes-execution-hub')).toBeInTheDocument();
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      'route_redirected',
      expect.objectContaining({
        from: ROUTES.ROLLOUT,
        to: `${ROUTES.EXECUTION}?view=kanban&tab=list#risk`,
        reason: 'rollout_retired_to_execution_list',
      })
    );
  });
});
