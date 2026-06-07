/**
 * NModeSectionWrapper
 *
 * Utility wrapper for individual section canvas content.
 * Provides consistent spacing, optional heading with AI button(s), and empty states.
 *
 * AI affordances ("copilot, not autopilot") come in three levels across the kit:
 * - tool   — whole artifact (NModeActionBar)
 * - section — this wrapper's `aiAction` / `aiActions` (top-right of section header)
 * - field  — the exported `FieldAIButton` (drop next to any KPI/financial/input)
 *
 * Everything here is additive: nothing new renders unless the optional AI props
 * are passed, so existing consumers behave identically.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** A single section-level AI affordance config. */
export interface NModeSectionAIAction {
  /** Optional bilingual button label. Defaults to "AI" / "AI". */
  label?: { en: string; pl: string };
  /** Optional bilingual tooltip. Defaults to "Improve this section with AI". */
  title?: { en: string; pl: string };
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface NModeSectionWrapperProps {
  /** Section heading text */
  heading?: { en: string; pl: string };
  /** Optional single section-level AI action button config */
  aiAction?: NModeSectionAIAction;
  /** Optional multiple section-level AI action buttons (rendered after aiAction) */
  aiActions?: NModeSectionAIAction[];
  /** Empty state configuration (shown when no content) */
  emptyState?: {
    icon: React.FC<{ size?: number; className?: string }>;
    message: { en: string; pl: string };
  };
  /** Whether to show the empty state */
  isEmpty?: boolean;
  /**
   * Content layout mode.
   * - "default"  — single-column, children stack vertically (default)
   * - "cols-2"   — 2-column symmetric grid, ~530px each (McKinsey canvas standard).
   *                Use for card-heavy sections (LabeledCardGrid, MetricCard, etc.).
   *                Reverts to single-column on narrow viewports (< lg).
   */
  layout?: 'default' | 'cols-2';
  /**
   * Mark Complete state — set by AI signal only. When true, renders a success
   * tint on the header and a ✓ chip. Fields remain editable.
   */
  completed?: boolean;
  /** Section content */
  children: React.ReactNode;
}

const DEFAULT_SECTION_LABEL = { en: 'AI', pl: 'AI' };
const DEFAULT_SECTION_TITLE = {
  en: 'Improve this section with AI',
  pl: 'Popraw sekcję z AI',
};

/**
 * SectionAIButton — internal renderer for a single section-level AI affordance.
 * Subtle, primary-tinted, matching the 'ai' variant styling from NModeActionBar.
 */
const SectionAIButton: React.FC<{ action: NModeSectionAIAction; isPolish: boolean }> = ({
  action,
  isPolish,
}) => {
  const label = action.label ?? DEFAULT_SECTION_LABEL;
  const title = action.title ?? DEFAULT_SECTION_TITLE;

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      title={isPolish ? title.pl : title.en}
      aria-label={isPolish ? title.pl : title.en}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-700/40 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {action.loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {isPolish ? label.pl : label.en}
    </button>
  );
};

export const NModeSectionWrapper: React.FC<NModeSectionWrapperProps> = ({
  heading,
  aiAction,
  aiActions,
  emptyState,
  isEmpty = false,
  layout = 'default',
  completed = false,
  children,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const sectionActions: NModeSectionAIAction[] = [
    ...(aiAction ? [aiAction] : []),
    ...(aiActions ?? []),
  ];
  const hasSectionActions = sectionActions.length > 0;

  return (
    <div className="space-y-6">
      {/* Heading + section-level AI action(s), top-right */}
      {(heading || hasSectionActions || completed) && (
        <div
          className={`flex items-center justify-between gap-3 -mx-1 px-1 py-1 rounded-lg transition-colors ${
            completed
              ? 'border-l-2 border-success-500 dark:border-success-400 bg-success-50/40 dark:bg-success-900/10 pl-3'
              : ''
          }`}
        >
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {heading ? (isPolish ? heading.pl : heading.en) : null}
            {completed && (
              <CheckCircle2
                size={15}
                className="text-success-500 dark:text-success-400 shrink-0"
                aria-label={isPolish ? 'AI: sekcja gotowa' : 'AI: section complete'}
              />
            )}
          </h2>
          {hasSectionActions && (
            <div className="flex items-center gap-2">
              {sectionActions.map((action, idx) => (
                <SectionAIButton key={idx} action={action} isPolish={isPolish} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state or content */}
      {isEmpty && emptyState ? (
        <div className="text-center py-12">
          <emptyState.icon size={32} className="mx-auto text-slate-600 dark:text-slate-400 mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-500">
            {isPolish ? emptyState.message.pl : emptyState.message.en}
          </p>
        </div>
      ) : layout === 'cols-2' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{children}</div>
      ) : (
        children
      )}
    </div>
  );
};

export default NModeSectionWrapper;

/** Re-export of the field-level affordance so consumers can import it from here. */
export type { FieldAIButtonProps } from './FieldAIButton';
export { FieldAIButton } from './FieldAIButton';
