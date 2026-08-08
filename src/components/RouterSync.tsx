import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { getAppViewFromPath } from '../routes/routeConfig';
import { useAppStore } from '../store/useAppStore';
import { AuthStep, SessionMode } from '../types';
import { parseArtifactRef } from '../utils/artifactLinks';
import { canUseInternalTools, isInternalToolsPath } from '../utils/internalToolsAccess';
import {
  dispatchPilotAccessBlocked,
  getPilotBlockedFallbackPath,
  getPilotDefaultSettingsRoute,
  isPilotAllowedArtifactType,
  isPilotAllowedPath,
  isPilotParticipantRole,
} from '../utils/pilotAccess';
import { getDefaultAuthenticatedRoute, isPilotRestrictedRole } from '../utils/roleGuards';

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

  // Use refs to prevent infinite loops
  const isNavigatingRef = useRef(false);
  const lastHandledArtifactRef = useRef<string | null>(null);

  // 1.5. Artifact deep-link routing
  useEffect(() => {
    const artifactRaw = searchParams.get('artifact');
    if (!artifactRaw) {
      lastHandledArtifactRef.current = null;
      return;
    }
    if (lastHandledArtifactRef.current === artifactRaw) return;
    lastHandledArtifactRef.current = artifactRaw;

    const parsed = parseArtifactRef(artifactRaw);
    if (!parsed) return;

    const { type, id } = parsed;
    const isPilotParticipant = isPilotParticipantRole(currentUser?.role);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('artifact');
    nextParams.delete('code');

    if (isPilotParticipant && !isPilotAllowedArtifactType(type)) {
      dispatchPilotAccessBlocked({
        href: type === 'idea' ? '/my-work' : '/interview',
      });
      navigate(getPilotBlockedFallbackPath(type === 'idea' ? '/my-work' : '/interview'), {
        replace: true,
      });
      return;
    }

    if (type === 'task' || type === 'decision' || type === 'idea') {
      if (isPilotParticipant && type === 'idea') {
        dispatchPilotAccessBlocked({
          href: '/my-work',
        });
        navigate('/my-work', { replace: true });
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
      navigate(`/my-work?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'initiative') {
      nextParams.set('open', id);
      nextParams.set('mode', 'doc');
      navigate(`/initiatives?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'report') {
      nextParams.set('artifactId', id);
      navigate(`/wordy?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'presentation') {
      nextParams.set('artifactId', id);
      navigate(`/prezentacje?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'sheet') {
      nextParams.set('artifactId', id);
      navigate(`/tabele?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'assessment') {
      nextParams.set('assessmentId', id);
      navigate(`/assessment?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'tool') {
      nextParams.set('sessionId', id);
      navigate(`/discovery-tools/strategic?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'insight') {
      nextParams.set('insightId', id);
      navigate(`/interview?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'notebook') {
      setMyWorkIntent({
        tab: 'notebook' as any,
        open: { type: 'notebook', id },
      } as any);
      navigate(`/my-work?${nextParams.toString()}`, { replace: true });
      return;
    }
  }, [currentUser?.role, searchParams, navigate, setMyWorkIntent]);

  // 1. Attribution Capture
  useEffect(() => {
    const refCode = searchParams.get('ref');
    const inviteCode = searchParams.get('invite');

    if (refCode) {
      sessionStorage.setItem('attribution_ref', refCode);
      console.log('[RouterSync] Captured Referral:', refCode);
    }

    if (inviteCode) {
      sessionStorage.setItem('attribution_invite', inviteCode);
      // Optionally auto-set auth step if invite is present
      if (!currentUser) {
        setAuthInitialStep(AuthStep.REGISTER);
      }
      console.log('[RouterSync] Captured Invite:', inviteCode);
    }
  }, [searchParams, currentUser, setAuthInitialStep]);

  // 2. URL -> State Sync (single source of truth: URL)
  // - Redirects for auth-protected routes
  // - Keeps `currentView` aligned to `location.pathname`
  useEffect(() => {
    const path = location.pathname;
    const isAuthenticated = currentUser?.isAuthenticated ?? false;
    const userRole = currentUser?.role ?? null;
    const defaultAuthenticatedRoute = getDefaultAuthenticatedRoute(userRole);
    const isPilotAllowedRoute = isPilotAllowedPath(path);
    const isInternalToolsRoute = isInternalToolsPath(path);

    // Prevent infinite loops: skip if we're already navigating
    if (isNavigatingRef.current) {
      return;
    }

    // ---------------------------
    // Session entry routes
    // ---------------------------
    if (path === '/demo') {
      console.log('[RouterSync] Phase B: Navigating to DEMO');
      setSessionMode(SessionMode.DEMO);
      setAuthInitialStep(AuthStep.REGISTER); // Demo requires light auth
    } else if (path === '/trial') {
      console.log('[RouterSync] Navigating to TRIAL ENTRY');
      setSessionMode(SessionMode.FULL);
      setAuthInitialStep(AuthStep.CODE_ENTRY);
    } else if (path === '/trial/start') {
      console.log('[RouterSync] Navigating to TRIAL START');
      setSessionMode(SessionMode.FULL); // Trial is FULL mode
      setAuthInitialStep(AuthStep.REGISTER);
    } else if (path === '/consulting') {
      console.log('[RouterSync] Navigating to CONSULTING');
    } else if (path.startsWith('/share/')) {
      // Public share links - no auth required, handled by App.tsx directly
      console.log('[RouterSync] Public Share Link accessed');
    }

    // ---------------------------
    // Auth redirects
    // ---------------------------
    // If user is authenticated, keep them out of auth pages
    if ((path === '/login' || path === '/register' || path === '/auth') && isAuthenticated) {
      // 2026-07-28 fix: a deep link to a protected route (e.g. `/excele` with
      // `?artifactId=...&ff_excele_edit=1`) bounces here via the "not
      // authenticated" branch below, which stashes the ORIGINAL path+query in
      // `?redirect=`. Without this, every such link landed the user on
      // `defaultAuthenticatedRoute` after login, silently dropping the
      // artifactId and any `ff_*` flags — the exact class of bug called out
      // in `_RUNBOOK_COFANIA.md` (RedirectPreservingQuery exists, but this
      // call site pre-dates it and had no query-preserving equivalent).
      // Only accept a same-origin, relative `redirect` (must start with a
      // single `/`, never `//`) to avoid an open-redirect via this param.
      const rawRedirect = new URLSearchParams(location.search).get('redirect');
      const isSafeRelativeRedirect =
        !!rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
      const target = isSafeRelativeRedirect ? rawRedirect : defaultAuthenticatedRoute;
      console.log('[RouterSync] Authenticated on auth route, redirecting to', target);
      isNavigatingRef.current = true;
      navigate(target, { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // If user is not authenticated, protect private routes
    const isProtected =
      path === '/chat' ||
      path.startsWith('/chat/') ||
      path === '/ai' ||
      path.startsWith('/ai/') ||
      path === '/ai-os' ||
      path.startsWith('/ai-os/') ||
      path === '/studio' ||
      path.startsWith('/admin') ||
      path.startsWith('/settings') ||
      path.startsWith('/my-work') ||
      path.startsWith('/initiatives') ||
      path.startsWith('/portfolio') ||
      path.startsWith('/roadmap') ||
      path.startsWith('/roi') ||
      path.startsWith('/execution') ||
      path.startsWith('/implementation') ||
      path.startsWith('/rollout') ||
      path.startsWith('/kpi-okr') ||
      path.startsWith('/benefits') ||
      path.startsWith('/results') ||
      path.startsWith('/finance') ||
      path.startsWith('/economics') ||
      path.startsWith('/reports') ||
      path.startsWith('/presentations') ||
      path.startsWith('/assessment') ||
      path.startsWith('/discovery-tools') ||
      path.startsWith('/context') ||
      path.startsWith('/interview') ||
      path.startsWith('/wordy') ||
      path.startsWith('/excele') ||
      path.startsWith('/tabele') ||
      path.startsWith('/prezentacje') ||
      path.startsWith('/meeting') ||
      path.startsWith('/mcp/');

    if (isProtected && !isAuthenticated) {
      // 2026-07-28 fix: preserve the attempted path+query (e.g. a workbook
      // deep link's `artifactId` + `ff_excele_edit`/`ff_excele_right_rail`)
      // across the forced login round-trip. See the matching `?redirect=`
      // consumer above (auth-route branch). Bounded to this app's own
      // relative URLs only (no external redirect target is ever accepted).
      const attemptedTarget = `${path}${location.search}`;
      const loginTarget = `/login?redirect=${encodeURIComponent(attemptedTarget)}`;
      console.log('[RouterSync] Not authenticated, redirecting to', loginTarget);
      isNavigatingRef.current = true;
      navigate(loginTarget, { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    if (isAuthenticated && isInternalToolsRoute && !canUseInternalTools(currentUser)) {
      console.log('[RouterSync] Internal tools route blocked, redirecting to /chat');
      isNavigatingRef.current = true;
      navigate('/chat', { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // Root route should redirect authenticated users to their home
    if ((path === '/' || path === '') && isAuthenticated) {
      console.log('[RouterSync] Authenticated on /, redirecting to', defaultAuthenticatedRoute);
      isNavigatingRef.current = true;
      navigate(defaultAuthenticatedRoute, { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    if (isAuthenticated && isPilotRestrictedRole(userRole) && isProtected && !isPilotAllowedRoute) {
      const fallbackPath = getPilotBlockedFallbackPath(path);
      dispatchPilotAccessBlocked({
        href: fallbackPath,
      });
      console.log('[RouterSync] Restricted pilot user redirected to', fallbackPath, 'from', path);
      isNavigatingRef.current = true;
      navigate(fallbackPath, { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
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
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // ---------------------------
    // URL -> currentView sync
    // ---------------------------
    // Only react to pathname (and auth) changes — not to `currentView`.
    // Otherwise: sidebar calls setCurrentView + navigate; this effect re-runs on
    // the same path before the URL updates and overwrites the new view (Superadmin felt "stuck").
    const mappedView = getAppViewFromPath(path);
    if (mappedView && mappedView !== currentView) {
      setCurrentViewState(mappedView);
    }
  }, [
    location.pathname,
    currentUser?.isAuthenticated,
    currentUser?.email,
    currentUser?.companyName,
    currentUser?.organizationName,
    currentUser?.organizationId,
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
