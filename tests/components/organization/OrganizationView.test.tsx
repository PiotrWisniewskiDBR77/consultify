import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { OrganizationView } from '../../../src/views/OrganizationView';
import { AppView } from '../../../src/types';

const navigateMock = vi.fn();
const setCurrentViewMock = vi.fn();
const locationState = { pathname: '/organization/profile' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationState,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView: setCurrentViewMock }),
}));

vi.mock('../../../src/views/ContextBuilder/modules/CompanyProfileModule', () => ({
  CompanyProfileModule: () => <div data-testid="module-profile" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/GoalsExpectationsModule', () => ({
  GoalsExpectationsModule: () => <div data-testid="module-goals" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/ChallengeMapModule', () => ({
  ChallengeMapModule: () => <div data-testid="module-challenges" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/MegatrendScannerModule', () => ({
  MegatrendScannerModule: () => <div data-testid="module-megatrends" />,
}));
vi.mock('../../../src/views/ContextBuilder/modules/StrategicSynthesisModule', () => ({
  StrategicSynthesisModule: () => <div data-testid="module-strategy" />,
}));

describe('OrganizationView (L2)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    setCurrentViewMock.mockClear();
    locationState.pathname = '/organization/profile';
  });

  it('renders profile module by default and routes section from pathname', () => {
    render(<OrganizationView />);
    expect(screen.getByTestId('module-profile')).toBeInTheDocument();
  });

  it('navigates to another section when sidebar triggers onSectionChange', () => {
    render(<OrganizationView />);
    const drawer = screen.getByTestId('organization-mobile-drawer');
    fireEvent.click(within(drawer).getByRole('button', { name: /^Goals$/i }));
    expect(navigateMock).toHaveBeenCalledWith('/organization/goals');
  });

  it('closes mobile drawer after section change', () => {
    render(<OrganizationView />);
    const drawer = screen.getByTestId('organization-mobile-drawer');

    fireEvent.click(screen.getByTestId('organization-mobile-open'));
    expect(drawer.className).toContain('translate-x-0');

    fireEvent.click(within(drawer).getByRole('button', { name: /^Goals$/i }));
    expect(navigateMock).toHaveBeenCalledWith('/organization/goals');
    expect(drawer.className).toContain('-translate-x-full');
  });

  it('defaults to profile for unknown section and renders correct module per section', () => {
    locationState.pathname = '/organization/unknown';
    const { rerender } = render(<OrganizationView />);
    expect(screen.getByTestId('module-profile')).toBeInTheDocument();

    locationState.pathname = '/organization/challenges';
    rerender(<OrganizationView />);
    expect(screen.getByTestId('module-challenges')).toBeInTheDocument();

    locationState.pathname = '/organization/megatrends';
    rerender(<OrganizationView />);
    expect(screen.getByTestId('module-megatrends')).toBeInTheDocument();

    locationState.pathname = '/organization/strategy';
    rerender(<OrganizationView />);
    expect(screen.getByTestId('module-strategy')).toBeInTheDocument();
  });

  it('back button navigates to chat and sets current view', async () => {
    render(<OrganizationView />);
    const drawer = screen.getByTestId('organization-mobile-drawer');
    fireEvent.click(within(drawer).getByRole('button', { name: /Back to Dashboard/i }));

    expect(setCurrentViewMock).toHaveBeenCalledWith(AppView.AI_CHAT);
    expect(navigateMock).toHaveBeenCalledWith('/chat');
  });

  it('mobile menu button opens drawer; close buttons close it', () => {
    render(<OrganizationView />);

    const drawer = screen.getByTestId('organization-mobile-drawer');
    expect(drawer.className).toContain('-translate-x-full');

    fireEvent.click(screen.getByTestId('organization-mobile-open'));
    expect(drawer.className).toContain('translate-x-0');
    expect(screen.getByTestId('organization-mobile-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('organization-mobile-close')).toBeInTheDocument();

    // Close via overlay
    fireEvent.click(screen.getByTestId('organization-mobile-overlay'));
    expect(drawer.className).toContain('-translate-x-full');

    // Re-open and close via header X
    fireEvent.click(screen.getByTestId('organization-mobile-open'));
    fireEvent.click(screen.getByTestId('organization-mobile-close'));
    expect(drawer.className).toContain('-translate-x-full');
  });
});
