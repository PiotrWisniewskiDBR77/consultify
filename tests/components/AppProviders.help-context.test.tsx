/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const accessPolicyProviderSpy = vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>);

const storeState: {
  currentUser: { id: string } | null;
  currentView: string;
  activeSidePanel: string | null;
  theme: string;
  isAuthInitializing: boolean;
  toggleSidePanel: () => void;
} = {
  currentUser: null,
  currentView: 'WELCOME',
  activeSidePanel: null,
  theme: 'dark',
  isAuthInitializing: false,
  toggleSidePanel: vi.fn(),
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof storeState) => unknown) =>
    typeof selector === 'function' ? selector(storeState) : storeState,
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/Onboarding/TourProvider', () => ({
  TourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/context/AutoSaveContext', () => ({
  AutoSaveProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/AccessPolicyContext', () => ({
  AccessPolicyProvider: (props: { children: React.ReactNode }) => accessPolicyProviderSpy(props),
}));

vi.mock('@/contexts/AIContext', () => ({
  AIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/TrialContext', () => ({
  TrialProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/providers/V8Provider', () => ({
  V8Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

import { useHelp } from '@/contexts/HelpContext';
import { AppProviders } from '@/providers/AppProviders';

const HelpProbe: React.FC = () => {
  const help = useHelp();
  return <div data-testid="help-ready">{String(Boolean(help.contextualHelp.moduleId))}</div>;
};

describe('AppProviders help context continuity', () => {
  it('keeps HelpProvider available for unauthenticated routes', () => {
    render(
      <AppProviders>
        <HelpProbe />
      </AppProviders>,
    );

    expect(screen.getByTestId('help-ready')).toHaveTextContent('true');
  });

  it('does not mount the heavy access policy provider for unauthenticated welcome route', () => {
    // Heavy providers (incl. AccessPolicyProvider) are gated behind auth/route in
    // the current AppProviders. With no current user, no token, and the default
    // jsdom route ("/"), the authenticated provider stack is intentionally skipped.
    storeState.currentUser = null;
    storeState.isAuthInitializing = false;
    accessPolicyProviderSpy.mockClear();

    render(
      <AppProviders>
        <div>child</div>
      </AppProviders>,
    );

    expect(accessPolicyProviderSpy).not.toHaveBeenCalled();
  });

  it('mounts the access policy provider once a user is authenticated', () => {
    storeState.currentUser = { id: 'user-1' };
    accessPolicyProviderSpy.mockClear();

    render(
      <AppProviders>
        <div>child</div>
      </AppProviders>,
    );

    expect(accessPolicyProviderSpy).toHaveBeenCalled();

    storeState.currentUser = null;
  });
});
