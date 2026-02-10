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

import { useCallback } from 'react';

import { useConversationStore } from '../store/useConversationStore';

export interface OpenChatOptions {
  /** Type of entity: initiative, task, assessment, decision, report, etc. */
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
  };
}

export function useOpenChatWithContext() {
  const { activeConversationId, conversations, createConversation, setWorkspaceContext } =
    useConversationStore();

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
        (existingPmoCtx?.initiativeIds || []).includes(entityId);

      if (alreadyHasContext && activeConversationId) {
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

      const conv = await createConversation({
        title,
        pmoContext: pmoContext || {
          assessmentId: entityType === 'assessment' ? entityId : undefined,
          initiativeIds: entityType === 'initiative' ? [entityId] : undefined,
          taskId: entityType === 'task' ? entityId : undefined,
          decisionId: entityType === 'decision' ? entityId : undefined,
          reportId: entityType === 'report' ? entityId : undefined,
        },
      });

      // Set workspace context with full entity data
      setWorkspaceContext({
        type: entityType as any,
        entityId,
        entityName: entityName || entityType,
        entityData: contextData || {},
      } as any);

      return conv.id;
    },
    [activeConversationId, conversations, createConversation, setWorkspaceContext]
  );
}

export default useOpenChatWithContext;
