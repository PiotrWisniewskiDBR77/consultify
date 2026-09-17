/**
 * useOpenChatWithContext — Standardized hook for opening AI chat with entity context.
 *
 * This provides a consistent pattern for the "Chat" button across all modules:
 * 1. If active conversation already has this entity's context → just open/expand the panel
 * 2. If different context → create new conversation with pmoContext + workspaceContext
 * 3. Chat panel opens in split mode
 *
 * Usage in any module view:
 *   const openChat = useOpenChatWithContext();
 *   openChat({ entityType: 'initiative', entityId: id, entityName: 'My Initiative', ... });
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { AppView } from '@/types';

import type { SidekickContextEventDetail } from '../components/MyWork/mindmap/aiSidekickContext';
import { getRouteFromAppView } from '../routes/routeConfig';
import { trimPinnedEntityData } from '../store/teresaEntityContext';
import { useAppStore } from '../store/useAppStore';
import { isConversationMarkedMissing, useConversationStore } from '../store/useConversationStore';

export interface OpenChatOptions {
  /** Type of entity: initiative, task, assessment, decision, report, idea, etc. */
  entityType: string;
  /** ID of the entity */
  entityId: string;
  /** Human-readable name for the conversation title */
  entityName?: string;
  /** Additional context data to send with workspace context */
  contextData?: Record<string, unknown>;
  /** PMO context fields */
  pmoContext?: {
    assessmentId?: string;
    initiativeIds?: string[];
    roadmapId?: string;
    taskId?: string;
    decisionId?: string;
    reportId?: string;
    kpiId?: string;
    /** Ideas / Mind Map entity-context (M06 Fala 2 §2.1) */
    ideaId?: string;
  };
  /** Keep the active Teresa conversation while replacing its screen context. */
  reuseActiveConversation?: boolean;
}

/** window CustomEvent name for the mindmap AI-sidekick bridge — see aiSidekickContext.ts */
const SIDEKICK_CONTEXT_EVENT = 'idea-mindmap-sidekick-context';

// Burst guard (feedback f9fba1e0 — four "Notification: Skrzynka" conversations created
// within 3 seconds): for entity types without pmoContext fields (e.g. 'notification'),
// `alreadyHasContext` below can never match, so every click used to create a fresh
// conversation. Collapse rapid repeat opens of the SAME entity onto one creation.
const recentEntityConversations = new Map<
  string,
  { promise: Promise<{ id: string }>; ts: number }
>();
const ENTITY_CONVERSATION_REUSE_WINDOW_MS = 30_000;

export function useOpenChatWithContext() {
  const {
    activeConversationId,
    conversations,
    createConversation,
    fetchConversation,
    setActiveConversation,
    setWorkspaceContext,
    setTeresaEntityContext,
  } = useConversationStore();

  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const setCurrentViewState = useAppStore((s) => s.setCurrentViewState);
  const navigateFn = useAppStore((s) => s.navigateFn);
  const navigate = useNavigate();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const { isEnabled } = useFeatureFlagsContext();
  const mindmapBridgeEnabled = isEnabled('ENABLE_TERESA_MINDMAP');

  // Sidekick→chat bridge (M06 Fala 2 §2.1): the mind map dispatches its latest
  // intent/promptHint/ideaId on every relevant change. We only need the most
  // recent value at the moment the caller opens chat for an 'idea' entity, so
  // a ref (not state) avoids re-rendering consumers on every map edit.
  const latestSidekickContextRef = useRef<SidekickContextEventDetail | null>(null);
  useEffect(() => {
    if (!mindmapBridgeEnabled) return;
    const handler = (event: Event) => {
      latestSidekickContextRef.current = (event as CustomEvent).detail || null;
    };
    window.addEventListener(SIDEKICK_CONTEXT_EVENT, handler);
    return () => window.removeEventListener(SIDEKICK_CONTEXT_EVENT, handler);
  }, [mindmapBridgeEnabled]);

  return useCallback(
    async (options: OpenChatOptions) => {
      const { entityType, entityId, entityName, contextData, pmoContext } = options;

      // ── „JEDNA TERESA" 2026-09-01: PRZYPIĘCIE KONTEKSTU OBIEKTU ─────────
      // `setWorkspaceContext` niżej NIE WYSTARCZA: `MainLayout` przelicza
      // `workspaceContext` z trasy przy najbliższym renderze i nadpisuje encję
      // (MainLayout.tsx:155-196, :485-489), a pełne okno `/chat` w ogóle nie
      // dostaje propsa. Dlatego równolegle przypinamy kontekst do WŁASNEGO,
      // persystowanego pola store'u — patrz src/store/teresaEntityContext.ts.
      // Ścieżkę łapiemy TERAZ, przed ewentualną nawigacją na /chat (mobile),
      // żeby `originPath` niósł trasę OBIEKTU, a nie trasę czatu.
      const originPath =
        typeof window !== 'undefined' && window.location ? window.location.pathname : null;
      const pinEntityContext = (conversationId: string | null) => {
        try {
          setTeresaEntityContext({
            type: entityType,
            entityId,
            entityName: entityName || entityType,
            // Przycięte: pin jest persystowany, a `contextData` u części
            // wołaczy niesie cały markdown ekranu (`teresaPrompt`).
            entityData: trimPinnedEntityData(contextData),
            conversationId,
            originPath,
            ts: Date.now(),
          });
        } catch {
          // Kontekst to wzmocnienie, nie warunek otwarcia okna — nie blokuj.
        }
      };

      // Deliver the caller's prompt on EVERY invocation, including when we
      // reuse the active Teresa conversation. Previously this lived only
      // after `createConversation`; the reuse branch returned earlier, so a
      // second "Ask Teresa" click opened the dock but silently dropped the
      // new question.
      const queueTeresaPrompt = (conversationId: string) => {
        try {
          let teresaPrompt = (contextData as any)?.teresaPrompt;

          // Sidekick bridge (M06 Fala 2 §2.1): when opening chat for the idea the
          // mind map is currently reporting on, append its detected intent/prompt
          // hint so Teresa's kickoff reflects what the user was doing on the map.
          if (mindmapBridgeEnabled && entityType === 'idea') {
            const sidekick = latestSidekickContextRef.current;
            if (sidekick && sidekick.ideaId === entityId && sidekick.promptHint) {
              teresaPrompt = teresaPrompt
                ? `${teresaPrompt}\n\n(${sidekick.promptHint})`
                : sidekick.promptHint;
            }
          }

          if (teresaPrompt && typeof teresaPrompt === 'string' && typeof window !== 'undefined') {
            window.sessionStorage.setItem(
              'consultify.teresa.pendingPrompt',
              JSON.stringify({
                prompt: teresaPrompt,
                entityType,
                entityId,
                entityName: entityName || null,
                conversationId,
                ts: Date.now(),
              })
            );
            window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
          }
        } catch {
          // Prompt prefill is non-critical; the chat must still open.
        }
      };

      // Check if current conversation already has this entity's context
      const activeConv = conversations.find((c) => c.id === activeConversationId);
      const existingPmoCtx = (activeConv as any)?.pmoContext;
      const alreadyHasContext =
        existingPmoCtx?.assessmentId === entityId ||
        existingPmoCtx?.taskId === entityId ||
        existingPmoCtx?.decisionId === entityId ||
        existingPmoCtx?.reportId === entityId ||
        (mindmapBridgeEnabled && entityType === 'idea' && existingPmoCtx?.ideaId === entityId) ||
        existingPmoCtx?.kpiId === entityId ||
        (existingPmoCtx?.initiativeIds || []).includes(entityId);

      // Ensure chat UI becomes visible.
      // - Desktop: open split chat panel (MainLayout)
      // - Mobile/Tablet: navigate to full chat view (split panel is hidden below lg)
      if (!isDesktop || isMobile || isTablet) {
        try {
          setCurrentViewState(AppView.AI_CHAT);
          const route = getRouteFromAppView(AppView.AI_CHAT);
          if (navigateFn) {
            navigateFn(route);
          } else {
            navigate(route);
          }
        } catch {
          // non-blocking; conversation still gets created below
        }
      } else {
        // Desktop: ensure split chat panel is open.
        if (isChatCollapsed) {
          toggleChatCollapse();
        }
      }

      // ★ Uwaga Tomka XX (pilotaż 13.09): DRD → „Zapytaj Teresę" pokazywało
      // „Ta rozmowa nie istnieje lub została trwale usunięta". PRZYCZYNA
      // (odtworzona na żywo 14.09): wskaźnik `teresa.lastActiveConversationId`
      // z sessionStorage był brany NA WIARĘ. Gdy wskazywał rozmowę, której już
      // nie ma (inna organizacja, usunięty wątek, wyczyszczona baza), szliśmy
      // `setActiveConversation` → `GET /api/conversations/:id` → 404 → stan
      // `not_found`, zamiast po prostu założyć nową rozmowę z kontekstem
      // pytania. Dlatego wskaźnik z sessionStorage musi być ZWERYFIKOWANY, a
      // nieudana reaktywacja MUSI spaść do ścieżki tworzenia nowej rozmowy.
      // Read the store at click time. The callback can outlive the render that
      // created it, while a failed fetch can quarantine the captured active id
      // in the meantime. Reusing that stale closure is what surfaced as
      // "No such session" on the second DRD hand-off.
      const liveAtOpen = useConversationStore.getState();
      let reusableConversationId = liveAtOpen.activeConversationId;
      let rejectedConversationId: string | null = null;
      if (
        reusableConversationId &&
        (isConversationMarkedMissing(reusableConversationId) ||
          (liveAtOpen.activeConversationId === reusableConversationId &&
            liveAtOpen._activeConversationState === 'not_found'))
      ) {
        rejectedConversationId = reusableConversationId;
        reusableConversationId = null;
      }
      if (!reusableConversationId && options.reuseActiveConversation) {
        try {
          const stored = window.sessionStorage.getItem('teresa.lastActiveConversationId');
          if (stored && !rejectedConversationId) {
            if (isConversationMarkedMissing(stored)) {
              rejectedConversationId = stored;
            } else {
              reusableConversationId = stored;
            }
          }
        } catch {
          reusableConversationId = null;
        }
      }

      if ((alreadyHasContext || options.reuseActiveConversation) && reusableConversationId) {
        let reusable = true;
        if (reusableConversationId !== liveAtOpen.activeConversationId) {
          setActiveConversation(reusableConversationId);
          await fetchConversation(reusableConversationId);
          const after = useConversationStore.getState();
          const state = after._activeConversationState;
          if (
            after.activeConversationId &&
            after.activeConversationId !== reusableConversationId &&
            (state === null || state === 'active')
          ) {
            // A newer user choice won the race while the stored conversation
            // was being verified. The delayed click is now superseded: do not
            // inject its context or prompt into the conversation the user chose.
            return after.activeConversationId;
          } else {
            reusable =
              after.activeConversationId === reusableConversationId &&
              (state === null || state === 'active');
          }
        }

        if (reusable) {
          // Already in context — just update workspace context
          setWorkspaceContext({
            type: entityType as any,
            entityId,
            entityName: entityName || entityType,
            entityData: contextData || {},
          } as any);
          pinEntityContext(reusableConversationId);
          queueTeresaPrompt(reusableConversationId);
          return reusableConversationId;
        }

        rejectedConversationId = reusableConversationId;
      }

      if (rejectedConversationId) {
        // Wskaźnik prowadził donikąd — sprzątamy wyłącznie tę wartość. Podczas
        // await użytkownik mógł już wybrać nowszą rozmowę; nie wolno jej
        // wyczyścić razem ze starym 404.
        try {
          if (
            window.sessionStorage.getItem('teresa.lastActiveConversationId') ===
            rejectedConversationId
          ) {
            window.sessionStorage.removeItem('teresa.lastActiveConversationId');
          }
        } catch {
          // brak sessionStorage nie może blokować otwarcia czatu
        }
        const liveAfterRejection = useConversationStore.getState();
        if (
          liveAfterRejection.activeConversationId === rejectedConversationId ||
          liveAfterRejection.activeConversationId === null
        ) {
          liveAfterRejection.clearActiveChat();
        }
      }

      // Create new conversation with entity context
      const title = entityName
        ? `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}: ${entityName}`
        : `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Chat`;

      const entityKey = `${entityType}:${entityId}`;
      const recent = recentEntityConversations.get(entityKey);
      let conv: { id: string };
      if (recent && Date.now() - recent.ts < ENTITY_CONVERSATION_REUSE_WINDOW_MS) {
        conv = await recent.promise;
        // createConversation activates the new conversation itself; mirror that
        // for the reused one so the kickoff message lands in it.
        if (useConversationStore.getState().activeConversationId !== conv.id) {
          useConversationStore.getState().setActiveConversation(conv.id);
        }
      } else {
        const promise = createConversation({
          title,
          pmoContext: pmoContext || {
            assessmentId: entityType === 'assessment' ? entityId : undefined,
            initiativeIds: entityType === 'initiative' ? [entityId] : undefined,
            taskId: entityType === 'task' ? entityId : undefined,
            decisionId: entityType === 'decision' ? entityId : undefined,
            reportId: entityType === 'report' ? entityId : undefined,
            kpiId: entityType === 'kpi' ? entityId : undefined,
            ideaId: mindmapBridgeEnabled && entityType === 'idea' ? entityId : undefined,
          },
        });
        recentEntityConversations.set(entityKey, { promise, ts: Date.now() });
        try {
          conv = await promise;
        } catch (err) {
          // Failed creations must not poison the reuse window.
          recentEntityConversations.delete(entityKey);
          throw err;
        }
      }

      // Set workspace context with full entity data
      setWorkspaceContext({
        type: entityType as any,
        entityId,
        entityName: entityName || entityType,
        entityData: contextData || {},
      } as any);
      pinEntityContext(conv.id);
      queueTeresaPrompt(conv.id);

      return conv.id;
    },
    [
      activeConversationId,
      conversations,
      createConversation,
      fetchConversation,
      setActiveConversation,
      isChatCollapsed,
      isDesktop,
      isMobile,
      isTablet,
      mindmapBridgeEnabled,
      navigate,
      navigateFn,
      setCurrentViewState,
      setTeresaEntityContext,
      setWorkspaceContext,
      toggleChatCollapse,
    ]
  );
}

export default useOpenChatWithContext;
