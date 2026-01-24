import { StateCreator } from 'zustand';

import { getRouteFromAppView } from '../../routes/routeConfig';
import { AppView } from '../../types';
import { NavigationOptions } from '../../types/workspace';
import { navigationMonitor, validateNavigation } from '../../utils/navigationGuard';
import { AppState } from '../useAppStore';

export interface UISlice {
  currentView: AppView;
  theme: 'light' | 'dark' | 'system';

  // Sidebar
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  // Chat Panel Visibility
  isChatCollapsed: boolean;
  chatPanelWidth: number;
  isChatSlidingPanelOpen: boolean; // Claude-style sidebar

  // Side Panels
  activeSidePanel: 'HELP' | 'DOCUMENTS' | 'FEEDBACK' | null;

  // Unified Navigation
  previousView: AppView | null;

  // React Router navigation function
  navigateFn?: (path: string) => void;
  setNavigateFn: (fn: (path: string) => void) => void;

  // Actions
  setCurrentView: (view: AppView) => void;
  setCurrentViewState: (view: AppView) => void;
  toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  toggleSidebarCollapse: () => void;
  toggleChatCollapse: () => void;
  setChatPanelWidth: (width: number) => void;
  toggleChatSlidingPanel: () => void;
  setChatSlidingPanelOpen: (open: boolean) => void;
  toggleSidePanel: (panel: 'HELP' | 'DOCUMENTS' | 'FEEDBACK') => void;
  closeSidePanel: () => void;

  // Navigation Actions
  navigateWithChatContext: (view: AppView, options?: NavigationOptions) => void;
  returnToFullChat: () => void;
  setPreviousView: (view: AppView | null) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  currentView: AppView.WELCOME,
  theme: 'dark', // Default

  isSidebarOpen: false,
  isSidebarCollapsed: true,

  isChatCollapsed: false,
  chatPanelWidth: 380,
  isChatSlidingPanelOpen: false,

  activeSidePanel: null,
  previousView: null,

  navigateFn: undefined,

  setNavigateFn: (fn) => set({ navigateFn: fn }),

  setCurrentView: (view) => {
    const previousView = get().currentView;

    // Validate navigation before executing
    const validation = validateNavigation(view);

    // Enhanced diagnostic logging
    console.log('[UISlice] ====== setCurrentView START ======');
    console.log('[UISlice] State change:', {
      from: previousView,
      to: view,
      validation: validation.valid ? 'PASSED' : 'FAILED',
      timestamp: new Date().toISOString(),
    });

    if (!validation.valid) {
      console.error('[UISlice] Navigation validation failed:', validation.errors);
      navigationMonitor.recordNavigation(previousView, view, false, validation.errors.join(', '));
    }

    set({ currentView: view });

    // Navigate using React Router if available
    const { navigateFn } = get();

    if (navigateFn) {
      try {
        const route = getRouteFromAppView(view);
        console.log('[UISlice] Route resolution:', {
          view,
          resolvedRoute: route,
          method: 'React Router (navigateFn)',
        });

        if (!route) {
          console.error('[UISlice] CRITICAL: No route found for view:', view);
          navigationMonitor.recordNavigation(previousView, view, false, 'No route found');
        }

        navigateFn(route);
        navigationMonitor.recordNavigation(previousView, view, true);
        console.log('[UISlice] navigateFn called successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[UISlice] ERROR navigating to route:', {
          view,
          error,
        });
        navigationMonitor.recordNavigation(previousView, view, false, errorMsg);
      }
    } else {
      console.warn('[UISlice] WARNING: navigateFn not available, using fallback');
      // Fallback to window.location
      try {
        const route = getRouteFromAppView(view);
        console.log('[UISlice] Fallback route:', {
          view,
          resolvedRoute: route,
          method: 'window.location.href',
        });
        window.location.href = route;
        navigationMonitor.recordNavigation(previousView, view, true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[UISlice] Fallback navigation FAILED:', {
          view,
          error,
        });
        navigationMonitor.recordNavigation(previousView, view, false, errorMsg);
      }
    }

    console.log('[UISlice] ====== setCurrentView END ======');
  },

  setCurrentViewState: (view) => {
    const previousView = get().currentView;
    set({
      previousView,
      currentView: view,
    });
  },

  toggleTheme: (newTheme) =>
    set((state) => {
      if (newTheme) return { theme: newTheme };
      return { theme: state.theme === 'dark' ? 'light' : 'dark' };
    }),

  setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  toggleChatCollapse: () => set((state) => ({ isChatCollapsed: !state.isChatCollapsed })),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),

  toggleChatSlidingPanel: () =>
    set((state) => ({ isChatSlidingPanelOpen: !state.isChatSlidingPanelOpen })),
  setChatSlidingPanelOpen: (open) => set({ isChatSlidingPanelOpen: open }),

  toggleSidePanel: (panel) =>
    set((state) => ({
      activeSidePanel: state.activeSidePanel === panel ? null : panel,
    })),
  closeSidePanel: () => set({ activeSidePanel: null }),

  navigateWithChatContext: (view: AppView, options?: NavigationOptions) => {
    const state = get();

    console.log('[UISlice] ====== navigateWithChatContext START ======');
    console.log('[UISlice] Chat context navigation:', {
      from: state.currentView,
      to: view,
      options,
      timestamp: new Date().toISOString(),
    });

    set({
      previousView: state.currentView,
      currentView: view,
    });

    // Navigate using React Router if available
    const { navigateFn } = get();
    if (navigateFn) {
      try {
        const route = getRouteFromAppView(view);
        console.log('[UISlice] Route with chat context:', {
          view,
          resolvedRoute: route,
        });

        if (!route) {
          console.error('[UISlice] CRITICAL: No route found for view:', view);
        }

        navigateFn(route);
        console.log('[UISlice] navigateWithChatContext completed');
      } catch (error) {
        console.error('[UISlice] ERROR navigating with chat context:', {
          view,
          error,
        });
      }
    } else {
      console.warn('[UISlice] WARNING: navigateFn not available for chat context navigation');
    }

    console.log('[UISlice] ====== navigateWithChatContext END ======');
  },

  returnToFullChat: () => {
    const state = get();
    set({
      previousView: state.currentView,
      currentView: AppView.AI_CHAT,
    });

    // Navigate using React Router if available
    const { navigateFn } = get();
    if (navigateFn) {
      try {
        const route = getRouteFromAppView(AppView.AI_CHAT);
        navigateFn(route);
      } catch (error) {
        console.error('[UISlice] Error returning to full chat:', error);
      }
    }
  },

  setPreviousView: (view) => set({ previousView: view }),
});
