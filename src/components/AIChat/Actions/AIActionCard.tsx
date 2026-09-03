/**
 * AIActionCard
 *
 * Displays a single AI-proposed action with approve/edit/dismiss buttons.
 * Supports compact mode for inline display in chat messages.
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
  Edit3,
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
} from '../../../types/aiActions';

// ============================================================================
// Icon Mapping
// ============================================================================

const ACTION_ICONS: Record<string, React.ElementType> = {
  CheckSquare,
  Edit: Edit3,
  Lightbulb,
  GitBranch,
  Calendar,
  FileText,
  Bell: AlertTriangle,
  Target,
  Flag,
  Users,
  ExternalLink,
  Zap,
};

// ============================================================================
// Props
// ============================================================================

interface AIActionCardProps {
  action: AIAction;
  onApprove: (actionId: string) => void;
  onEdit?: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
  compact?: boolean;
  disabled?: boolean;
  isExecuting?: boolean;
}

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
  const riskColor = getRiskColor(action.risk);

  const isPending = action.status === 'proposed';
  const isCompleted = action.status === 'executed';
  const isFailed = action.status === 'failed';
  const isDismissed = action.status === 'dismissed';

  // Color classes based on action type
  const colorClasses: Record<string, string> = {
    green: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    purple: 'border-c-border dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised',
    cyan: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
    indigo: 'border-c-border dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised',
    orange: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    red: 'border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20',
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    slate: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50',
    violet: 'border-c-border dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised',
  };

  const iconColorClasses: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-c-text-secondary dark:text-c-text-secondary',
    cyan: 'text-blue-600 dark:text-blue-400',
    indigo: 'text-c-text-secondary dark:text-c-text-secondary',
    orange: 'text-amber-600 dark:text-amber-400',
    red: 'text-danger-600 dark:text-danger-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    slate: 'text-slate-600 dark:text-slate-400',
    violet: 'text-c-text-secondary dark:text-c-text-secondary',
  };

  // Render payload summary based on action type
  const renderPayloadSummary = () => {
    const { payload } = action;

    if (payload.task) {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">{payload.task.title}</span>
          {payload.task.priority && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
              {payload.task.priority}
            </span>
          )}
        </div>
      );
    }

    if (payload.initiative) {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">{payload.initiative.title}</span>
        </div>
      );
    }

    if (payload.decision) {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">{payload.decision.title}</span>
        </div>
      );
    }

    if (payload.report) {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          {t('aiActions.report', 'Raport')}: {payload.report.type}
        </div>
      );
    }

    if (payload.navigation) {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          {t('aiActions.navigateTo', 'Przejdź do')}: {payload.navigation.view}
        </div>
      );
    }

    return null;
  };

  // Compact mode - single line
  if (compact) {
    return (
      <div
        className={`
                    flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
                    ${colorClasses[config.color] || colorClasses.slate}
                    ${isDismissed ? 'opacity-50' : ''}
                `}
      >
        <Icon size={14} className={iconColorClasses[config.color] || iconColorClasses.slate} />

        <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {action.title}
        </span>

        {isPending && !disabled && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onApprove(action.id)}
              disabled={isExecuting}
              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
              title={t('aiActions.approve', 'Zatwierdź')}
            >
              {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button
              onClick={() => onDismiss(action.id)}
              className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-danger-500 dark:text-danger-400 transition-colors"
              title={t('aiActions.dismiss', 'Odrzuć')}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {isCompleted && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            ✓
          </span>
        )}

        {isFailed && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400">
            !
          </span>
        )}
      </div>
    );
  }

  // Full mode - expandable card
  return (
    <div
      className={`
                rounded-xl border overflow-hidden transition-all
                ${colorClasses[config.color] || colorClasses.slate}
                ${isDismissed ? 'opacity-50' : ''}
            `}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div
          className={`p-2 rounded-lg ${colorClasses[config.color]} border ${colorClasses[config.color].split(' ')[0]}`}
        >
          <Icon size={16} className={iconColorClasses[config.color] || iconColorClasses.slate} />
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
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                                ${
                                  action.risk === 'high'
                                    ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                }`}
              >
                {action.risk === 'high'
                  ? t('aiActions.highRisk', 'Wysokie ryzyko')
                  : t('aiActions.mediumRisk', 'Średnie ryzyko')}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
            {action.description}
          </p>

          {/* Payload summary */}
          <div className="mt-2">{renderPayloadSummary()}</div>
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-200/50 dark:border-slate-700/50">
          <pre className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 rounded p-2 overflow-x-auto mt-2">
            {JSON.stringify(action.payload, null, 2)}
          </pre>
        </div>
      )}

      {/* Actions */}
      {isPending && !disabled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/50 dark:bg-slate-800/30 border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => onApprove(action.id)}
            disabled={isExecuting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-400 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {t('aiActions.approve', 'Zatwierdź')}
          </button>

          {onEdit && (
            <button
              onClick={() => onEdit(action.id)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              <Edit3 size={12} />
              {t('aiActions.edit', 'Edytuj')}
            </button>
          )}

          <button
            onClick={() => onDismiss(action.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/30 text-xs font-medium rounded-lg transition-colors"
          >
            <X size={12} />
            {t('aiActions.dismiss', 'Odrzuć')}
          </button>
        </div>
      )}

      {/* Status footer for completed/failed */}
      {(isCompleted || isFailed) && (
        <div
          className={`flex items-center gap-2 px-3 py-2 text-xs
                    ${
                      isCompleted
                        ? 'bg-green-100/50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-danger-100/50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400'
                    }`}
        >
          {isCompleted ? (
            <>
              <Check size={12} />
              {t('aiActions.executed', 'Wykonano')}
              {action.result?.createdId && (
                <span className="text-slate-500">• ID: {action.result.createdId}</span>
              )}
            </>
          ) : (
            <>
              <AlertTriangle size={12} />
              {action.result?.error || t('aiActions.failed', 'Błąd wykonania')}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AIActionCard;
