import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  isConversationMarkedMissing,
  useConversationStore,
} from '../../store/useConversationStore';

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
  const location = useLocation();
  const navigate = useNavigate();
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeMessagesCount = useConversationStore((s) => s.activeMessages.length);
  const isLoading = useConversationStore((s) => s.isLoading);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const fetchConversation = useConversationStore((s) => s.fetchConversation);
  const clearActiveChat = useConversationStore((s) => s.clearActiveChat);
  const activeConversationState = useConversationStore((s) => s._activeConversationState);

  // Guard to prevent Store→URL sync from firing right after URL→Store sync
  const syncingFromUrl = useRef(false);
  const ensuredConversationId = useRef<string | null>(null);
  const notFoundHandledRef = useRef(false);
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isChatRoute = normalizedPath === '/chat' || normalizedPath.startsWith('/chat/');

  useEffect(() => {
    if (!activeConversationId) return;
    try {
      window.sessionStorage.setItem('teresa.lastActiveConversationId', activeConversationId);
    } catch {
      // Session continuity is an enhancement; storage denial must not block chat.
    }
  }, [activeConversationId]);

  // URL → Store sync
  useEffect(() => {
    if (!isChatRoute) return;

    if (!conversationId) {
      // Base /chat is also the starting point for a new send. When
      // createConversation() sets activeConversationId, the Store -> URL effect
      // below must navigate to /chat/:id.
      return;
    }

    if (isConversationMarkedMissing(conversationId)) {
      ensuredConversationId.current = null;
      syncingFromUrl.current = false;
      clearActiveChat();
      navigate('/chat', { replace: true });
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
    isChatRoute,
    activeConversationId,
    activeMessagesCount,
    isLoading,
    clearActiveChat,
    fetchConversation,
    navigate,
    setActiveConversation,
  ]);

  useEffect(() => {
    if (!conversationId) {
      notFoundHandledRef.current = false;
      return;
    }
    if (activeConversationState !== 'not_found') {
      notFoundHandledRef.current = false;
      return;
    }
    if (notFoundHandledRef.current) return;

    notFoundHandledRef.current = true;
    clearActiveChat();
    navigate('/chat', { replace: true });
  }, [activeConversationState, clearActiveChat, conversationId]);

  // Store → URL sync (only when user changes conversation via UI, not from URL sync)
  useEffect(() => {
    if (!isChatRoute) return;
    if (syncingFromUrl.current) return;

    if (activeConversationId && activeConversationId !== conversationId) {
      navigate(`/chat/${activeConversationId}`, { replace: true });
    } else if (!activeConversationId && conversationId) {
      // User cleared active conversation (new chat) — go back to /chat
      navigate('/chat', { replace: true });
    }
  }, [activeConversationId, conversationId, isChatRoute, navigate]);

  return null;
};
