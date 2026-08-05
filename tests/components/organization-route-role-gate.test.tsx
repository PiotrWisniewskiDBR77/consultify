/**
 * @vitest-environment jsdom
 *
 * M23 L-04 (P1 security): /organization/* mounts with requireAuth only (no
 * requiredRole). Admin sections (members / billing / branding / limits / domains /
 * competencies) must NOT render OrganizationAdminPanel for a non-admin member, even
 * on a deep-link. This locks in the view-level role gate in OrganizationView.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

// --- Mocked store (object-destructure form: useAppStore() returns the whole state)
const state: {
  currentUser: { id: string; role: string; isAuthenticated: boolean } | null;
  currentOrganization: { id: string } | null;
  setCurrentView: ReturnType<typeof vi.fn>;
} = {
  currentUser: null,
  currentOrganization: { id: 'org-1' },
  setCurrentView: vi.fn(),
};

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => state,
}));

// i18n: identity translator returning the provided fallback (2nd arg) or the key.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// org context sync hook — no-op
vi.mock('../../src/hooks/useOrgContextSync', () => ({
  useOrgContextSync: () => undefined,
}));

vi.mock('../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

// Admin panel is the protected surface — render a sentinel so we can assert on it.
vi.mock('../../src/components/Organization/OrganizationAdminPanel', () => ({
  OrganizationAdminPanel: ({ section }: { section: string }) => (
    <div data-testid="admin-panel">admin-panel:{section}</div>
  ),
}));

// Sidebar + banner + member context modules — lightweight stubs.
vi.mock('../../src/components/Organization/OrganizationSidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="org-sidebar" />,
}));
vi.mock('../../src/components/Organization/OrgContextSummaryBanner', () => ({
  OrgContextSummaryBanner: () => <div data-testid="org-banner" />,
}));
vi.mock('../../src/components/Organization/KnowledgeGraphExplorer', () => ({
  KnowledgeGraphExplorer: () => <div data-testid="knowledge-graph" />,
}));
vi.mock('../../src/views/ContextBuilder/modules/ChallengeMapModule', () => ({
  ChallengeMapModule: () => <div data-testid="challenges" />,
}));
vi.mock('../../src/views/ContextBuilder/modules/GoalsExpectationsModule', () => ({
  GoalsExpectationsModule: () => <div data-testid="goals" />,
}));
vi.mock('../../src/views/ContextBuilder/modules/OrganizationProfileModule', () => ({
  OrganizationProfileModule: () => <div data-testid="profile" />,
}));
vi.mock('../../src/views/ContextBuilder/modules/StrategicSynthesisModule', () => ({
  StrategicSynthesisModule: () => <div data-testid="strategy" />,
}));

import { OrganizationView } from '../../src/views/OrganizationView';
import { ROUTES } from '../../src/routes/routeConfig';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrganizationView />
      <LocationProbe />
    </MemoryRouter>
  );

describe('OrganizationView route-level role gate (M23 L-04)', () => {
  beforeEach(() => {
    state.currentUser = null;
    state.currentOrganization = { id: 'org-1' };
  });

  it('does NOT render the admin panel for a MEMBER deep-linking an admin section', () => {
    state.currentUser = { id: 'u-member', role: 'MEMBER', isAuthenticated: true };
    renderAt('/organization/members');

    // The protected admin surface must never mount for a non-admin.
    expect(screen.queryByTestId('admin-panel')).toBeNull();
  });

  it.each(['members', 'billing', 'branding', 'limits', 'domains', 'competencies'])(
    'blocks admin section "%s" for a MEMBER',
    (section) => {
      state.currentUser = { id: 'u-member', role: 'MEMBER', isAuthenticated: true };
      renderAt(`/organization/${section}`);
      expect(screen.queryByTestId('admin-panel')).toBeNull();
    }
  );

  it('hands an ADMIN deep-link off to the canonical Admin route without mounting the legacy panel', async () => {
    state.currentUser = { id: 'u-admin', role: 'ADMIN', isAuthenticated: true };
    renderAt('/organization/members');

    expect(screen.queryByTestId('admin-panel')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('current-location')).toHaveTextContent(ROUTES.ADMIN.PEOPLE)
    );
  });

  it('keeps a non-admin section (profile) accessible to a MEMBER', () => {
    state.currentUser = { id: 'u-member', role: 'MEMBER', isAuthenticated: true };
    renderAt('/organization/profile');

    expect(screen.getByTestId('profile')).toBeTruthy();
    expect(screen.queryByTestId('admin-panel')).toBeNull();
  });
});
