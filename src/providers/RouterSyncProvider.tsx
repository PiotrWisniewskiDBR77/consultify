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

import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import { getRouteFromAppView, getAppViewFromRoute } from '@/routes/routeConfig';

interface RouterSyncProviderProps {
    children: React.ReactNode;
}

export const RouterSyncProvider: React.FC<RouterSyncProviderProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentView, setCurrentView } = useAppStore();

    // Track sync source to prevent infinite loops
    const syncSource = useRef<'url' | 'view' | null>(null);
    const isInitialMount = useRef(true);

    // Synchronize URL → currentView
    useEffect(() => {
        // Skip if this change was triggered by currentView update
        if (syncSource.current === 'view') {
            syncSource.current = null;
            return;
        }

        const appView = getAppViewFromRoute(location.pathname);

        if (appView && appView !== currentView) {
            console.log('[RouterSync] URL changed:', location.pathname, '→', appView);
            syncSource.current = 'url';
            setCurrentView(appView);
        } else if (!appView && !isInitialMount.current) {
            // URL doesn't map to AppView - might be a new route
            console.log('[RouterSync] Unmapped URL:', location.pathname);
        }

        isInitialMount.current = false;
    }, [location.pathname, currentView, setCurrentView]);

    // Synchronize currentView → URL
    useEffect(() => {
        // Skip if this change was triggered by URL update
        if (syncSource.current === 'url') {
            syncSource.current = null;
            return;
        }

        const route = getRouteFromAppView(currentView);

        if (route && route !== location.pathname) {
            console.log('[RouterSync] currentView changed:', currentView, '→', route);
            syncSource.current = 'view';
            navigate(route, { replace: true });
        }
    }, [currentView, location.pathname, navigate]);

    return <>{children}</>;
};
