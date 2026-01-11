import React, { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppStore } from '../store/useAppStore';
import { AppView, AuthStep, SessionMode } from '../types';

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

  const { setCurrentView, setSessionMode, setAuthInitialStep, currentView, currentUser } =
    useAppStore();

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

  // 2. URL -> State Sync
  // This runs on mount and when location changes
  useEffect(() => {
    const path = location.pathname;

    // Skip sync if we are already in the correct view to avoid loops
    // But for "entry" via deep link, we MUST override.

    // Define Route Map
    if (path === '/demo') {
      // Phase B: Demo Session entry
      if (currentView !== AppView.AUTH) {
        console.log('[RouterSync] Phase B: Navigating to DEMO');
        setSessionMode(SessionMode.DEMO);
        setAuthInitialStep(AuthStep.REGISTER); // Demo requires light auth
        setCurrentView(AppView.AUTH);
      }
    } else if (path === '/trial/start') {
      if (currentView !== AppView.AUTH) {
        console.log('[RouterSync] Navigating to TRIAL START');
        setSessionMode(SessionMode.FULL); // Trial is FULL mode
        setAuthInitialStep(AuthStep.REGISTER);
        setCurrentView(AppView.AUTH);
      }
    } else if (path === '/consulting') {
      console.log('[RouterSync] Navigating to CONSULTING');
      // Maybe scroll to consulting section or show modal?
      // For now, go to Welcome
      if (currentView !== AppView.WELCOME) {
        setCurrentView(AppView.WELCOME);
      }
    } else if (path.startsWith('/share/')) {
      // Public share links - no auth required, handled by App.tsx directly
      console.log('[RouterSync] Public Share Link accessed');
    } else if (path === '/login') {
      // Login route - redirect if already authenticated, otherwise let React Router handle
      if (currentUser?.isAuthenticated) {
        // SUPERADMIN goes to SuperAdmin panel
        if (currentUser.role === 'SUPERADMIN') {
          console.log('[RouterSync] SUPERADMIN authenticated, redirecting to superadmin');
          navigate('/superadmin', { replace: true });
        } else {
          console.log('[RouterSync] User authenticated, redirecting to chat');
          navigate('/chat', { replace: true });
        }
        return;
      }
      // Don't change currentView - let React Router handle /login directly
      console.log('[RouterSync] At /login - React Router handles this');
      return; // IMPORTANT: Stop here, don't let other effects interfere
    } else if (path === '/register') {
      // Registration route - redirect if already authenticated, otherwise let React Router handle
      if (currentUser?.isAuthenticated) {
        // SUPERADMIN goes to SuperAdmin panel
        if (currentUser.role === 'SUPERADMIN') {
          console.log('[RouterSync] SUPERADMIN authenticated, redirecting to superadmin');
          navigate('/superadmin', { replace: true });
        } else {
          console.log('[RouterSync] User authenticated, redirecting to chat');
          navigate('/chat', { replace: true });
        }
        return;
      }
      // Don't change currentView - let React Router handle /register directly
      console.log('[RouterSync] At /register - React Router handles this');
      return; // IMPORTANT: Stop here, don't let other effects interfere
    } else if (path === '/auth') {
      // Legacy /auth route - redirect to /login
      console.log('[RouterSync] Legacy /auth route, redirecting to /login');
      navigate('/login', { replace: true });
    } else if (path === '/studio') {
      // Consultinity Studio - Visual AI Workspace
      if (!currentUser?.isAuthenticated) {
        console.log('[RouterSync] Not authenticated, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }
      // TRAP FIX: Only force STUDIO if we are not already in a different view (navigating away)
      // But on mount/refresh, we want to respect the URL.
      // We can check if the STORE matches the URL. If not, and we just mounted/navigated, we sync.
      // Problem: On sidebar click, STORE updates, URL doesn't.
      // So logic: If URL is /studio, and we ARE NOT in Studio view, it means either:
      // a) We just clicked sidebar (Store changed, URL stale) -> UPDATE URL
      // b) We just loaded URL (Store stale, URL correct) -> UPDATE STORE

      // To distinguish, we need to know if this is a "popstate" or "pushState" vs internal update.
      // OR simpler: `RouterSync` handles URL -> State.
      // We need a separate effect for State -> URL (Step 3).

      if (currentView !== AppView.STUDIO) {
        // Assuming Step 3 handles the escape, we only enforce here if "entry"
        // For now, let's keep it simple: Enforce Studio ONLY if we assume URL is truth.
        // We will rely on Step 3 to change URL if currentView changes.
        setCurrentView(AppView.STUDIO);
      }
    } else if (path === '/chat') {
      // AI Chat - primary entry point for authenticated users
      if (!currentUser?.isAuthenticated) {
        console.log('[RouterSync] Not authenticated, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }
      // SUPERADMIN users should go to SuperAdmin panel, not chat
      if (currentUser.role === 'SUPERADMIN') {
        console.log('[RouterSync] SUPERADMIN on /chat, redirecting to /superadmin');
        navigate('/superadmin', { replace: true });
        return;
      }
      // Don't override Admin/SuperAdmin/Settings/etc views - they share /chat URL
      const preservedViews = [
        'ADMIN_',
        'SUPERADMIN_',
        'SETTINGS_',
        'CONTEXT_BUILDER_',
        'MY_WORK',
        'PORTFOLIO_',
        'IMPLEMENTATION',
        'BENEFITS_',
        'ECONOMICS',
        'ASSESSMENT_',
        'AI_ACTION_',
        'KPI_OKR_',
        'STUDIO',
        'PROJECT_INTELLIGENCE',
        'FULL_',
        'AFFILIATE_',
        'DRD_',
        'ONBOARDING_',
        'CONSULTANT_',
        'ORG_SETUP_',
      ];
      const shouldPreserve = preservedViews.some((prefix) => currentView.startsWith(prefix));
      if (!shouldPreserve && currentView !== AppView.AI_CHAT) {
        console.log('[RouterSync] Navigating to AI Chat');
        setCurrentView(AppView.AI_CHAT);
      }
    } else if (path === '/admin') {
      if (!currentUser?.isAuthenticated) {
        console.log('[RouterSync] Not authenticated, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }
      console.log('[RouterSync] Navigating to Admin Overview');
      if (currentView !== AppView.ADMIN_OVERVIEW) {
        setCurrentView(AppView.ADMIN_OVERVIEW);
      }
    } else if (path === '/' || path === '') {
      if (currentUser?.isAuthenticated) {
        // SUPERADMIN goes to SuperAdmin panel
        if (currentUser.role === 'SUPERADMIN') {
          console.log('[RouterSync] SUPERADMIN authenticated, redirecting to superadmin');
          navigate('/superadmin', { replace: true });
        } else {
          console.log('[RouterSync] User authenticated, redirecting to AI Chat');
          navigate('/chat', { replace: true });
        }
        return;
      }
      console.log('[RouterSync] Phase A: Product Entry Page');
      if (currentView !== AppView.WELCOME && currentView !== AppView.AUTH) {
        setCurrentView(AppView.WELCOME);
      }
    }
  }, [location, setCurrentView, setSessionMode, setAuthInitialStep, currentUser, currentView]);

  // 3. State -> URL Sync (Escape Traps)
  useEffect(() => {
    const path = location.pathname;

    // If we are on a "Trap" URL but the view is different, escape to /chat
    if (path === '/studio' && currentView !== AppView.STUDIO) {
      navigate('/chat', { replace: true });
    }

    // Add other traps here if we add more dedicated routes
  }, [currentView, location.pathname, navigate]);

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
