/**
 * SectionCard — the one canonical wrapper for every artifact section.
 *
 * Today each section (in Insight and Initiative) renders with its own banner,
 * colors and layout → visual chaos (owner: "tyle różnych formatów… beznadziejne"
 * #23). This wrapper gives every section the same shell:
 *   header (icon + title + count badge + description) · section-level AI slot in
 *   the right corner (level="section", #6) · body · optional footer.
 *
 * Zero decorative color — the card is monochrome; color lives only in status
 * pills and the AI accent (master plan §8). Works in both N-mode (one card at a
 * time) and C-mode (dense grid of cards).
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { type AIAction, AIAssist } from './AIAssist';

export interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  /** One-line "what is this section" helper, shown under the title. */
  description?: string;
  /** Optional count badge next to the title (e.g. number of tasks). */
  count?: number;
  /** Section-level AI actions (level="section"). Omit to hide the slot. */
  aiActions?: AIAction[];
  canUseAi?: boolean;
  aiDisabledReason?: string;
  /** Footer content (e.g. confidence chip + source-session chips). */
  footer?: React.ReactNode;
  isPolish?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon: Icon,
  description,
  count,
  aiActions,
  canUseAi = false,
  aiDisabledReason,
  footer,
  isPolish = false,
  children,
  className = '',
}) => {
  return (
    <section
      className={`rounded-2xl border border-slate-200/70 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.02] ${className}`}
    >
      <header className="flex items-start gap-3 px-5 pt-4">
        {Icon && (
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {typeof count === 'number' && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{description}</p>
          )}
        </div>
        {aiActions && aiActions.length > 0 && (
          <AIAssist
            level="section"
            actions={aiActions}
            canUseAi={canUseAi}
            disabledReason={aiDisabledReason}
            isPolish={isPolish}
            className="shrink-0"
          />
        )}
      </header>

      <div className="px-5 py-4">{children}</div>

      {footer && (
        <footer className="border-t border-slate-200/50 px-5 py-3 dark:border-white/[0.05]">
          {footer}
        </footer>
      )}
    </section>
  );
};

export default SectionCard;
