import { Loader2 } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';

import { usePageMeta } from '@/hooks/usePageMeta';
// RouterSyncProvider removed - RouterSync is now single source of truth
import { usePageTracking } from '@/hooks/usePageTracking';
import { Api } from '@/services/api';
import { syncLanguageFromAccount } from '@/services/languagePreference';
import { initializeTokenServiceOnce, tokenService } from '@/services/tokenService';
import { bootstrapAccessibilityPreferences } from '@/utils/accessibilityRuntime';
import { isCaseWorkspaceEnabled } from '@/components/CaseWorkspace/caseWorkspaceFlag';
import { seedReviewModeFlags } from '@/utils/reviewModeSeed';
import { isRuntimeDiagnosticMode, logRuntimeDiagnosticMarker } from '@/utils/runtimeDiagnostics';

import { ChatV9FlagsIndicator } from './components/Admin/ChatV9FlagsIndicator';
import { ChatV9FlagsOverlay } from './components/Admin/ChatV9FlagsOverlay';
import { ChatV9FlagsResetHandler } from './components/Admin/ChatV9FlagsResetHandler';
import { PiiHeuristicToast } from './components/AIChat/PiiHeuristicToast';
import { VoiceLegendShortcut } from './components/AIChat/VoiceLegendShortcut';
import { EnvironmentBadge } from './components/layout/EnvironmentBadge';
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
const SharedConversationView = React.lazy(() => import('./views/SharedConversationView'));
// Public, read-only viewer for shared work-canvas artifacts (token link).
const PublicArtifactView = React.lazy(() => import('./views/PublicArtifactView'));
// Sprint 13 — read-only Subscriber Dashboard (Bearer-token auth, no JWT).
// Lives next to the other public, lazy-loaded routes so the main app's
// auth-bootstrapping path does not gate the page on a logged-in
// Consultify user — external HMAC alert subscribers do not have one.
const SubscriberDashboardPage = React.lazy(
  () => import('./views/subscriber/SubscriberDashboardPage')
);
// Vegas Fala 0 (VF0-11) — living style guide (tokens/components/states),
// dev-only tool for robotnicy + standing "reguła #7" reference. Lazy +
// gated behind `isStyleGuideEnabled` below (default OFF): when the flag is
// off the <Route> is never added to <Routes>, so this changes nothing about
// the running app. No auth required, same reasoning as the other public
// routes above (this is a design-system reference, not user data).
const StyleGuidePage = React.lazy(() => import('./pages/dev/StyleGuide'));
const isStyleGuideEnabled = import.meta.env.VITE_ENABLE_STYLEGUIDE === 'true';
// Zlecenia (Case Workspace) — moduł ZA FLAGĄ, DOMYŚLNIE WYŁĄCZONY.
// Ta sama mechanika co `isStyleGuideEnabled` powyżej: przy wyłączonej fladze
// <Route> w ogóle nie trafia do <Routes>, więc dla wszystkich pozostałych
// użytkowników nic się nie zmienia (CLAUDE.md reguła #9 — zakaz masowego
// włączania; moduł wchodzi na demo dopiero po akcepcie właściciela).
const CaseWorkspaceRoute = React.lazy(() => import('./components/CaseWorkspace/CaseWorkspaceRoute'));
const isCaseWorkspaceEnabledAtBoot = isCaseWorkspaceEnabled();

type AuthBootState = {
  inflightMeRequest: Promise<User | null> | null;
  lastAttemptAt: number;
  lastFailureAt: number;
};

const AUTH_BOOT_STATE_KEY = '__consultifyAuthBootState__';
const AUTH_LOOP_GUARD_STORAGE_KEY = 'consultify:authLoopGuard:v1';

const getAuthBootState = (): AuthBootState => {
  if (typeof window === 'undefined') {
    return { inflightMeRequest: null, lastAttemptAt: 0, lastFailureAt: 0 };
  }
  const scopedWindow = window as typeof window & { [AUTH_BOOT_STATE_KEY]?: AuthBootState };
  if (!scopedWindow[AUTH_BOOT_STATE_KEY]) {
    scopedWindow[AUTH_BOOT_STATE_KEY] = {
      inflightMeRequest: null,
      lastAttemptAt: 0,
      lastFailureAt: 0,
    };
  }
  return scopedWindow[AUTH_BOOT_STATE_KEY] as AuthBootState;
};

const isAuthLoopGuardOpen = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(AUTH_LOOP_GUARD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Number(parsed?.blockedUntil || 0) > Date.now();
  } catch {
    return false;
  }
};

const InviteRouteWrapper = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setCurrentOrganization = useAppStore((s) => s.setCurrentOrganization);

  const clearClientSessionForInviteHandoff = () => {
    tokenService.clearTokens();
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('consultify-storage');
    localStorage.removeItem('consultify_demo_session');
    localStorage.removeItem('consultify_current_org_id');
    localStorage.removeItem('demo_events');
    try {
      sessionStorage.removeItem('isDemo');
      sessionStorage.removeItem('demo_session_id');
      sessionStorage.removeItem('demo_events');
    } catch {
      // best effort: continue handoff even if storage access fails
    }
    setCurrentUser(null);
    setCurrentOrganization(null);
  };

  const normalizedToken = token?.trim() || '';
  if (!normalizedToken) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full bg-white dark:bg-navy-900 rounded-xl shadow p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Invalid invitation link</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            This invitation URL is incomplete. Please request a new invitation link.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="inline-flex items-center px-4 py-2 rounded-md bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <AcceptInvitationView
        token={normalizedToken}
        onAccepted={() => {
          clearClientSessionForInviteHandoff();
          navigate('/login', { replace: true });
        }}
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
  const skipRouterSync = isRuntimeDiagnosticMode('no-router-sync');

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

  // 2026-07-20 full-app acceptance pass: `?review=1` seeds localStorage
  // flags ONCE (survives client-side navigation, unlike the query string
  // itself) — replaces the console-paste kit that confused Piotr. Runs
  // unconditionally, before login, so the very first page load catches it.
  useEffect(() => {
    seedReviewModeFlags();
  }, []);

  // Apply saved accessibility preferences app-wide once the user is known, so
  // they take effect everywhere — not only while the Settings panel is mounted.
  // Guarded (runs once), idempotent, and never blocks boot on the fetch.
  const a11yAppliedRef = useRef(false);
  useEffect(() => {
    if (a11yAppliedRef.current || !currentUser?.id) return;
    a11yAppliedRef.current = true;
    void bootstrapAccessibilityPreferences(() => Api.getAccessibilitySettings());
  }, [currentUser?.id]);

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

  useEffect(() => {
    if (skipRouterSync) {
      logRuntimeDiagnosticMarker('router_sync_skipped');
    }
  }, [skipRouterSync]);

  useEffect(() => {
    if (isRuntimeDiagnosticMode('no-auth')) {
      logRuntimeDiagnosticMarker('auth_boot_skipped');
      return;
    }
    if (isAuthLoopGuardOpen()) return;
    const hasAnyAuthToken = Boolean(
      localStorage.getItem('token') || localStorage.getItem('refreshToken')
    );
    if (hasAnyAuthToken) {
      initializeTokenServiceOnce();
    }
  }, []);

  // Listen for token expiry
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('[Auth] Token expired event received');
      logout({ reload: false });
      // Optional: Redirect handled by state change in AppRoutes
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    return () => window.removeEventListener('auth:token-expired', handleTokenExpired);
  }, [logout]);

  // Auth Verification Logic - optimized to prevent double rendering
  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      if (isRuntimeDiagnosticMode('no-auth')) {
        logRuntimeDiagnosticMarker('auth_verification_skipped');
        if (isMounted) {
          setCurrentUser(null);
          setAuthInitializing(false);
        }
        return;
      }
      if (isAuthLoopGuardOpen()) {
        if (isMounted) setAuthInitializing(false);
        return;
      }
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
          // P0.3: apply account language (if any) before the network round-trip
          // completes, so a Polish account never flashes English on first paint.
          void syncLanguageFromAccount(restoredUser?.language);
        } catch {
          console.warn('[Auth] Stale user data');
        }
      }

      // 2. Background sync (only update if different from restored user).
      // Singleflight + cooldown to avoid auth storms across remounts/retries.
      try {
        const authBoot = getAuthBootState();
        const now = Date.now();
        if (authBoot.lastFailureAt && now - authBoot.lastFailureAt < 10000 && restoredUser) {
          if (isMounted) setAuthInitializing(false);
          return;
        }

        if (!authBoot.inflightMeRequest) {
          authBoot.lastAttemptAt = now;
          authBoot.inflightMeRequest = Api.getMe()
            .then((u) => u)
            .catch((error) => {
              authBoot.lastFailureAt = Date.now();
              throw error;
            })
            .finally(() => {
              authBoot.inflightMeRequest = null;
            });
        }

        const user = await authBoot.inflightMeRequest;
        if (!isMounted) return; // Component unmounted, don't update state

        if (user) {
          const authenticatedUser: User = { ...user, isAuthenticated: true };

          // P0.3: konto > localStorage > navigator — re-sync on every fresh
          // profile fetch, not only when id/email/avatar/role changed (the
          // account's language may have changed from another device/tab).
          void syncLanguageFromAccount(user.language);

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
          logout({ reload: false });
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
      {skipRouterSync ? null : <RouterSync />}
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
      <EnvironmentBadge />
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
        {/* Public, read-only shared canvas artifact viewer */}
        <Route
          path="/public/artifacts/:token"
          element={
            <React.Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              }
            >
              <PublicArtifactView />
            </React.Suspense>
          }
        />
        {/* F4: public, read-only shared conversation viewer */}
        <Route
          path="/share/:token"
          element={
            <React.Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              }
            >
              <SharedConversationView />
            </React.Suspense>
          }
        />
        <Route
          path="/subscriber/dashboard"
          element={
            <React.Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              }
            >
              <SubscriberDashboardPage />
            </React.Suspense>
          }
        />
        {/* Audit Orchestrator now lives inside the authenticated app shell
            (AppRoutes → MainLayout) at /audit-programs, so it gets the nav +
            auth token. Removed the standalone route that bypassed auth. */}
        {/* VF0-11 — living style guide, default OFF (VITE_ENABLE_STYLEGUIDE). */}
        {isStyleGuideEnabled ? (
          <Route
            path="/dev/styleguide"
            element={
              <React.Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Loader2 className="animate-spin text-primary" />
                  </div>
                }
              >
                <StyleGuidePage />
              </React.Suspense>
            }
          />
        ) : null}
        {/* Zlecenia (Case Workspace) — DOMYŚLNIE WYŁĄCZONE. Trasa istnieje tylko
            przy włączonej fladze (`?ff_zlecenia=1` / localStorage / env), więc dla
            wszystkich pozostałych `/zlecenia` spada do `AppRoutes` jak dotąd.
            Musi stać PRZED catch-allem `/*`, inaczej nigdy nie zostanie trafiona. */}
        {isCaseWorkspaceEnabledAtBoot ? (
          <Route
            path="/zlecenia/*"
            element={
              <React.Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Loader2 className="animate-spin text-c-text-muted" />
                  </div>
                }
              >
                <CaseWorkspaceRoute />
              </React.Suspense>
            }
          />
        ) : null}
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </>
  );
}

export default App;
