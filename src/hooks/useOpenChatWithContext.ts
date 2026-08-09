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
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';

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
  const { activeConversationId, conversations, createConversation, setWorkspaceContext } =
    useConversationStore();

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

      if ((alreadyHasContext || options.reuseActiveConversation) && activeConversationId) {
        // Already in context — just update workspace context
        setWorkspaceContext({
          type: entityType as any,
          entityId,
          entityName: entityName || entityType,
          entityData: contextData || {},
        } as any);
        return activeConversationId;
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

      // Module-level Teresa prompts (e.g. FinanceHub.buildFinanceTeresaPrompt) live in
      // contextData.teresaPrompt. Stash them so the chat composer can pick them up as a
      // pre-filled opener instead of dropping them on the floor.
      try {
        let teresaPrompt = (contextData as any)?.teresaPrompt;

        // Sidekick bridge (M06 Fala 2 §2.1): when opening chat for the idea the
        // mind map is currently reporting on, append its detected intent/prompt
        // hint so Teresa's kickoff reflects what the user was doing on the map
        // (e.g. "expanding_branch" → "Expand this branch with more ideas").
        // The graph itself is NOT carried here — that still flows exclusively
        // through ideaMapToMarkdown at the "Discuss with Teresa" call site.
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
              conversationId: conv.id,
              ts: Date.now(),
            })
          );
          // Notify any mounted composer to consume the pending prompt
          window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
        }
      } catch {
        // Non-critical
      }

      return conv.id;
    },
    [
      activeConversationId,
      conversations,
      createConversation,
      isChatCollapsed,
      isDesktop,
      isMobile,
      isTablet,
      mindmapBridgeEnabled,
      navigate,
      navigateFn,
      setCurrentViewState,
      setWorkspaceContext,
      toggleChatCollapse,
    ]
  );
}

export default useOpenChatWithContext;
