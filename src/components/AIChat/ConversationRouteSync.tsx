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

  // Uwaga Tomka IX (pilotaż 13.09): „mimo rozpoczęcia nowej rozmowy okno
  // przeskakuje do ostatniego Chatu". PRZYCZYNA (zmierzona na żywo 14.09):
  // poprzedni bezpiecznik `syncingFromUrl` gasł dopiero w `setTimeout(100ms)`,
  // a sprzątanie efektu kasowało ten timer przy najbliższym re-renderze — ten
  // zaś następował NATYCHMIAST po `setActiveConversation`. Flaga zostawała
  // `true` do końca życia komponentu i trwale wyłączała kierunek Store → URL:
  // adres zostawał na starej rozmowie, więc każde ponowne zamontowanie trasy
  // (powrót, przeładowanie) wczytywało z powrotem STARĄ rozmowę.
  //
  // Dziś zamiast wyścigu z zegarem pytamy wprost: czy zmienił się ADRES, czy
  // store. `lastUrlConversationId` pamięta ostatnio zobaczony parametr trasy —
  // URL → Store działa tylko, gdy to adres się zmienił. `pendingUrlActivation`
  // wstrzymuje kierunek Store → URL wyłącznie do czasu, aż store dogoni
  // rozmowę zażądaną adresem (inaczej deep link odbijałby do poprzedniej).
  const lastUrlConversationId = useRef<string | undefined>(undefined);
  const pendingUrlActivation = useRef<string | null>(null);
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
    if (!isChatRoute) {
      // Poza trasą czatu adres nie niesie rozmowy — zapominamy go, żeby powrót
      // na `/chat/:id` liczył się jako zmiana adresu i został uszanowany.
      lastUrlConversationId.current = undefined;
      return;
    }

    const urlChanged = lastUrlConversationId.current !== conversationId;
    lastUrlConversationId.current = conversationId;

    if (!conversationId) {
      // Base /chat is also the starting point for a new send. When
      // createConversation() sets activeConversationId, the Store -> URL effect
      // below must navigate to /chat/:id.
      pendingUrlActivation.current = null;
      return;
    }

    if (isConversationMarkedMissing(conversationId)) {
      ensuredConversationId.current = null;
      pendingUrlActivation.current = null;
      clearActiveChat();
      navigate('/chat', { replace: true });
      return;
    }

    if (conversationId === activeConversationId) {
      pendingUrlActivation.current = null;
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

    // Rozjazd bez zmiany adresu = to STORE się przestawił (np. „Nowa rozmowa",
    // klik w historii). Wtedy prawdę niesie store i adres ma iść za nim —
    // efekt niżej. Ponowne aktywowanie rozmowy z adresu cofałoby użytkownika.
    if (!urlChanged) return;

    ensuredConversationId.current = conversationId;
    pendingUrlActivation.current = conversationId;
    setActiveConversation(conversationId);
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
    // Czekamy tylko na dogonienie rozmowy zażądanej ADRESEM (deep link) —
    // inaczej odbilibyśmy użytkownika z powrotem do poprzedniej rozmowy.
    if (
      pendingUrlActivation.current &&
      pendingUrlActivation.current !== activeConversationId
    ) {
      return;
    }

    if (activeConversationId && activeConversationId !== conversationId) {
      navigate(`/chat/${activeConversationId}`, { replace: true });
    } else if (!activeConversationId && conversationId) {
      // User cleared active conversation (new chat) — go back to /chat
      navigate('/chat', { replace: true });
    }
  }, [activeConversationId, conversationId, isChatRoute, navigate]);

  return null;
};
