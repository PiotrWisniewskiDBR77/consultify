import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useLayoutEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

import { V8Provider } from '@/providers/V8Provider';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { TourProvider } from '../components/Onboarding/TourProvider';
import { AutoSaveProvider } from '../context/AutoSaveContext';
import { AccessPolicyProvider } from '../contexts/AccessPolicyContext';
import { AIProvider } from '../contexts/AIContext';
import { FeatureFlagsProvider } from '../contexts/FeatureFlagsContext';
import { HelpProvider } from '../contexts/HelpContext';
import { TrialProvider } from '../contexts/TrialContext';
import { useAppStore } from '../store/useAppStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/**
 * ThemeSync - Keeps the DOM `dark` class in sync with the Zustand theme state.
 * Uses useLayoutEffect to prevent visual flicker on theme changes.
 */
const ThemeSync: React.FC = () => {
  const theme = useAppStore((s) => s.theme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Also listen for system preference changes when theme is 'system'
  React.useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
};

interface AppProvidersProps {
  children: React.ReactNode;
}

const AuthenticatedProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <V8Provider>
    <TrialProvider>
      <AccessPolicyProvider>
        <AIProvider>{children}</AIProvider>
      </AccessPolicyProvider>
    </TrialProvider>
  </V8Provider>
);

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  // Log initialization for debugging
  React.useEffect(() => {
    console.log('[AppProviders] Initializing providers...');
  }, []);

  return (
    <ErrorBoundary>
      <ThemeSync />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FeatureFlagsProvider>
            <AutoSaveProvider>
              <TourProvider>
                <HelpProvider>
                  <AuthenticatedProviders>{children}</AuthenticatedProviders>
                  <Toaster position="bottom-right" />
                </HelpProvider>
              </TourProvider>
            </AutoSaveProvider>
          </FeatureFlagsProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
