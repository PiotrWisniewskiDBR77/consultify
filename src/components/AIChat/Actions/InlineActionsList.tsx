/**
 * InlineActionsList
 *
 * Displays a list of AI-proposed actions inline within chat messages.
 * Compact design that doesn't disrupt the chat flow.
 *
 * @version 1.0.0
 */

import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIActionsStore } from '../../../store/useAIActionsStore';
import { AIAction, AIActionPayload } from '../../../types/aiActions';
import { AIActionCard } from './AIActionCard';

// ============================================================================
// Props
// ============================================================================

interface InlineActionsListProps {
  actions: AIAction[];
  maxVisible?: number;
  compact?: boolean;
  onActionComplete?: (actionId: string, success: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export const InlineActionsList: React.FC<InlineActionsListProps> = ({
  actions,
  maxVisible = 3,
  compact = true,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());

  const { approveAction, dismissAction, openEditModal } = useAIActionsStore();

  // Filter to show only relevant actions
  const pendingActions = actions.filter((a) => a.status === 'proposed');
  const completedActions = actions.filter((a) =>
    ['executed', 'dismissed', 'failed'].includes(a.status)
  );

  const visiblePending = isExpanded ? pendingActions : pendingActions.slice(0, maxVisible);
  const hiddenCount = pendingActions.length - maxVisible;

  if (actions.length === 0) {
    return null;
  }

  const handleApprove = async (actionId: string) => {
    setExecutingIds((prev) => new Set(prev).add(actionId));
    try {
      const result = await approveAction(actionId);
      onActionComplete?.(actionId, result.success);
    } finally {
      setExecutingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const handleDismiss = async (actionId: string) => {
    await dismissAction(actionId);
    onActionComplete?.(actionId, false);
  };

  const handleEdit = (actionId: string) => {
    openEditModal(actionId);
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Header */}
      {pendingActions.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Zap size={12} className="text-amber-500" />
          <span>
            {t('aiActions.proposedActions', 'Proponowane akcje')} ({pendingActions.length})
          </span>
        </div>
      )}

      {/* Pending Actions */}
      <div className="space-y-1.5">
        {visiblePending.map((action) => (
          <AIActionCard
            key={action.id}
            action={action}
            onApprove={handleApprove}
            onEdit={handleEdit}
            onDismiss={handleDismiss}
            compact={compact}
            isExecuting={executingIds.has(action.id)}
          />
        ))}
      </div>

      {/* Show more/less toggle */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-c-text-secondary dark:text-c-text-secondary hover:text-c-text dark:hover:text-c-text transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={12} />
              {t('common.showLess', 'Pokaż mniej')}
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              {t('aiActions.showMore', 'Pokaż więcej')} (+{hiddenCount})
            </>
          )}
        </button>
      )}

      {/* Recently completed actions (collapsed) */}
      {completedActions.length > 0 && !isExpanded && (
        <div className="text-[10px] text-slate-600 dark:text-slate-500">
          {completedActions.filter((a) => a.status === 'executed').length > 0 && (
            <span className="text-green-500">
              ✓ {completedActions.filter((a) => a.status === 'executed').length}{' '}
              {t('aiActions.completed', 'wykonane')}
            </span>
          )}
          {completedActions.filter((a) => a.status === 'dismissed').length > 0 && (
            <span className="ml-2 text-slate-600">
              {completedActions.filter((a) => a.status === 'dismissed').length}{' '}
              {t('aiActions.dismissed', 'odrzucone')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Message Actions Wrapper
// ============================================================================

interface MessageActionsProps {
  messageId: string;
  conversationId: string;
}

/**
 * Wrapper component that fetches actions for a specific message
 */
export const MessageActions: React.FC<MessageActionsProps> = ({ messageId, conversationId }) => {
  const { actions } = useAIActionsStore();

  // Filter actions for this message
  const messageActions = actions.filter(
    (a) => a.messageId === messageId && a.conversationId === conversationId
  );

  if (messageActions.length === 0) {
    return null;
  }

  return <InlineActionsList actions={messageActions} />;
};

export default InlineActionsList;
