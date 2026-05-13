// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView, SessionMode } from '../../src/types';

describe('useAppStore (src/store/useAppStore.ts)', () => {
  let useAppStore: any;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    vi.unmock('@/store/useAppStore');
    vi.unmock('../../src/store/useAppStore');
    const mod = await import('../../src/store/useAppStore');
    useAppStore = (mod as any).useAppStore;
  });

  it('has expected defaults (auth + ui + chat)', () => {
    const s = useAppStore.getState();
    expect(s.currentUser).toBeNull();
    expect(s.sessionMode).toBe(SessionMode.FREE);
    expect(s.currentView).toBe(AppView.WELCOME);
    expect(typeof s.isSidebarCollapsed).toBe('boolean');
    expect(typeof s.isChatCollapsed).toBe('boolean');
    expect(Array.isArray(s.activeChatMessages)).toBe(true);
  });

  it('can update UI state via real actions', () => {
    const s1 = useAppStore.getState();
    const prevCollapsed = s1.isSidebarCollapsed;
    s1.toggleSidebarCollapse();
    expect(useAppStore.getState().isSidebarCollapsed).toBe(!prevCollapsed);

    const prevChatCollapsed = useAppStore.getState().isChatCollapsed;
    useAppStore.getState().toggleChatCollapse();
    expect(useAppStore.getState().isChatCollapsed).toBe(!prevChatCollapsed);

    useAppStore.getState().toggleTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('can update auth + chat state via real actions', () => {
    useAppStore.getState().setSessionMode(SessionMode.FULL);
    expect(useAppStore.getState().sessionMode).toBe(SessionMode.FULL);

    useAppStore.getState().setCurrentUser({ id: 'u-1', email: 'u@example.com' } as any);
    expect(useAppStore.getState().currentUser).toMatchObject({ id: 'u-1' });

    useAppStore
      .getState()
      .addChatMessage({ id: 'm-1', role: 'user', content: 'Hello', timestamp: new Date() } as any);
    expect(useAppStore.getState().activeChatMessages).toHaveLength(1);

    useAppStore.getState().setAIConfig({ webSearch: false, responseStyle: 'concise' });
    expect(useAppStore.getState().aiConfig.webSearch).toBe(false);
    expect(useAppStore.getState().aiConfig.responseStyle).toBe('concise');
  });

  it('does not call navigateFn when route resolver returns empty route', async () => {
    vi.resetModules();
    vi.doMock('../../src/routes/routeConfig', async () => {
      const actual = await vi.importActual<any>('../../src/routes/routeConfig');
      return {
        ...actual,
        getRouteFromAppView: vi.fn(() => ''),
      };
    });

    const mod = await import('../../src/store/useAppStore');
    const mockedStore = (mod as any).useAppStore;
    const navSpy = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockedStore.getState().setNavigateFn(navSpy);
    mockedStore.getState().setCurrentView(AppView.AI_CHAT);

    expect(navSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    vi.doUnmock('../../src/routes/routeConfig');
  });

  it('queues pending navigation when navigateFn is missing and route exists', () => {
    useAppStore.getState().navigateWithChatContext(AppView.MY_WORK);
    const state = useAppStore.getState();

    expect(state.pendingNavigation).toBeTruthy();
    expect(state.pendingNavigation?.view).toBe(AppView.MY_WORK);
    expect(typeof state.pendingNavigation?.route).toBe('string');
  });

  it('stores my-work deep-link intent for manager tab', () => {
    useAppStore.getState().setMyWorkIntent({ tab: 'manager' });
    expect(useAppStore.getState().myWorkIntent).toEqual({ tab: 'manager' });
  });

  it('mirrors currentUser to dedicated auth storage', () => {
    useAppStore.getState().setCurrentUser({ id: 'u-1', email: 'u@example.com' } as any);
    expect(JSON.parse(localStorage.getItem('user') || '{}')).toMatchObject({
      id: 'u-1',
      email: 'u@example.com',
    });

    useAppStore.getState().setCurrentUser(null);
    expect(localStorage.getItem('user')).toBeNull();
  });
});
