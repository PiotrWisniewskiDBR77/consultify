import { StateCreator } from 'zustand';

import { getRouteFromAppView } from '../../routes/routeConfig';
import { AppView } from '../../types';
import { NavigationOptions } from '../../types/workspace';
import { navigationMonitor, validateNavigation } from '../../utils/navigationGuard';
import type { AppState } from '../useAppStore';

const isUiNavigationDebugEnabled = () =>
  process.env.NODE_ENV !== 'test' && process.env.VITE_UI_NAV_DEBUG === 'true';

const logUiNavigationDebug = (...args: unknown[]) => {
  if (isUiNavigationDebugEnabled()) {
    console.log(...args);
  }
};

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
    tab?: 'home' | 'ideas' | 'notebook' | 'inbox' | 'calendar' | 'tasks' | 'decisions' | 'manager';
    open?: {
      type: 'notification' | 'task' | 'idea' | 'decision' | 'notebook';
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

  // Dynamic breadcrumbs override set by My Work hub
  myWorkBreadcrumbs: string[] | null;
  setMyWorkBreadcrumbs: (crumbs: string[] | null) => void;

  // Dynamic breadcrumbs override set by Interview hub
  interviewBreadcrumbs: string[] | null;
  setInterviewBreadcrumbs: (crumbs: string[] | null) => void;

  // Chat output tool selector (auto = intent detection, others = explicit routing)
  chatOutputTool: 'auto' | 'wordy' | 'excele' | 'prezentacje';
  setChatOutputTool: (tool: 'auto' | 'wordy' | 'excele' | 'prezentacje') => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  currentView: AppView.WELCOME,
  // Decyzja (light_mode_system plan, Faza 2): domyślny theme pozostaje 'dark'.
  // Zmiana na 'system' to product decision (nie tylko techniczna) — pierwszy paint
  // w src/index.tsx już obsługuje 'system' przez prefers-color-scheme dla userów,
  // którzy ręcznie wybiorą tę opcję. Patrz: docs/ui-standards/LIGHT_MODE_QA_CHECKLIST.md
  // sekcja "Known gaps / backlog" → "default theme decision".
  theme: 'dark',

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

  myWorkBreadcrumbs: null,
  setMyWorkBreadcrumbs: (crumbs) => set({ myWorkBreadcrumbs: crumbs }),

  interviewBreadcrumbs: null,
  setInterviewBreadcrumbs: (crumbs) => set({ interviewBreadcrumbs: crumbs }),

  chatOutputTool: 'auto',
  setChatOutputTool: (tool) => set({ chatOutputTool: tool }),

  setChatKickoffMessage: (message) => set({ chatKickoffMessage: message }),
  clearChatKickoffMessage: () => set({ chatKickoffMessage: null }),

  setCurrentView: (view) => {
    const previousView = get().currentView;

    // Validate navigation before executing
    const validation = validateNavigation(view);

    // Enhanced diagnostic logging
    logUiNavigationDebug('[UISlice] ====== setCurrentView START ======');
    logUiNavigationDebug('[UISlice] State change:', {
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
        logUiNavigationDebug('[UISlice] Route resolution:', {
          view,
          resolvedRoute: route,
          method: 'React Router (navigateFn)',
        });

        if (!route) {
          console.error('[UISlice] CRITICAL: No route found for view:', view);
          navigationMonitor.recordNavigation(previousView, view, false, 'No route found');
          return;
        }

        navigateFn(route);
        navigationMonitor.recordNavigation(previousView, view, true);
        logUiNavigationDebug('[UISlice] navigateFn called successfully');
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
      logUiNavigationDebug('[UISlice] WARNING: navigateFn not available, queuing navigation', {
        view,
        resolvedRoute: route,
      });
      if (route) {
        set({ pendingNavigation: { view, route } });
      } else {
        navigationMonitor.recordNavigation(previousView, view, false, 'No route found');
      }
    }

    logUiNavigationDebug('[UISlice] ====== setCurrentView END ======');
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

    logUiNavigationDebug('[UISlice] ====== navigateWithChatContext START ======');
    logUiNavigationDebug('[UISlice] Chat context navigation:', {
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
        logUiNavigationDebug('[UISlice] Route with chat context:', {
          view,
          resolvedRoute: route,
        });

        if (!route) {
          console.error('[UISlice] CRITICAL: No route found for view:', view);
          return;
        }

        navigateFn(route);
        logUiNavigationDebug('[UISlice] navigateWithChatContext completed');
      } catch (error) {
        console.error('[UISlice] ERROR navigating with chat context:', {
          view,
          error,
        });
      }
    } else {
      const route = getRouteFromAppView(view);
      logUiNavigationDebug(
        '[UISlice] WARNING: navigateFn not available, queuing chat context navigation',
        {
          view,
          resolvedRoute: route,
        }
      );
      if (route) {
        set({ pendingNavigation: { view, route } });
      }
    }

    logUiNavigationDebug('[UISlice] ====== navigateWithChatContext END ======');
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
        if (!route) {
          console.error('[UISlice] CRITICAL: No route found for AI_CHAT');
          return;
        }
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
