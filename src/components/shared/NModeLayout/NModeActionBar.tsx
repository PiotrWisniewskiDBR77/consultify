/**
 * NModeActionBar
 *
 * Contextual action bar displayed between PropertiesStrip and the 2-pane area.
 * Shows primary actions (Approve, Reject, etc.) and section-specific AI actions.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ActionVariant, NModeAction, NModeAIContextAction } from './types';

interface NModeActionBarProps {
  /** Primary action buttons */
  actions: NModeAction[];
  /** AI actions that appear based on active section */
  aiContextActions?: NModeAIContextAction[];
  /**
   * Tool-level AI actions — whole-artifact AI, always visible regardless of the
   * active section (vs. aiContextActions which are section-scoped). Rendered as a
   * right-aligned group. Part of the 3-level AI model: tool / section / field.
   */
  toolAIActions?: NModeAction[];
  /** Currently active section id (for AI context) */
  activeSection: string;
}

const VARIANT_CLASSES: Record<ActionVariant, string> = {
  success:
    'border-emerald-400/30 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
  danger:
    'border-danger-400/30 dark:border-danger-500/20 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10',
  neutral: 'border-c-border text-c-text-secondary hover:bg-state-hover',
  // AI = teal (canon: no crimson/primary-* as UI accent — see NModeToolbar/AIConsultantPanel).
  ai: 'border-teal-400/30 dark:border-teal-500/20 text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/15',
};

const VARIANT_LOADING_CLASS: Record<ActionVariant, string> = {
  success:
    'border-emerald-400/30 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  danger:
    'border-danger-400/30 dark:border-danger-500/20 text-danger-600 dark:text-danger-400 bg-danger-500/10',
  neutral: 'border-c-border text-c-text-secondary bg-c-surface-raised',
  ai: 'border-teal-400/30 dark:border-teal-500/20 text-teal-600 dark:text-teal-300 bg-teal-500/10',
};

const ActionButton: React.FC<{ action: NModeAction; isPolish: boolean; className?: string }> = ({
  action,
  isPolish,
  className = '',
}) => {
  const Icon = action.icon;
  const label = isPolish ? action.label.pl : action.label.en;
  const title = action.title ? (isPolish ? action.title.pl : action.title.en) : label;
  const variantClass = action.loading
    ? VARIANT_LOADING_CLASS[action.variant]
    : VARIANT_CLASSES[action.variant];

  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${variantClass} ${className}`}
    >
      {action.loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {label}
    </button>
  );
};

export const NModeActionBar: React.FC<NModeActionBarProps> = ({
  actions,
  aiContextActions = [],
  toolAIActions = [],
  activeSection,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // Find the AI action for the currently active section
  const sectionAIAction = aiContextActions.find((a) => a.sectionId === activeSection);

  return (
    <div className="flex items-center gap-2">
      {/* Primary actions */}
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} isPolish={isPolish} />
      ))}

      {/* Section-specific AI action (pushed to the right) */}
      {sectionAIAction && (
        <ActionButton action={sectionAIAction.action} isPolish={isPolish} className="ml-auto" />
      )}

      {/* Tool-level AI actions — whole-artifact, always visible regardless of
          section. Right-aligned group (ml-auto on the first when no section
          AI action already pushed the row right). */}
      {toolAIActions.length > 0 && (
        <div className={`flex items-center gap-2 ${sectionAIAction ? '' : 'ml-auto'}`}>
          {toolAIActions.map((action) => (
            <ActionButton key={action.id} action={action} isPolish={isPolish} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NModeActionBar;
