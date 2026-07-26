/**
 * FieldAIButton
 *
 * Field-level AI affordance — the smallest of the three N-mode AI levels
 * (tool → section → field). A tiny, unobtrusive sparkle icon button meant to
 * sit inline next to a single field (KPI, financial input, etc.). Hover reveals
 * it; click hands control back to the consumer ("copilot, not autopilot").
 *
 * Purely additive: consumers opt in by dropping it next to a field.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface FieldAIButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * When true, the section this field belongs to is marked complete (AI signal).
   * The button is disabled so AI does not re-touch a section the user has signed off.
   */
  completed?: boolean;
  /** Optional bilingual tooltip. Defaults to "Improve this field with AI". */
  title?: { en: string; pl: string };
}

const DEFAULT_FIELD_TITLE = {
  en: 'Improve this field with AI',
  pl: 'Popraw pole z AI',
};

export const FieldAIButton: React.FC<FieldAIButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  completed = false,
  title,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const resolvedTitle = title ?? DEFAULT_FIELD_TITLE;
  const tooltip = isPolish ? resolvedTitle.pl : resolvedTitle.en;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading || completed}
      title={tooltip}
      aria-label={tooltip}
      className="inline-flex items-center justify-center p-1 rounded-md text-c-ai opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-c-ai/10 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
    </button>
  );
};

export default FieldAIButton;
