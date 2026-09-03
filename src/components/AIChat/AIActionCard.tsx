/**
 * AIActionCard
 *
 * Card component for displaying AI-proposed actions.
 * Shows action type, description, and approve/edit/dismiss buttons.
 *
 * @version 1.0.0
 */

import {
  AlertTriangle,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Edit,
  ExternalLink,
  FileText,
  Flag,
  GitBranch,
  Lightbulb,
  Loader2,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AIAction,
  AIActionPayload,
  AIActionType,
  getActionTypeConfig,
  getRiskColor,
} from '../../types/aiActions';

// ============================================================================
// Types
// ============================================================================

interface AIActionCardProps {
  action: AIAction;
  onApprove: (actionId: string) => void;
  onEdit?: (actionId: string, editedPayload: AIActionPayload) => void;
  onDismiss: (actionId: string) => void;
  compact?: boolean;
  disabled?: boolean;
  isExecuting?: boolean;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const ACTION_ICONS: Record<string, React.ElementType> = {
  CheckSquare: CheckSquare,
  Edit: Edit,
  Lightbulb: Lightbulb,
  GitBranch: GitBranch,
  Calendar: Calendar,
  FileText: FileText,
  Bell: AlertTriangle,
  Target: Target,
  Flag: Flag,
  Users: Users,
  ExternalLink: ExternalLink,
  Zap: Zap,
};

// ============================================================================
// Color Classes
// ============================================================================

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
    },
    purple: {
      bg: 'bg-c-surface-raised dark:bg-c-surface-raised',
      text: 'text-c-text-secondary dark:text-c-text-secondary',
      border: 'border-c-border dark:border-c-border',
    },
    cyan: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
    },
    indigo: {
      bg: 'bg-c-surface-raised dark:bg-c-surface-raised',
      text: 'text-c-text-secondary dark:text-c-text-secondary',
      border: 'border-c-border dark:border-c-border',
    },
    orange: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
      border: 'border-danger-200 dark:border-danger-800',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    slate: {
      bg: 'bg-slate-50 dark:bg-slate-800/50',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
    },
    violet: {
      bg: 'bg-c-surface-raised dark:bg-c-surface-raised',
      text: 'text-c-text-secondary dark:text-c-text-secondary',
      border: 'border-c-border dark:border-c-border',
    },
  };

  return colors[color] || colors.slate;
};

// ============================================================================
// Component
// ============================================================================

export const AIActionCard: React.FC<AIActionCardProps> = ({
  action,
  onApprove,
  onEdit,
  onDismiss,
  compact = false,
  disabled = false,
  isExecuting = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const config = getActionTypeConfig(action.type);
  const Icon = ACTION_ICONS[config.icon] || Zap;
  const colorClasses = getColorClasses(config.color);
  const riskColor = getRiskColor(action.risk);

  // Get payload details for display
  const getPayloadSummary = (): string => {
    const { payload } = action;

    if (payload.task) {
      return payload.task.title;
    }
    if (payload.initiative) {
      return payload.initiative.title;
    }
    if (payload.decision) {
      return payload.decision.title;
    }
    if (payload.meeting) {
      return payload.meeting.title;
    }
    if (payload.report) {
      return `${payload.report.type} Report`;
    }
    if (payload.navigation) {
      return `Go to ${payload.navigation.view}`;
    }

    return action.description;
  };

  // Compact variant
  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border
          ${colorClasses.bg} ${colorClasses.border}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <Icon size={14} className={colorClasses.text} />
        <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {action.title}
        </span>

        {isExecuting ? (
          <Loader2 size={14} className="animate-spin text-c-text-secondary" />
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onApprove(action.id)}
              disabled={disabled}
              className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              title={t('aiActions.approve', 'Zatwierdź')}
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => onDismiss(action.id)}
              disabled={disabled}
              className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-danger-600 dark:text-danger-400"
              title={t('aiActions.dismiss', 'Odrzuć')}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full card variant
  return (
    <div
      className={`
        rounded-xl border overflow-hidden transition-all
        ${colorClasses.bg} ${colorClasses.border}
        ${disabled ? 'opacity-50' : 'hover:shadow-md'}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${colorClasses.bg} border ${colorClasses.border}`}>
          <Icon size={18} className={colorClasses.text} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {action.title}
            </h4>

            {/* Risk badge */}
            {action.risk !== 'low' && (
              <span
                className={`
                  text-[10px] px-1.5 py-0.5 rounded-full font-medium
                  ${riskColor === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : ''}
                  ${riskColor === 'red' ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400' : ''}
                `}
              >
                {action.risk === 'medium'
                  ? t('aiActions.mediumRisk', 'Średnie ryzyko')
                  : t('aiActions.highRisk', 'Wysokie ryzyko')}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{getPayloadSummary()}</p>

          {/* Type label */}
          <span className={`text-[10px] ${colorClasses.text} mt-1 inline-block`}>
            {config.label}
          </span>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600"
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700 pt-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            {/* Description */}
            <p>{action.description}</p>

            {/* Payload details */}
            {action.payload.task && (
              <div className="space-y-1">
                {action.payload.task.priority && (
                  <div>
                    <span className="font-medium">Priorytet:</span> {action.payload.task.priority}
                  </div>
                )}
                {action.payload.task.dueDate && (
                  <div>
                    <span className="font-medium">Termin:</span> {action.payload.task.dueDate}
                  </div>
                )}
              </div>
            )}

            {action.payload.initiative && (
              <div className="space-y-1">
                {action.payload.initiative.category && (
                  <div>
                    <span className="font-medium">Kategoria:</span>{' '}
                    {action.payload.initiative.category}
                  </div>
                )}
                {action.payload.initiative.estimatedEffort && (
                  <div>
                    <span className="font-medium">Estymacja:</span>{' '}
                    {action.payload.initiative.estimatedEffort}h
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {isExecuting ? (
          <div className="flex items-center gap-2 text-sm text-c-text-secondary dark:text-c-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            {t('aiActions.executing', 'Wykonywanie...')}
          </div>
        ) : (
          <>
            {/* Approve */}
            <button
              onClick={() => onApprove(action.id)}
              disabled={disabled}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 py-2
                bg-emerald-600 hover:bg-emerald-700 text-white
                rounded-lg text-xs font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <Check size={14} />
              {t('aiActions.approve', 'Zatwierdź')}
            </button>

            {/* Edit (optional) */}
            {onEdit && (
              <button
                onClick={() => onEdit(action.id, action.payload)}
                disabled={disabled}
                className={`
                  flex items-center justify-center gap-1.5 px-3 py-2
                  bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600
                  text-slate-700 dark:text-slate-300
                  rounded-lg text-xs font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <Edit size={14} />
                {t('aiActions.edit', 'Edytuj')}
              </button>
            )}

            {/* Dismiss */}
            <button
              onClick={() => onDismiss(action.id)}
              disabled={disabled}
              className={`
                flex items-center justify-center gap-1.5 px-3 py-2
                hover:bg-danger-50 dark:hover:bg-danger-900/20
                text-danger-600 dark:text-danger-400
                rounded-lg text-xs font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <X size={14} />
              {t('aiActions.dismiss', 'Odrzuć')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Action List Component
// ============================================================================

interface AIActionListProps {
  actions: AIAction[];
  onApprove: (actionId: string) => void;
  onEdit?: (actionId: string, editedPayload: AIActionPayload) => void;
  onDismiss: (actionId: string) => void;
  onDismissAll?: () => void;
  executingActionId?: string | null;
  maxVisible?: number;
  compact?: boolean;
}

export const AIActionList: React.FC<AIActionListProps> = ({
  actions,
  onApprove,
  onEdit,
  onDismiss,
  onDismissAll,
  executingActionId,
  maxVisible = 3,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const visibleActions = showAll ? actions : actions.slice(0, maxVisible);
  const hiddenCount = actions.length - maxVisible;

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          {t('aiActions.pendingActions', 'Proponowane akcje')} ({actions.length})
        </h4>
        {onDismissAll && actions.length > 1 && (
          <button
            onClick={onDismissAll}
            className="text-xs text-slate-500 hover:text-danger-500 dark:text-slate-400 dark:hover:text-danger-400"
          >
            {t('aiActions.dismissAll', 'Odrzuć wszystkie')}
          </button>
        )}
      </div>

      {/* Action Cards */}
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {visibleActions.map((action) => (
          <AIActionCard
            key={action.id}
            action={action}
            onApprove={onApprove}
            onEdit={onEdit}
            onDismiss={onDismiss}
            compact={compact}
            isExecuting={executingActionId === action.id}
          />
        ))}
      </div>

      {/* Show more */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center py-2 text-xs text-c-text-secondary dark:text-c-text-secondary hover:underline"
        >
          {t('aiActions.showMore', 'Pokaż więcej')} (+{hiddenCount})
        </button>
      )}

      {showAll && actions.length > maxVisible && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full text-center py-2 text-xs text-slate-500 dark:text-slate-400 hover:underline"
        >
          {t('aiActions.showLess', 'Pokaż mniej')}
        </button>
      )}
    </div>
  );
};

export default AIActionCard;
