import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useConversationStore } from '../../store/useConversationStore';

/**
 * ConversationRouteSync
 *
 * Bidirectional sync between the URL param `:conversationId` and
 * the conversation store's `activeConversationId`.
 *
 * - URL → Store: when navigating to `/chat/:conversationId`, activates that conversation.
 * - Store → URL: when user switches conversation (e.g. sidebar click), updates the URL.
 *
 * Renders nothing — logic-only component.
 */
export const ConversationRouteSync: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeMessagesCount = useConversationStore((s) => s.activeMessages.length);
  const isLoading = useConversationStore((s) => s.isLoading);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const fetchConversation = useConversationStore((s) => s.fetchConversation);
  const clearActiveChat = useConversationStore((s) => s.clearActiveChat);

  // Guard to prevent Store→URL sync from firing right after URL→Store sync
  const syncingFromUrl = useRef(false);
  const ensuredConversationId = useRef<string | null>(null);

  // URL → Store sync
  useEffect(() => {
    if (!conversationId) {
      if (activeConversationId) {
        syncingFromUrl.current = true;
        clearActiveChat();
        const timer = setTimeout(() => {
          syncingFromUrl.current = false;
        }, 100);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (conversationId === activeConversationId) {
      if (
        !isLoading &&
        activeMessagesCount === 0 &&
        ensuredConversationId.current !== conversationId
      ) {
        ensuredConversationId.current = conversationId;
        void fetchConversation(conversationId);
      }
      return;
    }

    ensuredConversationId.current = conversationId;
    syncingFromUrl.current = true;
    setActiveConversation(conversationId);
    // Reset flag after a tick so Store→URL effect doesn't fire for this change
    const timer = setTimeout(() => {
      syncingFromUrl.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [
    conversationId,
    activeConversationId,
    activeMessagesCount,
    isLoading,
    fetchConversation,
    setActiveConversation,
    clearActiveChat,
  ]);

  // Store → URL sync (only when user changes conversation via UI, not from URL sync)
  useEffect(() => {
    if (syncingFromUrl.current) return;

    if (activeConversationId && activeConversationId !== conversationId) {
      navigate(`/chat/${activeConversationId}`, { replace: true });
    } else if (!activeConversationId && conversationId) {
      // User cleared active conversation (new chat) — go back to /chat
      navigate('/chat', { replace: true });
    }
  }, [activeConversationId, conversationId, navigate]);

  return null;
};
