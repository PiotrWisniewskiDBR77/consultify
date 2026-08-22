/**
 * RouterSyncProvider
 *
 * Synchronizes URL state with Zustand store's currentView during React Router migration.
 * This enables backward compatibility - components can use either:
 * 1. New: useAppNavigation() hook with React Router
 * 2. Legacy: setCurrentView() with ViewRenderer
 *
 * The provider ensures both systems stay in sync.
 */

import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getAppViewFromPath, getRouteFromAppView } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

interface RouterSyncProviderProps {
  children: React.ReactNode;
}

// Routes that should NOT be synchronized (handled directly by React Router)
const EXCLUDED_ROUTES = ['/login', '/register', '/auth', '/trial', '/demo'];

export const RouterSyncProvider: React.FC<RouterSyncProviderProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentView, setCurrentView } = useAppStore();

  // Track sync source to prevent infinite loops
  const syncSource = useRef<'url' | 'view' | null>(null);
  const isInitialMount = useRef(true);

  // Check if current path should be excluded from sync
  const isExcludedRoute = EXCLUDED_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Synchronize URL → currentView
  useEffect(() => {
    // Skip excluded routes - let React Router handle them directly
    if (isExcludedRoute) {
      return;
    }

    // Skip if this change was triggered by currentView update
    if (syncSource.current === 'view') {
      syncSource.current = null;
      return;
    }

    const appView = getAppViewFromPath(location.pathname);

    if (appView && appView !== currentView) {
      console.log('[RouterSync] URL changed:', location.pathname, '→', appView);
      syncSource.current = 'url';
      setCurrentView(appView);
    } else if (!appView && !isInitialMount.current) {
      // URL doesn't map to AppView - might be a new route
      console.log('[RouterSync] Unmapped URL:', location.pathname);
    }

    isInitialMount.current = false;
  }, [location.pathname, currentView, setCurrentView, isExcludedRoute]);

  // Synchronize currentView → URL
  useEffect(() => {
    // Skip excluded routes - let React Router handle them directly
    if (isExcludedRoute) {
      return;
    }

    // Skip if this change was triggered by URL update
    if (syncSource.current === 'url') {
      syncSource.current = null;
      return;
    }

    // The URL is authoritative during a direct/deep-link entry. In React
    // StrictMode both synchronization effects may be replayed before the
    // Zustand update from the URL has rendered. Never let the stale persisted
    // currentView overwrite an already valid route during that window.
    const locationView = getAppViewFromPath(location.pathname);
    if (locationView && locationView !== currentView) {
      return;
    }

    const route = getRouteFromAppView(currentView);

    if (route && route !== location.pathname) {
      console.log('[RouterSync] currentView changed:', currentView, '→', route);
      syncSource.current = 'view';
      navigate(route, { replace: true });
    }
  }, [currentView, location.pathname, navigate, isExcludedRoute]);

  return <>{children}</>;
};
