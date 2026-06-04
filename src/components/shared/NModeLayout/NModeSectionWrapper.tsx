/**
 * NModeSectionWrapper
 *
 * Utility wrapper for individual section canvas content.
 * Provides consistent spacing, optional heading with AI button, and empty states.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface NModeSectionWrapperProps {
  /** Section heading text */
  heading?: { en: string; pl: string };
  /** Optional AI action button config */
  aiAction?: {
    label: { en: string; pl: string };
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
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

export const NModeSectionWrapper: React.FC<NModeSectionWrapperProps> = ({
  heading,
  aiAction,
  emptyState,
  isEmpty = false,
  children,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <div className="space-y-6">
      {/* Heading + AI action */}
      {heading && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? heading.pl : heading.en}
          </h2>
          {aiAction && (
            <button
              onClick={aiAction.onClick}
              disabled={aiAction.disabled || aiAction.loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 dark:text-primary-400 hover:bg-primary-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiAction.loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {isPolish ? aiAction.label.pl : aiAction.label.en}
            </button>
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
