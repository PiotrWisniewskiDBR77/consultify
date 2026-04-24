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
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);

  // Guard to prevent Store→URL sync from firing right after URL→Store sync
  const syncingFromUrl = useRef(false);
  // When the user intentionally lands on `/chat`, let the welcome screen
  // render first instead of bouncing to the last restored conversation.
  const skipInitialBaseRouteRedirect = useRef(!conversationId);

  // URL → Store sync
  useEffect(() => {
    if (!conversationId || conversationId === activeConversationId) {
      return;
    }

    syncingFromUrl.current = true;
    setActiveConversation(conversationId);
    // Reset flag after a tick so Store→URL effect doesn't fire for this change
    const timer = setTimeout(() => {
      syncingFromUrl.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [conversationId, activeConversationId, setActiveConversation]);

  // Store → URL sync (only when user changes conversation via UI, not from URL sync)
  useEffect(() => {
    if (syncingFromUrl.current) return;

    if (!conversationId) {
      if (skipInitialBaseRouteRedirect.current) {
        skipInitialBaseRouteRedirect.current = false;
        return;
      }

      if (activeConversationId) {
        navigate(`/chat/${activeConversationId}`, { replace: true });
      }
      return;
    }

    if (activeConversationId && activeConversationId !== conversationId) {
      navigate(`/chat/${activeConversationId}`, { replace: true });
    } else if (!activeConversationId && conversationId) {
      // User cleared active conversation (new chat) — go back to /chat
      navigate('/chat', { replace: true });
    }
  }, [activeConversationId, conversationId, navigate]);

  return null;
};
