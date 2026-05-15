import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { getAppViewFromPath } from '../routes/routeConfig';
import { useAppStore } from '../store/useAppStore';
import { AuthStep, SessionMode } from '../types';
import { buildArtifactCode, parseArtifactRef } from '../utils/artifactLinks';
import {
  dispatchPilotAccessBlocked,
  getPilotBlockedFallbackPath,
  getPilotDefaultSettingsRoute,
  isPilotAllowedArtifactType,
  isPilotAllowedPath,
  isPilotParticipantRole,
} from '../utils/pilotAccess';
import {
  getDefaultAuthenticatedRoute,
  isPilotRestrictedRole,
  isSuperAdminRole,
} from '../utils/roleGuards';

const isRouterSyncDebugEnabled = () =>
  process.env.NODE_ENV !== 'test' && process.env.VITE_ROUTER_SYNC_DEBUG === 'true';

const debugRouterSync = (...args: unknown[]) => {
  if (isRouterSyncDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

const buildRouteWithParams = (basePath: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

const isProtectedPath = (path: string): boolean =>
  path === '/chat' ||
  path.startsWith('/chat/') ||
  path === '/app-intro' ||
  path.startsWith('/app-intro/') ||
  path === '/studio' ||
  path.startsWith('/internal') ||
  path.startsWith('/admin') ||
  path.startsWith('/superadmin') ||
  path.startsWith('/settings') ||
  path.startsWith('/organization') ||
  (path.startsWith('/partner') && !path.startsWith('/partner/pricing')) ||
  path.startsWith('/my-work') ||
  path.startsWith('/initiatives') ||
  path.startsWith('/execution') ||
  path.startsWith('/implementation') ||
  path.startsWith('/rollout') ||
  path.startsWith('/kpi-okr') ||
  path.startsWith('/benefits') ||
  path.startsWith('/finance') ||
  path.startsWith('/economics') ||
  path.startsWith('/reports') ||
  path.startsWith('/presentations') ||
  path.startsWith('/assessment') ||
  path.startsWith('/discovery-tools') ||
  path.startsWith('/context') ||
  path.startsWith('/interview') ||
  path === '/discovery' ||
  path.startsWith('/discovery/') ||
  path.startsWith('/wordy') ||
  path.startsWith('/excele') ||
  path.startsWith('/prezentacje') ||
  path.startsWith('/meeting') ||
  path.startsWith('/mcp/') ||
  path.startsWith('/roadmap') ||
  path.startsWith('/portfolio') ||
  path.startsWith('/roi') ||
  path.startsWith('/project-intelligence') ||
  path.startsWith('/ai-actions') ||
  path.startsWith('/consultant') ||
  path.startsWith('/setup/organization') ||
  path.startsWith('/setup/onboarding') ||
  path.startsWith('/partner/onboarding') ||
  path.startsWith('/affiliate');

/**
 * RouterSync
 *
 * Bridges React Router (URL) with Global State (Zustand).
 * - Listens for URL changes -> Updates App State
 * - Captures attribution parameters (?ref=, ?invite=)
 */
export const RouterSync: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors that return new objects/arrays each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const setCurrentViewState = useAppStore((s) => s.setCurrentViewState);
  const setMyWorkIntent = useAppStore((s) => s.setMyWorkIntent);
  const setSessionMode = useAppStore((s) => s.setSessionMode);
  const setAuthInitialStep = useAppStore((s) => s.setAuthInitialStep);
  const currentView = useAppStore((s) => s.currentView);
  const currentUser = useAppStore((s) => s.currentUser);
  const isAuthenticated = currentUser?.isAuthenticated ?? false;

  // Use refs to prevent infinite loops
  const isNavigatingRef = useRef(false);
  const lastHandledArtifactRef = useRef<string | null>(null);
  const currentViewRef = useRef(currentView);
  const navigationUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const scheduleNavigationUnlock = () => {
    if (navigationUnlockTimerRef.current) {
      clearTimeout(navigationUnlockTimerRef.current);
    }
    navigationUnlockTimerRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
      navigationUnlockTimerRef.current = null;
    }, 50);
  };

  useEffect(() => {
    return () => {
      if (navigationUnlockTimerRef.current) {
        clearTimeout(navigationUnlockTimerRef.current);
      }
    };
  }, []);

  // 1.5. Artifact deep-link routing
  useEffect(() => {
    const artifactRaw = searchParams.get('artifact');
    if (!artifactRaw) {
      lastHandledArtifactRef.current = null;
      return;
    }
    const artifactHandlingKey = `${location.pathname}|${artifactRaw}|${String(isAuthenticated)}`;
    if (lastHandledArtifactRef.current === artifactHandlingKey) return;
    lastHandledArtifactRef.current = artifactHandlingKey;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('artifact');

    const parsed = parseArtifactRef(artifactRaw);
    if (!parsed) {
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams(location.pathname, nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    const { type, id } = parsed;
    const codeParam = nextParams.get('code');
    const expectedArtifactCode = buildArtifactCode(type, id);
    if (codeParam === expectedArtifactCode) {
      nextParams.delete('code');
    }
    const isPilotParticipant = isPilotParticipantRole(currentUser?.role);

    if (!isAuthenticated) {
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/login', searchParams), {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            key: location.key,
          },
        },
      });
      scheduleNavigationUnlock();
      return;
    }

    if (isPilotParticipant && !isPilotAllowedArtifactType(type)) {
      const blockedHref = getPilotBlockedFallbackPath(type === 'idea' ? '/my-work' : '/interview');
      dispatchPilotAccessBlocked({
        href: blockedHref,
      });
      isNavigatingRef.current = true;
      navigate(blockedHref, { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'task' || type === 'decision' || type === 'idea') {
      if (isPilotParticipant && type === 'idea') {
        const blockedHref = getPilotBlockedFallbackPath('/my-work');
        dispatchPilotAccessBlocked({
          href: blockedHref,
        });
        isNavigatingRef.current = true;
        navigate(blockedHref, { replace: true });
        scheduleNavigationUnlock();
        return;
      }
      const targetTab = type === 'task' ? 'tasks' : type === 'decision' ? 'decisions' : 'ideas';
      const targetParam =
        type === 'task' ? 'taskId' : type === 'decision' ? 'decisionId' : 'ideaId';
      setMyWorkIntent({
        tab: targetTab,
        open: {
          type,
          id,
        },
      });
      nextParams.set(targetParam, id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/my-work', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'initiative') {
      nextParams.set('open', id);
      nextParams.set('mode', 'doc');
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/initiatives', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'report') {
      nextParams.set('artifactId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/wordy', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'presentation') {
      nextParams.set('artifactId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/prezentacje', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'sheet') {
      nextParams.set('artifactId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/excele', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'assessment') {
      nextParams.set('assessmentId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/assessment', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'tool') {
      nextParams.set('sessionId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/discovery-tools/strategic', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'insight') {
      nextParams.set('insightId', id);
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/interview', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (type === 'notebook') {
      setMyWorkIntent({
        tab: 'notebook',
        open: { type: 'notebook', id },
      });
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/my-work', nextParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    // Unknown-but-parseable artifact type: clean URL and keep user on current route.
    isNavigatingRef.current = true;
    navigate(buildRouteWithParams(location.pathname, nextParams), { replace: true });
    scheduleNavigationUnlock();
  }, [currentUser?.role, isAuthenticated, location.pathname, searchParams, navigate, setMyWorkIntent]);

  // 1. Attribution Capture
  useEffect(() => {
    const refCode = searchParams.get('ref');
    const inviteCode = searchParams.get('invite');

    if (refCode) {
      try {
        sessionStorage.setItem('attribution_ref', refCode);
      } catch {
        // Ignore storage failures in restricted/private browser contexts.
      }
      debugRouterSync('[RouterSync] Captured Referral:', refCode);
    }

    if (inviteCode) {
      try {
        sessionStorage.setItem('attribution_invite', inviteCode);
      } catch {
        // Ignore storage failures in restricted/private browser contexts.
      }
      // Optionally auto-set auth step if invite is present
      if (!isAuthenticated) {
        setAuthInitialStep(AuthStep.REGISTER);
      }
      debugRouterSync('[RouterSync] Captured Invite:', inviteCode);
    }
  }, [searchParams, isAuthenticated, setAuthInitialStep]);

  // 2. URL -> State Sync (single source of truth: URL)
  // - Redirects for auth-protected routes
  // - Keeps `currentView` aligned to `location.pathname`
  useEffect(() => {
    const path = location.pathname;
    const userRole = currentUser?.role ?? null;
    const defaultAuthenticatedRoute = getDefaultAuthenticatedRoute(userRole);
    const isPilotAllowedRoute = isPilotAllowedPath(path);
    const syncCurrentViewFromPath = () => {
      const mappedView = getAppViewFromPath(path);
      if (mappedView && mappedView !== currentViewRef.current) {
        setCurrentViewState(mappedView);
      }
    };

    // Prevent infinite loops: skip if we're already navigating
    if (isNavigatingRef.current) {
      syncCurrentViewFromPath();
      return;
    }

    // ---------------------------
    // Session entry routes
    // ---------------------------
    if (path === '/demo') {
      debugRouterSync('[RouterSync] Phase B: Navigating to DEMO');
      if (!isAuthenticated) {
        setSessionMode(SessionMode.DEMO);
        setAuthInitialStep(AuthStep.REGISTER); // Demo requires light auth
      }
    } else if (path === '/trial') {
      debugRouterSync('[RouterSync] Navigating to TRIAL ENTRY');
      if (!isAuthenticated) {
        setSessionMode(SessionMode.FULL);
        setAuthInitialStep(AuthStep.CODE_ENTRY);
      }
    } else if (path === '/trial/start') {
      debugRouterSync('[RouterSync] Navigating to TRIAL START');
      if (!isAuthenticated) {
        setSessionMode(SessionMode.FULL); // Trial is FULL mode
        setAuthInitialStep(AuthStep.REGISTER);
      }
    } else if (path === '/consulting') {
      debugRouterSync('[RouterSync] Navigating to CONSULTING');
    } else if (path.startsWith('/share/')) {
      // Public share links - no auth required, handled by App.tsx directly
      debugRouterSync('[RouterSync] Public Share Link accessed');
    }

    // ---------------------------
    // Auth redirects
    // ---------------------------
    // If user is authenticated, keep them out of auth pages
    if ((path === '/login' || path === '/register' || path === '/auth') && isAuthenticated) {
      if (searchParams.get('artifact')) {
        syncCurrentViewFromPath();
        return;
      }
      debugRouterSync(
        '[RouterSync] Authenticated on auth route, redirecting to',
        defaultAuthenticatedRoute
      );
      isNavigatingRef.current = true;
      navigate(defaultAuthenticatedRoute, { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    // If user is not authenticated, protect private routes
    const isProtected = isProtectedPath(path);

    if (isProtected && !isAuthenticated) {
      debugRouterSync('[RouterSync] Not authenticated, redirecting to /login');
      isNavigatingRef.current = true;
      navigate('/login', {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            key: location.key,
          },
        },
      });
      scheduleNavigationUnlock();
      return;
    }

    // Root route should redirect authenticated users to their home
    if ((path === '/' || path === '') && isAuthenticated) {
      debugRouterSync('[RouterSync] Authenticated on /, redirecting to', defaultAuthenticatedRoute);
      isNavigatingRef.current = true;
      navigate(defaultAuthenticatedRoute, { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (isAuthenticated && isPilotRestrictedRole(userRole) && isProtected && !isPilotAllowedRoute) {
      const fallbackPath = getPilotBlockedFallbackPath(path);
      dispatchPilotAccessBlocked({
        href: fallbackPath,
      });
      debugRouterSync(
        '[RouterSync] Restricted pilot user redirected to',
        fallbackPath,
        'from',
        path
      );
      isNavigatingRef.current = true;
      navigate(fallbackPath, { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    if (
      isAuthenticated &&
      isPilotRestrictedRole(userRole) &&
      path.startsWith('/settings') &&
      path !== '/settings' &&
      path !== getPilotDefaultSettingsRoute() &&
      !path.startsWith(`${getPilotDefaultSettingsRoute()}/`)
    ) {
      isNavigatingRef.current = true;
      navigate(getPilotDefaultSettingsRoute(), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    // SUPERADMIN should not stay on /chat
    if ((path === '/chat' || path.startsWith('/chat/')) && isSuperAdminRole(userRole)) {
      debugRouterSync('[RouterSync] SUPERADMIN on /chat, redirecting to /superadmin');
      isNavigatingRef.current = true;
      navigate(buildRouteWithParams('/superadmin', searchParams), { replace: true });
      scheduleNavigationUnlock();
      return;
    }

    // ---------------------------
    // URL -> currentView sync
    // ---------------------------
    // Only react to pathname (and auth) changes — not to `currentView`.
    // Otherwise: sidebar calls setCurrentView + navigate; this effect re-runs on
    // the same path before the URL updates and overwrites the new view (Superadmin felt "stuck").
    syncCurrentViewFromPath();
  }, [
    location.pathname,
    searchParams,
    currentUser?.isAuthenticated,
    currentUser?.role,
    navigate,
    setCurrentViewState,
    setSessionMode,
    setAuthInitialStep,
  ]);

  // 3. State -> URL Sync (Optional / One-way for now)
  // If we wanted the URL to change when user clicks in-app nav:
  /*
    useEffect(() => {
        if (currentView === AppView.FREE_ASSESSMENT_CHAT && location.pathname !== '/demo') {
            navigate('/demo', { replace: true });
        }
        // ... etc
    }, [currentView, navigate, location]);
    */

  return null; // Logic only component
};
