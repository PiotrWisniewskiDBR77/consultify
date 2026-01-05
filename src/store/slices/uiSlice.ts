import { StateCreator } from 'zustand';

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

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
    currentView: AppView.WELCOME,
    theme: 'dark', // Default

    isSidebarOpen: false,
    isSidebarCollapsed: true,

    isChatCollapsed: false,
    chatPanelWidth: 380,
    isChatSlidingPanelOpen: false,

    activeSidePanel: null,
    previousView: null,

    setCurrentView: (view) => set({ currentView: view }),

    toggleTheme: (newTheme) =>
        set((state) => {
            if (newTheme) return { theme: newTheme };
            return { theme: state.theme === 'dark' ? 'light' : 'dark' };
        }),

    setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

    toggleChatCollapse: () => set((state) => ({ isChatCollapsed: !state.isChatCollapsed })),
    setChatPanelWidth: (width) => set({ chatPanelWidth: width }),

    toggleChatSlidingPanel: () => set((state) => ({ isChatSlidingPanelOpen: !state.isChatSlidingPanelOpen })),
    setChatSlidingPanelOpen: (open) => set({ isChatSlidingPanelOpen: open }),

    toggleSidePanel: (panel) =>
        set((state) => ({
            activeSidePanel: state.activeSidePanel === panel ? null : panel,
        })),
    closeSidePanel: () => set({ activeSidePanel: null }),

    navigateWithChatContext: (view: AppView, options?: NavigationOptions) =>
        set((state) => {
            console.log('[UISlice] navigateWithChatContext:', view, options);
            return {
                previousView: state.currentView,
                currentView: view,
            };
        }),

    returnToFullChat: () =>
        set((state) => {
            console.log('[UISlice] returnToFullChat from:', state.currentView);
            return {
                previousView: state.currentView,
                currentView: AppView.AI_CHAT,
            };
        }),

    setPreviousView: (view) => set({ previousView: view }),
});
