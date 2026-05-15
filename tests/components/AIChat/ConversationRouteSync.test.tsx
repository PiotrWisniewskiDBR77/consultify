/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const setActiveConversationMock = vi.fn();
const clearActiveChatMock = vi.fn();

const routeState: { conversationId?: string } = {};
const conversationState: { activeConversationId: string | null; _activeConversationState: string } = {
  activeConversationId: null,
  _activeConversationState: 'loaded',
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => routeState,
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: {
    activeConversationId: string | null;
    _activeConversationState: string;
    setActiveConversation: typeof setActiveConversationMock;
    clearActiveChat: typeof clearActiveChatMock;
  }) => unknown) =>
    selector({
      activeConversationId: conversationState.activeConversationId,
      _activeConversationState: conversationState._activeConversationState,
      setActiveConversation: setActiveConversationMock,
      clearActiveChat: clearActiveChatMock,
    }),
}));

describe('ConversationRouteSync', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setActiveConversationMock.mockReset();
    clearActiveChatMock.mockReset();
    routeState.conversationId = undefined;
    conversationState.activeConversationId = null;
    conversationState._activeConversationState = 'loaded';
  });

  it('does not redirect away from /chat on initial mount when a conversation is already restored in store', async () => {
    conversationState.activeConversationId = 'conv-restored';

    const { ConversationRouteSync } = await import('../../../src/components/AIChat/ConversationRouteSync');
    render(<ConversationRouteSync />);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to /chat/:conversationId after the user activates a conversation from /chat', async () => {
    const { ConversationRouteSync } = await import('../../../src/components/AIChat/ConversationRouteSync');
    const view = render(<ConversationRouteSync />);

    expect(navigateMock).not.toHaveBeenCalled();

    conversationState.activeConversationId = 'conv-selected';
    view.rerender(<ConversationRouteSync />);

    expect(navigateMock).toHaveBeenCalledWith('/chat/conv-selected', { replace: true });
  });

  it('hydrates the store from /chat/:conversationId', async () => {
    routeState.conversationId = 'conv-deeplink';

    const { ConversationRouteSync } = await import('../../../src/components/AIChat/ConversationRouteSync');
    render(<ConversationRouteSync />);

    expect(setActiveConversationMock).toHaveBeenCalledWith('conv-deeplink');
  });

  it('clears dead deep-link conversation and routes back to /chat', async () => {
    routeState.conversationId = 'conv-missing';
    conversationState.activeConversationId = 'conv-missing';
    conversationState._activeConversationState = 'loaded';

    const { ConversationRouteSync } = await import('../../../src/components/AIChat/ConversationRouteSync');
    const view = render(<ConversationRouteSync />);

    conversationState._activeConversationState = 'not_found';
    conversationState.activeConversationId = null;
    view.rerender(<ConversationRouteSync />);

    expect(clearActiveChatMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/chat', { replace: true });
  });
});
