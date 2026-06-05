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

import { Loader2, Sparkles } from 'lucide-react';
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-400/30 dark:border-primary-500/20 text-xs font-medium text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
      {(heading || hasSectionActions) && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {heading ? (isPolish ? heading.pl : heading.en) : null}
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
