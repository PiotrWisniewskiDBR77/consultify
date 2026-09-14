import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Uwaga Tomka IX (pilotaż 13.09): „mimo rozpoczęcia nowej rozmowy okno
 * przeskakuje do ostatniego Chatu. W lewym oknie bocznym można wybrać powstałą
 * nową konwersację."
 *
 * Zmierzone na żywo (lokalny runtime, 14.09): po kliknięciu „+" adres URL
 * zostaje na `/chat/<STARY_ID>`, choć store ma już nową rozmowę — więc każde
 * ponowne zamontowanie trasy (powrót, przeładowanie) wczytuje STARĄ rozmowę.
 *
 * Przyczyna: `syncingFromUrl` w ConversationRouteSync był kasowany przez
 * `setTimeout(100ms)`, którego sprzątanie efektu (`clearTimeout`) usuwało przy
 * najbliższym re-renderze — a ten następował natychmiast po
 * `setActiveConversation`. Flaga zostawała `true` na zawsze i trwale wyłączała
 * synchronizację Store → URL.
 */

const harness = vi.hoisted(() => {
  const state: Record<string, any> = {
    activeConversationId: null,
    activeMessages: [],
    isLoading: false,
    setActiveConversation: vi.fn(),
    fetchConversation: vi.fn(),
    clearActiveChat: vi.fn(),
    _activeConversationState: null,
  };
  const useConversationStore = (selector?: (s: any) => unknown) =>
    selector ? selector(state) : state;
  return { state, useConversationStore, isConversationMarkedMissing: vi.fn(() => false) };
});

vi.mock('../../../store/useConversationStore', () => ({
  useConversationStore: harness.useConversationStore,
  isConversationMarkedMissing: harness.isConversationMarkedMissing,
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { ConversationRouteSync } from '../ConversationRouteSync';

const OLD_ID = '11111111-1111-4111-8111-111111111111';
const NEW_ID = '22222222-2222-4222-8222-222222222222';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chat" element={<ConversationRouteSync />} />
        <Route path="/chat/:conversationId" element={<ConversationRouteSync />} />
      </Routes>
    </MemoryRouter>
  );

describe('ConversationRouteSync — „Nowa rozmowa" (uwaga Tomka IX)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    harness.state.activeConversationId = null;
    harness.state.activeMessages = [];
    harness.state.isLoading = false;
    harness.state._activeConversationState = null;
    harness.state.setActiveConversation = vi.fn();
    harness.state.fetchConversation = vi.fn();
    harness.state.clearActiveChat = vi.fn();
  });

  it('po wejściu z adresu aktywuje rozmowę ze ścieżki', async () => {
    renderAt(`/chat/${OLD_ID}`);
    await waitFor(() => expect(harness.state.setActiveConversation).toHaveBeenCalledWith(OLD_ID));
  });

  it('„Nowa rozmowa" przestawia ADRES na nową rozmowę, nie zostawia starego id', async () => {
    const { rerender } = renderAt(`/chat/${OLD_ID}`);
    await waitFor(() => expect(harness.state.setActiveConversation).toHaveBeenCalledWith(OLD_ID));

    // store potwierdza aktywację rozmowy ze ścieżki
    harness.state.activeConversationId = OLD_ID;
    harness.state.activeMessages = [{ id: 'm1' }];
    rerender(
      <MemoryRouter initialEntries={[`/chat/${OLD_ID}`]}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ConversationRouteSync />} />
        </Routes>
      </MemoryRouter>
    );
    navigateMock.mockClear();

    // klik „+": clearActiveChat() zeruje aktywną rozmowę
    harness.state.activeConversationId = null;
    harness.state.activeMessages = [];
    rerender(
      <MemoryRouter initialEntries={[`/chat/${OLD_ID}`]}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ConversationRouteSync />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/chat', { replace: true }));
  });

  it('gdy store dostaje nową rozmowę, adres idzie za nią', async () => {
    const { rerender } = renderAt('/chat');
    harness.state.activeConversationId = NEW_ID;
    rerender(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ConversationRouteSync />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(`/chat/${NEW_ID}`, { replace: true })
    );
  });
});
