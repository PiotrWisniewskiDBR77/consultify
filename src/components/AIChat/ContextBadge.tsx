/**
 * ContextBadge
 *
 * Shows users what context the AI has access to.
 * Builds trust by being transparent about what data AI "sees".
 *
 * Variants:
 * - empty: General chat, no specific context
 * - project: PMO Project context
 * - initiative: Initiative detail
 * - task: Task detail
 * - assessment: Assessment in progress
 * - decision: Decision context
 *
 * @version 1.0.0
 */

import {
  Briefcase,
  CheckSquare,
  ClipboardList,
  FileQuestion,
  FolderKanban,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Target,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { WorkspaceContext, WorkspaceType } from '../../types/workspace';

// ============================================================================
// Types
// ============================================================================

interface ContextBadgeProps {
  /** Current workspace context */
  context: WorkspaceContext | null;

  /** Display variant */
  variant?: 'compact' | 'detailed';

  /** Optional click handler (e.g., navigate to context source) */
  onClick?: () => void;

  /** Additional class name */
  className?: string;
}

// ============================================================================
// Context Configuration
// ============================================================================

interface ContextConfig {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const getContextConfig = (
  type: WorkspaceType,
  t: (key: string, fallback: string) => string
): ContextConfig => {
  const configs: Record<WorkspaceType, ContextConfig> = {
    empty: {
      icon: Sparkles,
      label: t('aiChat.context.general', 'Rozmowa ogólna'),
      color: 'text-slate-500 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-800/50',
      borderColor: 'border-slate-200 dark:border-slate-700',
    },
    project: {
      icon: FolderKanban,
      label: t('aiChat.context.project', 'Projekt'),
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    initiative: {
      icon: Lightbulb,
      label: t('aiChat.context.initiative', 'Inicjatywa'),
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    task: {
      icon: CheckSquare,
      label: t('aiChat.context.task', 'Zadanie'),
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    assessment: {
      icon: Target,
      label: t('aiChat.context.assessment', 'Assessment'),
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    decision: {
      icon: FileQuestion,
      label: t('aiChat.context.decision', 'Decyzja'),
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    report: {
      icon: ClipboardList,
      label: t('aiChat.context.report', 'Report'),
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
    },
    dashboard: {
      icon: Briefcase,
      label: t('aiChat.context.dashboard', 'Dashboard'),
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
    },
    roadmap: {
      icon: FolderKanban,
      label: t('aiChat.context.roadmap', 'Roadmap'),
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      borderColor: 'border-teal-200 dark:border-teal-800',
    },
    general: {
      icon: Sparkles,
      label: t('aiChat.context.general', 'Rozmowa ogólna'),
      color: 'text-slate-500 dark:text-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-800/50',
      borderColor: 'border-slate-200 dark:border-slate-700',
    },
    document: {
      icon: ClipboardList,
      label: t('aiChat.context.document', 'Dokument'),
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    artifact: {
      icon: Sparkles,
      label: t('aiChat.context.artifact', 'Artefakt'),
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      borderColor: 'border-pink-200 dark:border-pink-800',
    },
  };

  return configs[type] || configs.empty;
};

// ============================================================================
// Component
// ============================================================================

export const ContextBadge: React.FC<ContextBadgeProps> = ({
  context,
  variant = 'compact',
  onClick,
  className = '',
}) => {
  const { t } = useTranslation();

  // Determine context type
  const contextType: WorkspaceType = context?.type || 'empty';
  const config = getContextConfig(contextType, t);
  const Icon = config.icon;

  // If empty context, show minimal badge or nothing
  if (contextType === 'empty' || !context) {
    if (variant === 'compact') {
      return null; // Don't show badge for general chat in compact mode
    }

    return (
      <div
        className={`
                    inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                    ${config.bgColor} ${config.borderColor} border
                    ${className}
                `}
      >
        <Icon size={14} className={config.color} />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      </div>
    );
  }

  // Detailed variant with full context info
  if (variant === 'detailed') {
    return (
      <div
        onClick={onClick}
        className={`
                    rounded-lg border transition-all
                    ${config.bgColor} ${config.borderColor}
                    ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
                    ${className}
                `}
      >
        {/* Main context info */}
        <div className="flex items-start gap-3 px-3 py-2">
          <div className={`p-1.5 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
            <Icon size={16} className={config.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${config.color}`}>{config.label}:</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {context.entityName || t('aiChat.context.unnamed', 'Unnamed')}
              </span>
            </div>

            {/* Project context (if different from main entity) */}
            {context.projectName && context.type !== 'project' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <FolderKanban size={10} className="text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {context.projectName}
                </span>
              </div>
            )}

            {/* Additional data */}
            {context.entityData && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {(context.entityData as any).taskStatus && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {(context.entityData as any).taskStatus}
                  </span>
                )}
                {(context.entityData as any).initiativeProgress !== undefined && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('aiChat.context.progress', 'Postęp')}:{' '}
                    {(context.entityData as any).initiativeProgress}%
                  </span>
                )}
                {(context.entityData as any).currentScore !== undefined &&
                  (context.entityData as any).targetScore !== undefined && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {(context.entityData as any).currentScore} →{' '}
                      {(context.entityData as any).targetScore}
                    </span>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <div
      onClick={onClick}
      className={`
                inline-flex items-center gap-2 px-2.5 py-1 rounded-lg
                ${config.bgColor} ${config.borderColor} border
                ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}
                ${className}
            `}
    >
      <Icon size={12} className={config.color} />
      <span className={`text-[11px] font-medium ${config.color}`}>
        {context.entityName || config.label}
      </span>
      {context.projectName && context.type !== 'project' && (
        <>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
            {context.projectName}
          </span>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Helper Component: Context Badge for Input Area
// ============================================================================

interface InputContextBadgeProps {
  context: WorkspaceContext | null;
  className?: string;
}

export const InputContextBadge: React.FC<InputContextBadgeProps> = ({
  context,
  className = '',
}) => {
  const { t } = useTranslation();

  // Don't show for empty context
  if (!context || context.type === 'empty') {
    return null;
  }

  const config = getContextConfig(context.type, t);
  const Icon = config.icon;

  return (
    <div
      className={`
                flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg
                ${config.bgColor} ${config.borderColor} border
                ${className}
            `}
    >
      <span className="sr-only">Context-aware</span>
      <Icon size={14} className={config.color} />
      <span className="text-xs text-slate-600 dark:text-slate-300">
        <span className={`font-medium ${config.color}`}>{config.label}:</span>{' '}
        {context.entityName || t('aiChat.context.unnamed', 'Unnamed')}
      </span>
      {context.projectName && context.type !== 'project' && (
        <>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{context.projectName}</span>
        </>
      )}
    </div>
  );
};

export default ContextBadge;
