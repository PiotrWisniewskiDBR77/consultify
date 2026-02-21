import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../../../src/routes/routeConfig';
import { AppView } from '../../../src/types';
import { OrganizationView } from '../../../src/views/OrganizationView';

const navigateMock = vi.fn();
const setCurrentViewMock = vi.fn();
const trackFunnelEventMock = vi.fn();

const locationState = { pathname: `${ROUTES.ORGANIZATION.ROOT}/profile` };

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView: setCurrentViewMock }),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: any[]) => trackFunnelEventMock(...args),
}));

vi.mock('../../../src/components/Organization/OrganizationSidebar', () => ({
  __esModule: true,
  default: ({
    activeSection,
    onSectionChange,
    onBack,
    className,
  }: {
    activeSection: string;
    onSectionChange: (s: any) => void;
    onBack: () => void;
    className?: string;
  }) => (
    <nav aria-label={className ? 'org-sidebar-mobile' : 'org-sidebar-desktop'}>
      <div>active:{activeSection}</div>
      <button type="button" onClick={() => onSectionChange('goals')}>
        Goals
      </button>
      <button type="button" onClick={() => onSectionChange('members')}>
        Members
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </nav>
  ),
}));

vi.mock('../../../src/components/Organization/OrganizationAdminPanel', () => ({
  OrganizationAdminPanel: ({ section }: { section: string }) => (
    <div aria-label="org-admin-panel">admin:{section}</div>
  ),
}));

vi.mock('../../../src/views/ContextBuilder/modules/CompanyProfileModule', () => ({
  CompanyProfileModule: () => <div aria-label="module-profile" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/GoalsExpectationsModule', () => ({
  GoalsExpectationsModule: () => <div aria-label="module-goals" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/ChallengeMapModule', () => ({
  ChallengeMapModule: () => <div aria-label="module-challenges" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/StrategicSynthesisModule', () => ({
  StrategicSynthesisModule: () => <div aria-label="module-strategy" />,
}));

describe('OrganizationView (L2)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setCurrentViewMock.mockReset();
    trackFunnelEventMock.mockReset();
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/profile`;
  });

  it('renders title/subtitle for profile by default', () => {
    render(<OrganizationView />);
    expect(screen.getByRole('heading', { name: 'Company Profile' })).toBeInTheDocument();
    expect(
      screen.getByText('Company snapshot, operating model, and key facts')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('module-profile')).toBeInTheDocument();
  });

  it('parses activeSection from pathname and forwards to OrganizationSidebar', () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/goals`;
    render(<OrganizationView />);
    expect(
      within(screen.getByLabelText('org-sidebar-desktop')).getByText('active:goals')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('module-goals')).toBeInTheDocument();
  });

  it('falls back to profile for unknown section', () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/does-not-exist`;
    render(<OrganizationView />);
    expect(
      within(screen.getByLabelText('org-sidebar-desktop')).getByText('active:profile')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('module-profile')).toBeInTheDocument();
  });

  it('renders Challenges module + meta for challenges route', () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/challenges`;
    render(<OrganizationView />);
    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument();
    expect(screen.getByText('Challenge map, evidence and root causes')).toBeInTheDocument();
    expect(screen.getByLabelText('module-challenges')).toBeInTheDocument();
  });

  it('renders Strategic Synthesis module + meta for strategy route', () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/strategy`;
    render(<OrganizationView />);
    expect(screen.getByRole('heading', { name: 'Strategic Synthesis' })).toBeInTheDocument();
    expect(screen.getByText('Synthesis, scenarios and executive summary')).toBeInTheDocument();
    expect(screen.getByLabelText('module-strategy')).toBeInTheDocument();
  });

  it('navigates + tracks when sidebar triggers onSectionChange', () => {
    render(<OrganizationView />);

    fireEvent.click(
      within(screen.getByLabelText('org-sidebar-desktop')).getByRole('button', { name: 'Goals' })
    );
    expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.ORGANIZATION.ROOT}/goals`);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('org_workspace_opened', { section: 'goals' });
  });

  it('closes mobile sidebar after section change', () => {
    render(<OrganizationView />);

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close organization navigation' })).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByLabelText('org-sidebar-mobile')).getByRole('button', { name: 'Goals' })
    );
    expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.ORGANIZATION.ROOT}/goals`);
    expect(
      screen.queryByRole('button', { name: 'Close organization navigation' })
    ).not.toBeInTheDocument();
  });

  it('mobile sidebar: close via header X and via overlay', () => {
    render(<OrganizationView />);

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close organization navigation' })).toBeInTheDocument();

    // Close via header X
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(
      screen.queryByRole('button', { name: 'Close organization navigation' })
    ).not.toBeInTheDocument();

    // Re-open and close via overlay
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close organization navigation' }));
    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
  });

  it('back button navigates to chat and sets current view', () => {
    render(<OrganizationView />);
    fireEvent.click(
      within(screen.getByLabelText('org-sidebar-desktop')).getByRole('button', { name: 'Back' })
    );
    expect(setCurrentViewMock).toHaveBeenCalledWith(AppView.AI_CHAT);
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.AI_CHAT);
  });

  it('renders OrganizationAdminPanel for admin sections', () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/members`;
    render(<OrganizationView />);
    expect(screen.getByLabelText('org-admin-panel')).toHaveTextContent('admin:members');
  });

  it('redirects megatrends to canonical Discovery Tools route', async () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/megatrends`;
    render(<OrganizationView />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS, {
        replace: true,
      })
    );
    expect(trackFunnelEventMock).toHaveBeenCalledWith('megatrends_redirect_used', {
      fromRoute: '/organization/megatrends',
    });
  });

  it('redirects megatrends even with trailing slash (path cleanup)', async () => {
    locationState.pathname = `${ROUTES.ORGANIZATION.ROOT}/megatrends/`;
    render(<OrganizationView />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS, {
        replace: true,
      })
    );
  });
});

