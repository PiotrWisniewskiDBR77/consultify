/**
 * Navigation Hook - Backward Compatible
 *
 * This hook provides a unified navigation interface that works with both:
 * 1. The new React Router system (useNavigate)
 * 2. The legacy ViewRenderer system (setCurrentView)
 *
 * During migration, components can use this hook and it will automatically
 * use the appropriate navigation method based on what's available.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import { getRouteFromAppView } from '@/routes/routeConfig';

/**
 * Hook for navigating between views
 * Supports both AppView enum and direct URL paths
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const { setCurrentView } = useAppStore();

  /**
   * Navigate to a view using AppView enum or URL path
   */
  const navigateTo = useCallback(
    (destination: AppView | string, options?: { replace?: boolean }) => {
      // Check if destination is an AppView enum value
      const isAppView = Object.values(AppView).includes(destination as AppView);

      if (isAppView) {
        // Convert AppView to route path
        const route = getRouteFromAppView(destination as AppView);

        // Use React Router if available
        try {
          navigate(route, { replace: options?.replace });
        } catch (error) {
          // Fallback to legacy system if router not available
          console.warn('React Router not available, using legacy navigation');
          setCurrentView(destination as AppView);
        }
      } else {
        // Direct URL path
        try {
          navigate(destination, { replace: options?.replace });
        } catch (error) {
          console.error('Navigation failed:', error);
        }
      }
    },
    [navigate, setCurrentView]
  );

  /**
   * Navigate back in history
   */
  const goBack = useCallback(() => {
    try {
      navigate(-1);
    } catch (error) {
      console.warn('Cannot go back, router not available');
    }
  }, [navigate]);

  /**
   * Navigate forward in history
   */
  const goForward = useCallback(() => {
    try {
      navigate(1);
    } catch (error) {
      console.warn('Cannot go forward, router not available');
    }
  }, [navigate]);

  return {
    navigateTo,
    goBack,
    goForward,
  };
}

/**
 * Legacy compatibility: Hook that returns setCurrentView-like function
 * This allows gradual migration of components
 */
export function useLegacyNavigation() {
  const { navigateTo } = useAppNavigation();

  return useCallback(
    (view: AppView) => {
      navigateTo(view);
    },
    [navigateTo]
  );
}
