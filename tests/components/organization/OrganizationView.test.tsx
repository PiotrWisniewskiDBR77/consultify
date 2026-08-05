import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  locationState: { pathname: '/organization/profile' },
  setCurrentViewMock: vi.fn(),
  trackFunnelEventMock: vi.fn(),
  currentOrganization: { id: 'org-1' },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: any, arg2?: any, arg3?: any) => {
      if (typeof arg2 === 'string') {
        if (arg3 && typeof arg3 === 'object') {
          return arg2.replaceAll('{{label}}', String((arg3 as any).label ?? ''));
        }
        return arg2;
      }
      return String(key);
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="route-redirect" data-to={to} data-replace={String(Boolean(replace))} />
  ),
  useNavigate: () => h.navigateMock,
  useLocation: () => h.locationState,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView: h.setCurrentViewMock,
    currentOrganization: h.currentOrganization,
    currentUser: { id: 'u-1', role: 'admin', isAuthenticated: true },
  }),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: any[]) => h.trackFunnelEventMock(...args),
}));

vi.mock('../../../src/components/Organization/OrganizationSidebar', () => ({
  default: ({
    activeSection,
    onSectionChange,
    onBack,
  }: {
    activeSection: string;
    onSectionChange: (s: any) => void;
    onBack: () => void;
  }) => (
    <div>
      <div data-testid="active-section">{activeSection}</div>
      <button type="button" onClick={() => onSectionChange('goals')}>
        Goals
      </button>
      <button type="button" onClick={() => onSectionChange('members')}>
        Members
      </button>
      <button type="button" onClick={onBack}>
        Back to Dashboard
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/Organization/OrganizationAdminPanel', () => ({
  OrganizationAdminPanel: ({ section }: { section: string }) => (
    <div data-testid="admin-panel">{section}</div>
  ),
}));

vi.mock('../../../src/components/settings/OrganizationContextOverview', () => ({
  OrganizationContextOverview: ({
    organizationId,
    canRebuild,
  }: {
    organizationId: string;
    canRebuild?: boolean;
  }) => (
    <div data-testid="organization-context-overview">
      {organizationId}:{canRebuild ? 'rebuild' : 'readonly'}
    </div>
  ),
}));

vi.mock('../../../src/components/Organization/KnowledgeGraphExplorer', () => ({
  KnowledgeGraphExplorer: () => <div data-testid="module-knowledge-graph" />,
}));

// M16 P0-2: V8 canon panel replaced by the live context summary banner.
vi.mock('../../../src/components/Organization/OrgContextSummaryBanner', () => ({
  OrgContextSummaryBanner: ({
    organizationId,
    isAdmin,
  }: {
    organizationId?: string;
    isAdmin?: boolean;
  }) => (
    <div data-testid="org-context-summary-banner">
      {organizationId}:{isAdmin ? 'admin' : 'member'}
    </div>
  ),
}));

vi.mock('../../../src/views/ContextBuilder/modules/CompanyProfileModule', () => ({
  CompanyProfileModule: () => <div data-testid="module-profile" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/OrganizationProfileModule', () => ({
  OrganizationProfileModule: () => <div data-testid="module-profile" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/GoalsExpectationsModule', () => ({
  GoalsExpectationsModule: () => <div data-testid="module-goals" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/ChallengeMapModule', () => ({
  ChallengeMapModule: () => <div data-testid="module-challenges" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/StrategicSynthesisModule', () => ({
  StrategicSynthesisModule: () => <div data-testid="module-strategy" />,
}));

async function loadDeps() {
  const [{ OrganizationView }, { ROUTES }, { AppView }] = await Promise.all([
    import('../../../src/views/OrganizationView'),
    import('../../../src/routes/routeConfig'),
    import('../../../src/types'),
  ]);
  return { OrganizationView, ROUTES, AppView };
}

describe('OrganizationView (L2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.locationState.pathname = '/organization/profile';
  });

  it('renders profile module by default and resolves active section from pathname', async () => {
    const { OrganizationView } = await loadDeps();
    render(<OrganizationView />);
    expect(screen.getByTestId('org-context-summary-banner')).toHaveTextContent('org-1:member');
    expect(screen.queryByTestId('organization-context-overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-profile')).toBeInTheDocument();
    expect(screen.getAllByTestId('active-section')[0]).toHaveTextContent('profile');
  });

  it('falls back to profile for unknown section', async () => {
    const { OrganizationView } = await loadDeps();
    h.locationState.pathname = '/organization/unknown';
    render(<OrganizationView />);
    expect(screen.getAllByTestId('active-section')[0]).toHaveTextContent('profile');
    expect(screen.getByTestId('module-profile')).toBeInTheDocument();
  });

  it('renders correct modules for goals/challenges/strategy', async () => {
    const { OrganizationView } = await loadDeps();
    h.locationState.pathname = '/organization/goals';
    const { rerender } = render(<OrganizationView />);
    expect(screen.getByTestId('module-goals')).toBeInTheDocument();

    h.locationState.pathname = '/organization/challenges';
    rerender(<OrganizationView />);
    expect(screen.getByTestId('module-challenges')).toBeInTheDocument();

    h.locationState.pathname = '/organization/strategy';
    rerender(<OrganizationView />);
    expect(screen.getByTestId('module-strategy')).toBeInTheDocument();
  });

  it('hands admin sections off to the canonical Admin route without mounting the legacy panel', async () => {
    const { OrganizationView, ROUTES } = await loadDeps();
    h.locationState.pathname = '/organization/members';
    render(<OrganizationView />);
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('route-redirect')).toHaveAttribute('data-to', ROUTES.ADMIN.PEOPLE);
    expect(screen.getByTestId('route-redirect')).toHaveAttribute('data-replace', 'true');
    await waitFor(() =>
      expect(h.navigateMock).toHaveBeenCalledWith(ROUTES.ADMIN.PEOPLE, { replace: true })
    );
    expect(screen.queryByTestId('organization-context-overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('org-context-summary-banner')).toHaveTextContent('org-1:admin');
  });

  it('redirects megatrends route to Discovery Tools canonical route', async () => {
    const { OrganizationView, ROUTES } = await loadDeps();
    h.locationState.pathname = '/organization/megatrends';
    render(<OrganizationView />);

    await waitFor(() =>
      expect(h.navigateMock).toHaveBeenCalledWith(ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS, {
        replace: true,
      })
    );
    expect(h.trackFunnelEventMock).toHaveBeenCalledWith('megatrends_redirect_used', {
      fromRoute: '/organization/megatrends',
    });
  });

  it('navigates to another section when sidebar triggers onSectionChange and tracks funnel', async () => {
    const { OrganizationView, ROUTES } = await loadDeps();
    render(<OrganizationView />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Goals$/i })[0]);

    expect(h.navigateMock).toHaveBeenCalledWith(`${ROUTES.ORGANIZATION.ROOT}/goals`);
    expect(h.trackFunnelEventMock).toHaveBeenCalledWith('org_workspace_opened', {
      section: 'goals',
    });
  });

  it('back button navigates to chat and sets current view', async () => {
    const { OrganizationView, ROUTES, AppView } = await loadDeps();
    render(<OrganizationView />);
    fireEvent.click(screen.getAllByRole('button', { name: /Back to Dashboard/i })[0]);

    expect(h.setCurrentViewMock).toHaveBeenCalledWith(AppView.AI_CHAT);
    expect(h.navigateMock).toHaveBeenCalledWith(ROUTES.AI_CHAT);
  });

  it('mobile menu open/close toggles overlay and close button', async () => {
    const { OrganizationView } = await loadDeps();
    render(<OrganizationView />);

    expect(screen.queryByLabelText(/close organization navigation/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/open navigation/i));
    expect(screen.getByLabelText(/close organization navigation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/close navigation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/close navigation/i));
    expect(screen.queryByLabelText(/close organization navigation/i)).not.toBeInTheDocument();

    // Re-open and close via overlay
    fireEvent.click(screen.getByLabelText(/open navigation/i));
    fireEvent.click(screen.getByLabelText(/close organization navigation/i));
    expect(screen.queryByLabelText(/close organization navigation/i)).not.toBeInTheDocument();
  });
});
