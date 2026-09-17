import { render, waitFor } from '@testing-library/react';
import React from 'react';
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
    vi.clearAllMocks();
    harness.missing.clear();
    harness.state.activeConversationId = null;
    harness.state.conversations = [];
    harness.state._activeConversationState = null;
    harness.state.createConversation = vi.fn(async () => ({ id: 'nowa-rozmowa' }));
    harness.state.fetchConversation = vi.fn(async () => {
      // serwer odpowiada 404 — store wchodzi w stan „not_found"
      harness.state.activeConversationId = null;
      harness.state._activeConversationState = 'not_found';
    });
    harness.state.setActiveConversation = vi.fn();
    harness.state.clearActiveChat = vi.fn();
    window.sessionStorage.clear();
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

  it('nie używa aktywnej rozmowy oznaczonej jako brakująca', async () => {
    harness.state.activeConversationId = GHOST;
    harness.state._activeConversationState = 'active';
    harness.missing.add(GHOST);

    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-missing-active',
      reuseActiveConversation: true,
    });

    expect(harness.state.fetchConversation).not.toHaveBeenCalled();
    expect(harness.state.createConversation).toHaveBeenCalledTimes(1);
    expect(id).toBe('nowa-rozmowa');
  });

  it('nie używa aktywnej rozmowy w stanie not_found', async () => {
    harness.state.activeConversationId = GHOST;
    harness.state._activeConversationState = 'not_found';

    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-not-found-active',
      reuseActiveConversation: true,
    });

    expect(harness.state.fetchConversation).not.toHaveBeenCalled();
    expect(harness.state.createConversation).toHaveBeenCalledTimes(1);
    expect(id).toBe('nowa-rozmowa');
  });

  it('czyta żywą aktywną rozmowę przy kliknięciu zamiast starego closure', async () => {
    const captured = 'stara-rozmowa-z-renderu';
    const live = 'aktualna-rozmowa-przy-kliknieciu';
    harness.state.activeConversationId = captured;
    harness.state._activeConversationState = 'active';

    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));

    // Keep the callback from the previous render and move the store forward.
    harness.state.activeConversationId = live;
    harness.state._activeConversationState = 'active';
    const id = await get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-live-snapshot',
      reuseActiveConversation: true,
    });

    expect(id).toBe(live);
    expect(harness.state.fetchConversation).not.toHaveBeenCalled();
    expect(harness.state.createConversation).not.toHaveBeenCalled();
    expect(harness.state.clearActiveChat).not.toHaveBeenCalled();
  });

  it('nie czyści nowszej rozmowy wybranej podczas sprawdzania zapamiętanego id', async () => {
    const live = 'rozmowa-wybrana-podczas-fetch';
    let finishFetch: (() => void) | undefined;
    harness.state.fetchConversation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFetch = resolve;
        })
    );

    const get = renderHook();
    await waitFor(() => expect(get()).toBeTypeOf('function'));
    const opening = get()({
      entityType: 'assessment',
      entityId: 'sesja-drd-race',
      reuseActiveConversation: true,
      contextData: { teresaPrompt: 'Nie wysyłaj tego do nowszej rozmowy.' },
    });
    await waitFor(() => expect(harness.state.fetchConversation).toHaveBeenCalledWith(GHOST));

    harness.state.activeConversationId = live;
    harness.state._activeConversationState = 'active';
    finishFetch?.();

    await expect(opening).resolves.toBe(live);
    expect(harness.state.createConversation).not.toHaveBeenCalled();
    expect(harness.state.clearActiveChat).not.toHaveBeenCalled();
    expect(harness.state.setWorkspaceContext).not.toHaveBeenCalled();
    expect(harness.state.setTeresaEntityContext).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('consultify.teresa.pendingPrompt')).toBeNull();
    expect(window.sessionStorage.getItem('teresa.lastActiveConversationId')).toBe(GHOST);
  });

  it('dostarcza nowe pytanie także przy drugim wywołaniu tej samej aktywnej rozmowy', async () => {
    const conversationId = 'aktywna-rozmowa-drd';
    harness.state.activeConversationId = conversationId;
    harness.state.conversations = [
      { id: conversationId, pmoContext: { assessmentId: 'sesja-drd' } },
    ];

    const delivered: Array<Record<string, unknown>> = [];
    const consumePrompt = () => {
      const raw = window.sessionStorage.getItem('consultify.teresa.pendingPrompt');
      if (raw) delivered.push(JSON.parse(raw));
      // The mounted composer consumes the hand-off immediately. The second
      // invocation therefore has to write and dispatch a fresh hand-off.
      window.sessionStorage.removeItem('consultify.teresa.pendingPrompt');
    };
    window.addEventListener('consultify:teresa-pending-prompt', consumePrompt);

    try {
      const get = renderHook();
      await waitFor(() => expect(get()).toBeTypeOf('function'));

      await get()({
        entityType: 'assessment',
        entityId: 'sesja-drd',
        entityName: 'Ocena DRD',
        reuseActiveConversation: true,
        contextData: { teresaPrompt: 'Wyjaśnij pierwsze pytanie.' },
      });
      await get()({
        entityType: 'assessment',
        entityId: 'sesja-drd',
        entityName: 'Ocena DRD',
        reuseActiveConversation: true,
        contextData: { teresaPrompt: 'Wyjaśnij drugie pytanie.' },
      });
    } finally {
      window.removeEventListener('consultify:teresa-pending-prompt', consumePrompt);
    }

    expect(harness.state.createConversation).not.toHaveBeenCalled();
    expect(delivered).toHaveLength(2);
    expect(delivered.map((item) => item.prompt)).toEqual([
      'Wyjaśnij pierwsze pytanie.',
      'Wyjaśnij drugie pytanie.',
    ]);
    expect(delivered[1]).toMatchObject({
      conversationId,
      entityType: 'assessment',
      entityId: 'sesja-drd',
    });
  });
});
