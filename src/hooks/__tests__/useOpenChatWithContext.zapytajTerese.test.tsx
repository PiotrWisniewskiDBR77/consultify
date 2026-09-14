import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Uwaga Tomka XX (pilotaż 13.09): DRD → „Zapytaj Teresę" pokazuje „Ta rozmowa
 * nie istnieje lub została trwale usunięta."
 *
 * Odtworzone na żywo 14.09 (lokalny runtime, sesja DRD, poisoned
 * `teresa.lastActiveConversationId`): GET /api/conversations/<ghost> → 404 →
 * stan `not_found` zamiast nowej rozmowy z kontekstem pytania.
 */

const harness = vi.hoisted(() => {
  const state: Record<string, any> = {
    activeConversationId: null,
    conversations: [],
    createConversation: vi.fn(async () => ({ id: 'nowa-rozmowa' })),
    fetchConversation: vi.fn(async () => undefined),
    setActiveConversation: vi.fn(),
    setWorkspaceContext: vi.fn(),
    setTeresaEntityContext: vi.fn(),
    clearActiveChat: vi.fn(),
    _activeConversationState: null,
  };
  const useConversationStore = Object.assign(
    (selector?: (s: any) => unknown) => (selector ? selector(state) : state),
    { getState: () => state }
  );
  return { state, useConversationStore, missing: new Set<string>() };
});

vi.mock('../../store/useConversationStore', () => ({
  useConversationStore: harness.useConversationStore,
  isConversationMarkedMissing: (id: string) => harness.missing.has(id),
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector?: (s: any) => unknown) => {
      const s = {
        isChatCollapsed: false,
        toggleChatCollapse: vi.fn(),
        setCurrentViewState: vi.fn(),
        navigateFn: null,
      };
      return selector ? selector(s) : s;
    },
    { getState: () => ({}) }
  ),
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

import { useOpenChatWithContext } from '../useOpenChatWithContext';

const GHOST = '99999999-9999-4999-8999-999999999999';

function renderHook() {
  let openChat: any;
  const Probe = () => {
    openChat = useOpenChatWithContext();
    return null;
  };
  render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>
  );
  return () => openChat;
}

describe('useOpenChatWithContext — „Zapytaj Teresę" z martwym wskaźnikiem (uwaga Tomka XX)', () => {
  beforeEach(() => {
    harness.missing.clear();
    harness.state.activeConversationId = null;
    harness.state._activeConversationState = null;
    harness.state.createConversation = vi.fn(async () => ({ id: 'nowa-rozmowa' }));
    harness.state.fetchConversation = vi.fn(async () => {
      // serwer odpowiada 404 — store wchodzi w stan „not_found"
      harness.state.activeConversationId = null;
      harness.state._activeConversationState = 'not_found';
    });
    harness.state.setActiveConversation = vi.fn();
    harness.state.clearActiveChat = vi.fn();
    window.sessionStorage.setItem('teresa.lastActiveConversationId', GHOST);
  });

  it('zakłada NOWĄ rozmowę, gdy zapamiętana rozmowa nie istnieje (404)', async () => {
    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd',
      entityName: 'Ocena DRD',
      reuseActiveConversation: true,
    });
    expect(harness.state.createConversation).toHaveBeenCalled();
    expect(id).toBe('nowa-rozmowa');
    expect(window.sessionStorage.getItem('teresa.lastActiveConversationId')).toBeNull();
  });

  it('nie dotyka wskaźnika już zakwarantannowanego — od razu nowa rozmowa', async () => {
    harness.missing.add(GHOST);
    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-2',
      entityName: 'Ocena DRD',
      reuseActiveConversation: true,
    });
    expect(harness.state.fetchConversation).not.toHaveBeenCalled();
    expect(harness.state.createConversation).toHaveBeenCalled();
    expect(id).toBe('nowa-rozmowa');
  });

  it('żywą zapamiętaną rozmowę nadal używa ponownie', async () => {
    harness.state.fetchConversation = vi.fn(async () => {
      harness.state.activeConversationId = GHOST;
      harness.state._activeConversationState = 'active';
    });
    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-3',
      entityName: 'Ocena DRD',
      reuseActiveConversation: true,
    });
    expect(id).toBe(GHOST);
    expect(harness.state.createConversation).not.toHaveBeenCalled();
  });
});
