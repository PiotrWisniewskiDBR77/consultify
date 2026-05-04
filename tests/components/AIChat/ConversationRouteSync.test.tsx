import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerState = vi.hoisted(() => ({
  params: {} as { conversationId?: string },
  pathname: '/chat',
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: routerState.pathname }),
  useNavigate: () => routerState.navigate,
  useParams: () => routerState.params,
}));

describe('ConversationRouteSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    routerState.params = {};
    routerState.pathname = '/chat';
    const { useConversationStore } = await import('../../../src/store/useConversationStore');
    useConversationStore.setState({
      activeConversationId: null,
      activeMessages: [],
      isLoading: false,
    });
  });

  it('lets a newly created chat on /chat navigate to its conversation route', async () => {
    const { useConversationStore } = await import('../../../src/store/useConversationStore');
    const { ConversationRouteSync } = await import(
      '../../../src/components/AIChat/ConversationRouteSync'
    );

    useConversationStore.setState({
      activeConversationId: 'conversation-id',
      activeMessages: [],
      isLoading: false,
    });

    render(<ConversationRouteSync />);

    await waitFor(() => {
      expect(routerState.navigate).toHaveBeenCalledWith('/chat/conversation-id', {
        replace: true,
      });
    });
    expect(useConversationStore.getState().activeConversationId).toBe('conversation-id');
  });

  it('does not let active chat state redirect non-chat module routes', async () => {
    routerState.pathname = '/ai/artifacts';
    const { useConversationStore } = await import('../../../src/store/useConversationStore');
    const { ConversationRouteSync } = await import(
      '../../../src/components/AIChat/ConversationRouteSync'
    );

    useConversationStore.setState({
      activeConversationId: 'conversation-id',
      activeMessages: [],
      isLoading: false,
    });

    render(<ConversationRouteSync />);

    await waitFor(() => {
      expect(routerState.navigate).not.toHaveBeenCalled();
    });
  });

  it('redirects a known missing conversation route without fetching it again', async () => {
    routerState.pathname = '/chat/missing-conversation';
    routerState.params = { conversationId: 'missing-conversation' };
    localStorage.setItem('consultify-missing-conversations', JSON.stringify(['missing-conversation']));
    const { useConversationStore } = await import('../../../src/store/useConversationStore');
    const fetchConversation = vi.fn();
    useConversationStore.setState({
      activeConversationId: 'missing-conversation',
      activeMessages: [],
      isLoading: false,
      fetchConversation,
    });
    const { ConversationRouteSync } = await import(
      '../../../src/components/AIChat/ConversationRouteSync'
    );

    render(<ConversationRouteSync />);

    await waitFor(() => {
      expect(routerState.navigate).toHaveBeenCalledWith('/chat', { replace: true });
    });
    expect(fetchConversation).not.toHaveBeenCalled();
    expect(useConversationStore.getState().activeConversationId).toBeNull();
  });
});
