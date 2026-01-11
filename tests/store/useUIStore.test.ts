/**
 * UI Store Tests
 * Tests for UI state Zustand store
 *
 * @module tests/store/useUIStore.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock store
const createMockUIStore = () => {
  let state = {
    // Sidebar
    sidebarCollapsed: false,
    sidebarWidth: 280,

    // Theme
    theme: 'system' as 'light' | 'dark' | 'system',
    isDarkMode: false,

    // Modals
    activeModal: null as string | null,
    modalData: null as any,

    // Notifications
    notifications: [] as Array<{ id: string; type: string; message: string }>,

    // Loading
    globalLoading: false,
    loadingMessage: '',

    // Layout
    rightPanelOpen: false,
    rightPanelContent: null as string | null,

    // Breadcrumbs
    breadcrumbs: [] as Array<{ label: string; path?: string }>,
  };

  const listeners = new Set<() => void>();

  const setState = (partial: Partial<typeof state>) => {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener());
  };

  const getState = () => state;

  return {
    getState,
    setState,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Sidebar actions
    toggleSidebar: () => {
      setState({ sidebarCollapsed: !state.sidebarCollapsed });
    },
    setSidebarWidth: (width: number) => {
      setState({ sidebarWidth: Math.max(200, Math.min(400, width)) });
    },
    // Theme actions
    setTheme: (theme: 'light' | 'dark' | 'system') => {
      const isDarkMode =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      setState({ theme, isDarkMode });
    },
    // Modal actions
    openModal: (modalId: string, data?: any) => {
      setState({ activeModal: modalId, modalData: data });
    },
    closeModal: () => {
      setState({ activeModal: null, modalData: null });
    },
    // Notification actions
    addNotification: (notification: { type: string; message: string }) => {
      const id = `notif-${Date.now()}`;
      setState({
        notifications: [...state.notifications, { id, ...notification }],
      });
      return id;
    },
    removeNotification: (id: string) => {
      setState({
        notifications: state.notifications.filter((n) => n.id !== id),
      });
    },
    clearNotifications: () => {
      setState({ notifications: [] });
    },
    // Loading actions
    setGlobalLoading: (loading: boolean, message = '') => {
      setState({ globalLoading: loading, loadingMessage: message });
    },
    // Right panel actions
    openRightPanel: (content: string) => {
      setState({ rightPanelOpen: true, rightPanelContent: content });
    },
    closeRightPanel: () => {
      setState({ rightPanelOpen: false, rightPanelContent: null });
    },
    // Breadcrumb actions
    setBreadcrumbs: (breadcrumbs: Array<{ label: string; path?: string }>) => {
      setState({ breadcrumbs });
    },
  };
};

describe('UI Store Tests', () => {
  let store: ReturnType<typeof createMockUIStore>;

  beforeEach(() => {
    store = createMockUIStore();
  });

  // ═══════════════════════════════════════════════════════════════════
  // SIDEBAR
  // ═══════════════════════════════════════════════════════════════════

  describe('Sidebar', () => {
    it('should toggle sidebar', () => {
      expect(store.getState().sidebarCollapsed).toBe(false);

      store.toggleSidebar();
      expect(store.getState().sidebarCollapsed).toBe(true);

      store.toggleSidebar();
      expect(store.getState().sidebarCollapsed).toBe(false);
    });

    it('should set sidebar width within bounds', () => {
      store.setSidebarWidth(300);
      expect(store.getState().sidebarWidth).toBe(300);

      // Min bound
      store.setSidebarWidth(100);
      expect(store.getState().sidebarWidth).toBe(200);

      // Max bound
      store.setSidebarWidth(500);
      expect(store.getState().sidebarWidth).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════════

  describe('Theme', () => {
    it('should set light theme', () => {
      store.setTheme('light');

      expect(store.getState().theme).toBe('light');
      expect(store.getState().isDarkMode).toBe(false);
    });

    it('should set dark theme', () => {
      store.setTheme('dark');

      expect(store.getState().theme).toBe('dark');
      expect(store.getState().isDarkMode).toBe(true);
    });

    it('should handle system theme', () => {
      store.setTheme('system');
      expect(store.getState().theme).toBe('system');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════

  describe('Modals', () => {
    it('should open modal', () => {
      store.openModal('confirm-dialog', { title: 'Confirm' });

      expect(store.getState().activeModal).toBe('confirm-dialog');
      expect(store.getState().modalData).toEqual({ title: 'Confirm' });
    });

    it('should close modal', () => {
      store.openModal('test-modal');
      store.closeModal();

      expect(store.getState().activeModal).toBeNull();
      expect(store.getState().modalData).toBeNull();
    });

    it('should replace modal when opening new one', () => {
      store.openModal('modal-1');
      store.openModal('modal-2', { data: 'test' });

      expect(store.getState().activeModal).toBe('modal-2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Notifications', () => {
    it('should add notification', () => {
      const id = store.addNotification({ type: 'success', message: 'Done!' });

      expect(store.getState().notifications.length).toBe(1);
      expect(store.getState().notifications[0].message).toBe('Done!');
      expect(id).toBeDefined();
    });

    it('should remove notification', () => {
      const id = store.addNotification({ type: 'info', message: 'Info' });
      store.removeNotification(id);

      expect(store.getState().notifications.length).toBe(0);
    });

    it('should clear all notifications', () => {
      store.addNotification({ type: 'info', message: 'Info 1' });
      store.addNotification({ type: 'info', message: 'Info 2' });
      store.clearNotifications();

      expect(store.getState().notifications.length).toBe(0);
    });

    it('should maintain order', () => {
      store.addNotification({ type: 'info', message: 'First' });
      store.addNotification({ type: 'info', message: 'Second' });

      expect(store.getState().notifications[0].message).toBe('First');
      expect(store.getState().notifications[1].message).toBe('Second');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL LOADING
  // ═══════════════════════════════════════════════════════════════════

  describe('Global Loading', () => {
    it('should set loading state', () => {
      store.setGlobalLoading(true, 'Saving...');

      expect(store.getState().globalLoading).toBe(true);
      expect(store.getState().loadingMessage).toBe('Saving...');
    });

    it('should clear loading state', () => {
      store.setGlobalLoading(true);
      store.setGlobalLoading(false);

      expect(store.getState().globalLoading).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RIGHT PANEL
  // ═══════════════════════════════════════════════════════════════════

  describe('Right Panel', () => {
    it('should open right panel', () => {
      store.openRightPanel('help');

      expect(store.getState().rightPanelOpen).toBe(true);
      expect(store.getState().rightPanelContent).toBe('help');
    });

    it('should close right panel', () => {
      store.openRightPanel('settings');
      store.closeRightPanel();

      expect(store.getState().rightPanelOpen).toBe(false);
      expect(store.getState().rightPanelContent).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BREADCRUMBS
  // ═══════════════════════════════════════════════════════════════════

  describe('Breadcrumbs', () => {
    it('should set breadcrumbs', () => {
      const breadcrumbs = [
        { label: 'Home', path: '/' },
        { label: 'Projects', path: '/projects' },
        { label: 'Project 1' },
      ];

      store.setBreadcrumbs(breadcrumbs);

      expect(store.getState().breadcrumbs).toEqual(breadcrumbs);
    });

    it('should clear breadcrumbs', () => {
      store.setBreadcrumbs([{ label: 'Test' }]);
      store.setBreadcrumbs([]);

      expect(store.getState().breadcrumbs.length).toBe(0);
    });
  });
});
