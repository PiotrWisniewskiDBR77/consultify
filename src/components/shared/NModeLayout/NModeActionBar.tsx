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
  /** Currently active section id (for AI context) */
  activeSection: string;
}

const VARIANT_CLASSES: Record<ActionVariant, string> = {
  success: 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
  danger: 'border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10',
  neutral:
    'border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800',
  ai: 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15',
};

const VARIANT_LOADING_CLASS: Record<ActionVariant, string> = {
  success: 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  danger: 'border-red-400/50 text-red-600 dark:text-red-400 bg-red-500/10',
  neutral:
    'border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800',
  ai: 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10',
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClass} ${className}`}
    >
      {action.loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {label}
    </button>
  );
};

export const NModeActionBar: React.FC<NModeActionBarProps> = ({
  actions,
  aiContextActions = [],
  activeSection,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // Find the AI action for the currently active section
  const sectionAIAction = aiContextActions.find((a) => a.sectionId === activeSection);

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/40 dark:border-navy-700/40">
      {/* Primary actions */}
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} isPolish={isPolish} />
      ))}

      {/* Section-specific AI action (pushed to the right) */}
      {sectionAIAction && (
        <ActionButton action={sectionAIAction.action} isPolish={isPolish} className="ml-auto" />
      )}
    </div>
  );
};

export default NModeActionBar;
