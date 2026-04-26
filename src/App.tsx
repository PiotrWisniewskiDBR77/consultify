import './services/tokenService'; // Initialize token service

import { Loader2 } from 'lucide-react';
import React, { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';

import { usePageMeta } from '@/hooks/usePageMeta';
// RouterSyncProvider removed - RouterSync is now single source of truth
import { usePageTracking } from '@/hooks/usePageTracking';
import { Api } from '@/services/api';

import { ChatV9FlagsIndicator } from './components/Admin/ChatV9FlagsIndicator';
import { ChatV9FlagsOverlay } from './components/Admin/ChatV9FlagsOverlay';
import { ChatV9FlagsResetHandler } from './components/Admin/ChatV9FlagsResetHandler';
import { PiiHeuristicToast } from './components/AIChat/PiiHeuristicToast';
import { VoiceLegendShortcut } from './components/AIChat/VoiceLegendShortcut';
import { RouterSync } from './components/RouterSync';
import { ImpersonationBanner } from './components/shared/ImpersonationBanner';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './routes/AppRoutes';
import { useAppStore } from './store/useAppStore';
import { User } from './types';

// Lazy load views for public routes that might be outside main app logic if needed
const AcceptInvitationView = React.lazy(() => import('./views/AcceptInvitationView'));
const PublicReportView = React.lazy(() => import('./views/reports/PublicReportView'));
const PublicReportBuilderView = React.lazy(() => import('./views/reports/PublicReportBuilderView'));

const InviteRouteWrapper = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <AcceptInvitationView
        token={token || ''}
        onAccepted={() => navigate('/login')}
        onError={(error) => console.error('Invitation error:', error)}
      />
    </React.Suspense>
  );
};

// Main App Component
function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

// Separated content to use hooks inside providers
function AppContent() {
  const {
    setCurrentUser,
    setCurrentOrganization,
    logout,
    theme,
    currentUser,
    setAuthInitializing,
    isAuthInitializing,
  } = useAppStore();

  const { i18n } = useTranslation();

  // Handle Dark/Light Theme class - use useLayoutEffect to prevent flicker
  // This runs synchronously before browser paint, preventing visual flicker
  useLayoutEffect(() => {
    // Sync theme immediately on mount to prevent flicker
    const root = document.documentElement;
    if (theme === 'dark' || theme === 'system') {
      // For 'system', check if user prefers dark mode
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      } else {
        root.classList.add('dark');
      }
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Handle RTL
  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // Analytics tracking
  usePageTracking();

  // SEO meta tags
  usePageMeta();

  // Web Vitals & Metrics Init
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Metrics] App initialized');
    }
  }, []);

  // Listen for token expiry
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('[Auth] Token expired event received');
      logout();
      // Optional: Redirect handled by state change in AppRoutes
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    return () => window.removeEventListener('auth:token-expired', handleTokenExpired);
  }, [logout]);

  // Auth Verification Logic - optimized to prevent double rendering
  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (currentUser && isMounted) setCurrentUser(null);
        if (isMounted) setAuthInitializing(false);
        return;
      }

      // 1. Immediate restore from storage (synchronous, no re-render needed)
      // Prefer the dedicated mirror key used by auth flows; fall back to the
      // already-rehydrated Zustand user if this tab has it but the mirror key is stale/missing.
      const storedUser = localStorage.getItem('user');
      let restoredUser: User | null =
        currentUser && currentUser.id && currentUser.email
          ? { ...currentUser, isAuthenticated: true }
          : null;
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          restoredUser = { ...userData, isAuthenticated: true };
          if (isMounted) setCurrentUser(restoredUser);
        } catch {
          console.warn('[Auth] Stale user data');
        }
      }

      // 2. Background sync (only update if different from restored user)
      try {
        const user = await Api.getMe();
        if (!isMounted) return; // Component unmounted, don't update state

        if (user) {
          const authenticatedUser: User = { ...user, isAuthenticated: true };

          // Only update if user data actually changed to prevent unnecessary re-renders
          if (
            !restoredUser ||
            restoredUser.id !== user.id ||
            restoredUser.email !== user.email ||
            restoredUser.avatarUrl !== user.avatarUrl ||
            restoredUser.role !== user.role
          ) {
            setCurrentUser(authenticatedUser);

            if (user.organizationId) {
              setCurrentOrganization({
                id: user.organizationId,
                name: user.organizationName || 'Organization',
              });
            }
          } else if (user.organizationId) {
            // Still update organization if needed
            setCurrentOrganization({
              id: user.organizationId,
              name: user.organizationName || 'Organization',
            });
          }
        }
      } catch (error) {
        console.error('[Auth] Profile sync failed:', error);
        // If token is invalid/expired, treat as logged out (don't keep stale restored user).
        const statusCode = (error as any)?.status;
        if (statusCode === 401 || statusCode === 403) {
          logout();
          if (isMounted) setCurrentUser(null);
        } else {
          // If API fails but we have stored user, keep it
          if (!restoredUser && isMounted) {
            setCurrentUser(null);
          }
        }
      } finally {
        if (isMounted) setAuthInitializing(false); // Done initializing - auth check complete
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Show loading screen during auth initialization to prevent flicker
  if (isAuthInitializing) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ImpersonationBanner />
      {/* Single source of truth for URL ↔ State sync */}
      <RouterSync />
      {/* Chat V9 / ADMIN AG1 — URL-triggered flag dashboard. Mounted
          globally so `?v9flags=1` opens it on any route without a new
          route definition. Returns null when inactive (zero cost). */}
      <ChatV9FlagsOverlay />
      {/* Chat V9 / ADMIN AG1 v1.3 — URL reset one-liner handler.
          Runs once on mount: if `?v9flags=reset` is present and the
          user is authorised, nukes every V9 override and rewrites
          the query to `?v9flags=1` so the overlay opens as visible
          confirmation. Mounted AFTER the overlay so the overlay's
          event listener is attached before the handler dispatches
          `chat-v9-flags:open` (effects fire in JSX declaration
          order during commit). Returns null. */}
      <ChatV9FlagsResetHandler />
      {/* Chat V9 / ADMIN AG1 v1.1 — admin-only chip that renders in the
          bottom-right corner when one or more V9 flags are overridden
          in this session. Clicking it dispatches the same open event
          the overlay listens to. Returns null for non-admins and for
          sessions with zero overrides — no chrome by default. */}
      <ChatV9FlagsIndicator />
      {/* Chat V9 / VOICE VM3.1 — global Alt+Shift+V opens the voice-
          modes legend popover from anywhere. Headless; dispatches a
          `chat-v9-voice-legend:open` CustomEvent that the mounted
          `VoiceModeLegend` in `EnhancedChatInput` listens for. Same
          focus-in-editable + open-modal guards as NAV-M1.1, so the
          chord never hijacks typing. Kill-switch: flag OFF detaches
          the listener entirely — the help button keeps working. */}
      <VoiceLegendShortcut />
      {/* Chat V9 / TRUST T-PM2-lite — headless post-send PII
          heuristic toast. Listens on `chat-v9-pii-check` dispatched
          by `EnhancedChatInput.handleSend` right after submit. Runs
          a local, pure detector (email / phone / IBAN) on the
          outgoing text and shows a one-shot advisory toast when any
          category hits. Telemetry payload is closed-enum categories
          only — never the raw message. Kill-switch: flag OFF
          detaches the listener; the dispatch is a no-op. */}
      <PiiHeuristicToast />
      <Routes>
        <Route path="/invite/:token" element={<InviteRouteWrapper />} />
        <Route
          path="/report/:id"
          element={
            <React.Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              }
            >
              <PublicReportView />
            </React.Suspense>
          }
        />
        <Route
          path="/shared/report/:token"
          element={
            <React.Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              }
            >
              <PublicReportBuilderView />
            </React.Suspense>
          }
        />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </>
  );
}

export default App;
