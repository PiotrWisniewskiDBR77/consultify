/**
 * Bidirectional event bridge between Teresa (AI chat) and Ideas workspace tools.
 *
 * Chat → Ideas: via 'idea-workspace-quick-action' CustomEvent (already exists)
 * Ideas → Chat: via 'idea-tool-status' CustomEvent (new)
 *
 * This hook listens for chat commands and emits status events back,
 * enabling Teresa to create/modify canvas content and receive confirmations.
 */

import { useCallback, useEffect } from 'react';

import type { IdeasToolType } from './useIdeasToolDefaults';

export interface IdeaToolStatusPayload {
  ideaId: string;
  toolType: IdeasToolType;
  action: string;
  nodeId?: string;
  status: 'started' | 'completed' | 'error';
  message?: string;
}

export const IDEA_TOOL_STATUS_EVENT = 'idea-tool-status';

export function emitIdeaToolStatus(payload: IdeaToolStatusPayload): void {
  window.dispatchEvent(
    new CustomEvent(IDEA_TOOL_STATUS_EVENT, { detail: payload })
  );
}

export interface UseIdeasTeresaBridgeOptions {
  ideaId: string;
  toolType: IdeasToolType;
  enabled?: boolean;
  onQuickAction?: (action: string, detail: Record<string, unknown>) => void;
}

/**
 * Hook for Ideas workspace tools to participate in the Teresa bridge.
 * Listens for 'idea-workspace-quick-action' and routes to tool-specific handler.
 */
export function useIdeasTeresaBridge({
  ideaId,
  toolType,
  enabled = true,
  onQuickAction,
}: UseIdeasTeresaBridgeOptions) {
  const emitStatus = useCallback(
    (action: string, status: IdeaToolStatusPayload['status'], extra?: { nodeId?: string; message?: string }) => {
      emitIdeaToolStatus({
        ideaId,
        toolType,
        action,
        status,
        ...extra,
      });
    },
    [ideaId, toolType]
  );

  useEffect(() => {
    if (!enabled || !onQuickAction) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.action) return;
      onQuickAction(detail.action, detail);
    };

    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [enabled, onQuickAction]);

  return { emitStatus };
}
