import { QueryClientProvider } from '@tanstack/react-query';
import React, { useLayoutEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

import { createAppQueryClient } from '@/lib/createAppQueryClient';
import { installQueryFailureWebPerf } from '@/lib/installQueryFailureWebPerf';
import { V8Provider } from '@/providers/V8Provider';

import { VoiceConversationOverlay } from '../components/AIChat/VoiceConversationOverlay';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TourProvider } from '../components/Onboarding/TourProvider';
import { AccessPolicyProvider } from '../contexts/AccessPolicyContext';
import { AIProvider } from '../contexts/AIContext';
import { AutoSaveProvider } from '../contexts/AutoSaveContext';
import { FeatureFlagsProvider } from '../contexts/FeatureFlagsContext';
import { HelpProvider } from '../contexts/HelpContext';
import { OrgProvider } from '../contexts/OrgContext';
import { TeresaVoiceProvider } from '../contexts/TeresaVoiceContext';
import { TrialProvider } from '../contexts/TrialContext';
import { useAppStore } from '../store/useAppStore';

const queryClient = createAppQueryClient();
installQueryFailureWebPerf(queryClient);

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

const AuthenticatedProviders: React.FC<{ children: React.ReactNode }> = React.memo(
  ({ children }) => (
    <V8Provider>
      <OrgProvider>
        <AccessPolicyProvider>
          <TrialProvider>
            <AIProvider>
              <TeresaVoiceProvider>
                {children}
                <VoiceConversationOverlay />
              </TeresaVoiceProvider>
            </AIProvider>
          </TrialProvider>
        </AccessPolicyProvider>
      </OrgProvider>
    </V8Provider>
  )
);

const shouldEnableHeavyProviders = (hasCurrentUser: boolean): boolean => {
  if (hasCurrentUser) return true;
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem('token') || localStorage.getItem('refreshToken'));
  } catch {
    return false;
  }
};

const shouldEnableProvidersForRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '/';

  if (path === '/') return false;
  if (path.startsWith('/invite/')) return false;
  if (path.startsWith('/report/')) return false;
  if (path.startsWith('/shared/report/')) return false;

  return true;
};

export const AppProviders: React.FC<AppProvidersProps> = React.memo(({ children }) => {
  const hasCurrentUser = useAppStore((s) => Boolean(s.currentUser?.id));
  const isAuthInitializing = useAppStore((s) => s.isAuthInitializing);
  const enableHeavyProviders =
    shouldEnableHeavyProviders(hasCurrentUser) || shouldEnableProvidersForRoute();
  const enableLocalFeatureFlagOverrides =
    import.meta.env.VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES === 'true';

  return (
    <ErrorBoundary>
      <ThemeSync />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FeatureFlagsProvider
            config={{ enableLocalOverrides: enableLocalFeatureFlagOverrides }}
            showDevTools={false}
          >
            <AutoSaveProvider>
              <TourProvider>
                <HelpProvider>
                  {enableHeavyProviders || isAuthInitializing ? (
                    <AuthenticatedProviders>{children}</AuthenticatedProviders>
                  ) : (
                    children
                  )}
                  {/*
                    Brand-anatomy defaults for every react-hot-toast call site
                    (700+). Surfaces + text come from the canonical `c.*`
                    semantic tokens (light/dark auto via CSS vars); severity
                    icons use c-success / c-danger / c-accent. Presentation
                    only — no delivery/dedup logic touched.
                  */}
                  <Toaster
                    position="bottom-right"
                    gutter={10}
                    containerClassName="!z-toast"
                    toastOptions={{
                      duration: 4000,
                      // Canonical semantic tokens (c.*) — resolved from CSS vars
                      // in src/index.css (:root + .dark), so no hardcoded colors.
                      style: {
                        maxWidth: 'min(420px, calc(100vw - 2rem))',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        background: 'var(--c-surface-raised)',
                        color: 'var(--c-text)',
                        border: '1px solid var(--c-border)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.14)',
                      },
                      success: {
                        iconTheme: {
                          primary: 'var(--c-success)',
                          secondary: 'var(--c-surface-raised)',
                        },
                      },
                      error: {
                        duration: 6000,
                        iconTheme: {
                          primary: 'var(--c-danger)',
                          secondary: 'var(--c-surface-raised)',
                        },
                      },
                      loading: {
                        iconTheme: {
                          primary: 'var(--c-accent)',
                          secondary: 'var(--c-surface-raised)',
                        },
                      },
                    }}
                  />
                </HelpProvider>
              </TourProvider>
            </AutoSaveProvider>
          </FeatureFlagsProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
});
