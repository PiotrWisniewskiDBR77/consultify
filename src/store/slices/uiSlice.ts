import { StateCreator } from 'zustand';

import { getRouteFromAppView } from '../../routes/routeConfig';
import { AppView } from '../../types';
import { NavigationOptions } from '../../types/workspace';
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
    set({ currentView: view });

    // Navigate using React Router if available
    const { navigateFn } = get();

    if (navigateFn) {
      try {
        const route = getRouteFromAppView(view);
        navigateFn(route);
      } catch (error) {
        console.error('[UISlice] Error navigating to route:', error);
      }
    } else {
      // Fallback to window.location
      try {
        const route = getRouteFromAppView(view);
        window.location.href = route;
      } catch (error) {
        console.error('[UISlice] Fallback navigation failed:', error);
      }
    }
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
    set({
      previousView: state.currentView,
      currentView: view,
    });

    // Navigate using React Router if available
    const { navigateFn } = get();
    if (navigateFn) {
      try {
        const route = getRouteFromAppView(view);
        navigateFn(route);
      } catch (error) {
        console.error('[UISlice] Error navigating with chat context:', error);
      }
    }
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
