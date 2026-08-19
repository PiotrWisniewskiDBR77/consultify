import type { ReactNode } from 'react';
import { StateCreator } from 'zustand';

import type { BreadcrumbSegment } from '../../layouts/MainLayout';
import { getRouteFromAppView } from '../../routes/routeConfig';
import { AppView } from '../../types';
import { NavigationOptions } from '../../types/workspace';
import { navigationMonitor, validateNavigation } from '../../utils/navigationGuard';
import type { AppState } from '../useAppStore';

/**
 * Contextual command shown as a persistent button INSIDE the one docked Teresa
 * panel (D17 doctrine: a single AI chat, always on the right). An artifact view
 * (e.g. InsightViewer) publishes its actions here when it hands the user off to
 * Teresa, so the former per-artifact "AI Consultant" action menu lives inside
 * Teresa instead of as a second chat instance. Cleared by the publisher on
 * unmount so actions never leak into another module's context.
 */
export interface ChatContextAction {
  id: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  /** Disable + spinner affordance while the action runs (e.g. regenerate). */
  busy?: boolean;
}

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

  // One-shot chat kickoff (cross-module)
  // Used to open split AI panel and automatically send a first message.
  chatKickoffMessage: string | null;
  setChatKickoffMessage: (message: string | null) => void;
  clearChatKickoffMessage: () => void;

  // Unified Navigation
  previousView: AppView | null;

  // React Router navigation function
  navigateFn?: (path: string) => void;
  pendingNavigation: { view: AppView; route: string } | null;
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

  // Cross-module deep links (e.g., header → My Work)
  myWorkIntent: {
    tab?: 'executive' | 'inbox' | 'focus' | 'tasks' | 'ideas' | 'decisions' | 'notebook';
    open?: {
      type: 'notification' | 'task' | 'idea' | 'decision';
      id: string;
      name?: string;
      data?: unknown;
    };
  } | null;
  setMyWorkIntent: (intent: UISlice['myWorkIntent']) => void;
  clearMyWorkIntent: () => void;

  // Cross-tab event bus for MyWork module
  myWorkEvent: {
    type:
      | 'item:completed'
      | 'item:created'
      | 'item:moved'
      | 'item:triaged'
      | 'item:converted'
      | 'item:updated'
      | 'item:deleted';
    entityType: 'task' | 'decision' | 'idea' | 'notebook' | 'inbox';
    entityId: string;
    meta?: Record<string, unknown>;
    timestamp: number;
  } | null;
  emitMyWorkEvent: (event: Omit<NonNullable<UISlice['myWorkEvent']>, 'timestamp'>) => void;
  clearMyWorkEvent: () => void;

  // Per-tab chat system prompt
  chatSystemPrompt: string | null;
  setChatSystemPrompt: (prompt: string | null) => void;

  // Per-tab quick prompts shown in chat
  chatQuickPrompts: string[] | null;
  setChatQuickPrompts: (prompts: string[] | null) => void;

  // Contextual command buttons rendered inside the one docked Teresa panel.
  // Published by an artifact view when it opens Teresa with that artifact's
  // context (D17: one chat on the right). See ChatContextAction.
  chatContextActions: ChatContextAction[] | null;
  setChatContextActions: (actions: ChatContextAction[] | null) => void;

  // Dynamic breadcrumbs override set by My Work hub
  myWorkBreadcrumbs: BreadcrumbSegment[] | null;
  setMyWorkBreadcrumbs: (crumbs: BreadcrumbSegment[] | null) => void;

  // Dynamic breadcrumbs override set by Interview hub
  interviewBreadcrumbs: string[] | null;
  setInterviewBreadcrumbs: (crumbs: string[] | null) => void;

  // Chat output tool selector (auto = intent detection, others = explicit routing)
  chatOutputTool: 'auto' | 'wordy' | 'excele' | 'prezentacje';
  setChatOutputTool: (tool: 'auto' | 'wordy' | 'excele' | 'prezentacje') => void;

  // Notebook right rail (L-02: persistent across navigation)
  notebookRailOpen: boolean;
  notebookRailTab: 'work' | 'context';
  setNotebookRailOpen: (open: boolean) => void;
  setNotebookRailTab: (tab: 'work' | 'context') => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  currentView: AppView.WELCOME,
  theme: 'dark', // Default

  isSidebarOpen: false,
  isSidebarCollapsed: true,

  // Perf default: keep AI panel closed unless user explicitly opens it.
  // UnifiedChatPanel is heavy (animations, rich UI) and can degrade responsiveness across the app.
  isChatCollapsed: true,
  chatPanelWidth: 380,
  isChatSlidingPanelOpen: false,

  activeSidePanel: null,
  previousView: null,
  chatKickoffMessage: null,

  navigateFn: undefined,
  pendingNavigation: null,
  myWorkIntent: null,
  myWorkEvent: null,
  chatSystemPrompt: null,
  chatQuickPrompts: null,
  chatContextActions: null,

  setNavigateFn: (fn) => {
    const pending = get().pendingNavigation;
    set({ navigateFn: fn, pendingNavigation: null });

    if (pending?.route) {
      try {
        fn(pending.route);
      } catch (error) {
        console.error('[UISlice] ERROR applying pending navigation:', {
          pending,
          error,
        });
      }
    }
  },
  setMyWorkIntent: (intent) => set({ myWorkIntent: intent }),
  clearMyWorkIntent: () => set({ myWorkIntent: null }),

  emitMyWorkEvent: (event) => set({ myWorkEvent: { ...event, timestamp: Date.now() } }),
  clearMyWorkEvent: () => set({ myWorkEvent: null }),

  setChatSystemPrompt: (prompt) => set({ chatSystemPrompt: prompt }),
  setChatQuickPrompts: (prompts) => set({ chatQuickPrompts: prompts }),
  setChatContextActions: (actions) => set({ chatContextActions: actions }),

  myWorkBreadcrumbs: null,
  setMyWorkBreadcrumbs: (crumbs) => set({ myWorkBreadcrumbs: crumbs }),

  interviewBreadcrumbs: null,
  setInterviewBreadcrumbs: (crumbs) => set({ interviewBreadcrumbs: crumbs }),

  chatOutputTool: 'auto',
  setChatOutputTool: (tool) => set({ chatOutputTool: tool }),

  notebookRailOpen: false,
  notebookRailTab: 'work',
  setNotebookRailOpen: (open) => set({ notebookRailOpen: open }),
  setNotebookRailTab: (tab) => set({ notebookRailTab: tab }),

  setChatKickoffMessage: (message) => set({ chatKickoffMessage: message }),
  clearChatKickoffMessage: () => set({ chatKickoffMessage: null }),

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
      const route = getRouteFromAppView(view);
      console.warn('[UISlice] WARNING: navigateFn not available, queuing navigation', {
        view,
        resolvedRoute: route,
      });
      if (route) {
        set({ pendingNavigation: { view, route } });
      } else {
        navigationMonitor.recordNavigation(previousView, view, false, 'No route found');
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
      const route = getRouteFromAppView(view);
      console.warn('[UISlice] WARNING: navigateFn not available, queuing chat context navigation', {
        view,
        resolvedRoute: route,
      });
      if (route) {
        set({ pendingNavigation: { view, route } });
      }
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
    } else {
      const route = getRouteFromAppView(AppView.AI_CHAT);
      if (route) {
        set({ pendingNavigation: { view: AppView.AI_CHAT, route } });
      }
    }
  },

  setPreviousView: (view) => set({ previousView: view }),
});
