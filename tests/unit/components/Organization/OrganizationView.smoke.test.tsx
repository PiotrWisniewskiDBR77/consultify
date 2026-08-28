import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the store; tests override currentOrganization per-case.
const storeState: { currentOrganization: { id: string; name: string } | null } = {
  currentOrganization: { id: 'org-1', name: 'Atelier Toys' },
};
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: storeState.currentOrganization,
    currentUser: { id: 'u-admin', role: 'admin', isAuthenticated: true },
    setCurrentView: vi.fn(),
  }),
}));

const locationState = { pathname: '/organization/profile' };
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="route-redirect">{to}</div>,
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/utils/orgRedesignFlag', () => ({ isOrgRedesignV1Enabled: () => false }));

// Stub heavy child surfaces — the smoke test only asserts the shell + routing wiring.
vi.mock('@/components/Organization/KnowledgeGraphExplorer', () => ({
  KnowledgeGraphExplorer: () => <div data-testid="kg-explorer" />,
}));
vi.mock('@/components/Organization/OrganizationAdminPanel', () => ({
  OrganizationAdminPanel: ({ section }: { section: string }) => (
    <div data-testid="admin-panel">{section}</div>
  ),
}));
vi.mock('@/components/Organization/OrganizationSidebar', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/components/Organization/OrganizationSidebar')
  >();
  return {
    ...actual,
    default: () => <nav data-testid="org-sidebar" />,
  };
});
vi.mock('@/components/Organization/OrgContextSummaryBanner', () => ({
  OrgContextSummaryBanner: () => <div data-testid="context-banner" />,
}));
vi.mock('@/components/settings/OrganizationContextOverview', () => ({
  OrganizationContextOverview: () => <div data-testid="context-overview" />,
}));
vi.mock('@/views/ContextBuilder/modules/ChallengeMapModule', () => ({
  ChallengeMapModule: () => <div data-testid="challenges-module" />,
}));
vi.mock('@/views/ContextBuilder/modules/GoalsExpectationsModule', () => ({
  GoalsExpectationsModule: () => <div data-testid="goals-module" />,
}));
vi.mock('@/views/ContextBuilder/modules/OrganizationProfileModule', () => ({
  OrganizationProfileModule: () => <div data-testid="profile-module" />,
}));
vi.mock('@/views/ContextBuilder/modules/StrategicSynthesisModule', () => ({
  StrategicSynthesisModule: () => <div data-testid="strategy-module" />,
}));

import { OrganizationView } from '@/views/OrganizationView';

describe('OrganizationView (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.currentOrganization = { id: 'org-1', name: 'Atelier Toys' };
    locationState.pathname = '/organization/profile';
  });

  const sectionCases: Array<[string, string]> = [
    ['/organization/profile', 'profile-module'],
    ['/organization/goals', 'goals-module'],
    ['/organization/challenges', 'challenges-module'],
    ['/organization/strategy', 'strategy-module'],
    ['/organization/knowledge-graph', 'kg-explorer'],
  ];

  it.each(sectionCases)('renders %s without crashing', async (path, testId) => {
    locationState.pathname = path;
    render(<OrganizationView />);
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('always renders the live context summary banner', async () => {
    render(<OrganizationView />);
    expect(await screen.findByTestId('context-banner')).toBeInTheDocument();
  });

  it.each([
    ['/organization/members', '/admin/people'],
    ['/organization/limits', '/admin/billing'],
  ])('hands legacy admin route %s to the canonical admin surface', async (path, target) => {
    locationState.pathname = path;
    render(<OrganizationView />);
    await screen.findByTestId('profile-module');
    expect(navigateMock).toHaveBeenCalledWith(target, { replace: true });
  });

  it('renders the sidebar shell', () => {
    render(<OrganizationView />);
    expect(screen.getAllByTestId('org-sidebar').length).toBeGreaterThan(0);
  });

  it('hides the detailed context overview when no organization is selected', () => {
    storeState.currentOrganization = null;
    render(<OrganizationView />);
    expect(screen.queryByTestId('context-overview')).not.toBeInTheDocument();
  });
});
