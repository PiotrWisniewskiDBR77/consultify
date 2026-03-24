import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { getAppViewFromPath } from '../routes/routeConfig';
import { useAppStore } from '../store/useAppStore';
import { AppView, AuthStep, SessionMode } from '../types';
import { parseArtifactRef } from '../utils/artifactLinks';

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
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('artifact');
    nextParams.delete('code');

    if (type === 'task' || type === 'decision') {
      setMyWorkIntent({
        tab: type === 'task' ? 'tasks' : 'decisions',
        open: {
          type,
          id,
        },
      });
      nextParams.set(type === 'task' ? 'taskId' : 'decisionId', id);
      navigate(`/my-work?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'initiative') {
      nextParams.set('open', id);
      nextParams.set('mode', 'doc');
      navigate(`/initiatives?${nextParams.toString()}`, { replace: true });
      return;
    }

    if (type === 'report' || type === 'presentation' || type === 'sheet') {
      const targetTab =
        type === 'report' ? 'reports' : type === 'presentation' ? 'presentations' : 'sheets';
      nextParams.set('tab', targetTab);
      nextParams.set('selectedArtifact', `${type}:${id}`);
      navigate(`/presentations?${nextParams.toString()}`, { replace: true });
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
  }, [searchParams, navigate, setMyWorkIntent]);

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
      const target = userRole === 'SUPERADMIN' ? '/superadmin' : '/chat';
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
      path === '/studio' ||
      path.startsWith('/admin') ||
      path.startsWith('/settings') ||
      path.startsWith('/my-work') ||
      path.startsWith('/initiatives') ||
      path.startsWith('/execution') ||
      path.startsWith('/benefits') ||
      path.startsWith('/economics') ||
      path.startsWith('/reports') ||
      path.startsWith('/presentations') ||
      path.startsWith('/assessment') ||
      path.startsWith('/discovery-tools') ||
      path.startsWith('/context') ||
      path.startsWith('/interview');

    if (isProtected && !isAuthenticated) {
      console.log('[RouterSync] Not authenticated, redirecting to /login');
      isNavigatingRef.current = true;
      navigate('/login', { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // Root route should redirect authenticated users to their home
    if ((path === '/' || path === '') && isAuthenticated) {
      const target = userRole === 'SUPERADMIN' ? '/superadmin' : '/chat';
      console.log('[RouterSync] Authenticated on /, redirecting to', target);
      isNavigatingRef.current = true;
      navigate(target, { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // SUPERADMIN should not stay on /chat
    if ((path === '/chat' || path.startsWith('/chat/')) && userRole === 'SUPERADMIN') {
      console.log('[RouterSync] SUPERADMIN on /chat, redirecting to /superadmin');
      isNavigatingRef.current = true;
      navigate('/superadmin', { replace: true });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    // ---------------------------
    // URL -> currentView sync
    // ---------------------------
    const mappedView = getAppViewFromPath(path);
    if (mappedView && mappedView !== currentView) {
      setCurrentViewState(mappedView);
    }
  }, [
    location.pathname,
    currentUser?.isAuthenticated,
    currentUser?.role,
    currentView,
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
