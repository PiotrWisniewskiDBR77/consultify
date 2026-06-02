import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { createAuthSlice } from '../../../src/store/slices/authSlice';
import { AppView, AuthStep, SessionMode } from '../../../src/types';

describe('authSlice logout attribution cleanup', () => {
  it('clears attribution session keys on logout', () => {
    const href = 'http://localhost/chat';
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      href,
    } as Location);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({} as Response);

    localStorage.setItem('token', 'token-123');
    sessionStorage.setItem('attribution_ref', 'ref-xyz');
    sessionStorage.setItem('attribution_invite', 'invite-abc');

    const store = createStore<any>()((set, get, api) => ({
      currentView: AppView.AI_CHAT,
      isSidebarOpen: true,
      activeSidePanel: 'panel',
      activeChatMessages: [],
      currentStreamContent: '',
      aiConfig: {},
      currentProjectId: 'p-1',
      notifications: [],
      freeSessionData: {},
      fullSessionData: {},
      ...createAuthSlice(set as any, get as any, api as any),
    }));

    store.getState().logout();

    expect(sessionStorage.getItem('attribution_ref')).toBeNull();
    expect(sessionStorage.getItem('attribution_invite')).toBeNull();

    fetchSpy.mockRestore();
    locationSpy.mockRestore();
  });
});
