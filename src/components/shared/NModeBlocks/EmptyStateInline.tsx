/**
 * EmptyStateInline
 *
 * N-mode building block for empty states within sections.
 * Shows an icon, message, and optional CTA button.
 *
 * Follows DBR77 Visual Language — quiet UI, no heavy frames.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import React from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EmptyStateInlineProps {
  /** Icon to display (defaults to Inbox) */
  icon?: LucideIcon;
  /** Primary message */
  message: string;
  /** Optional secondary / hint text */
  hint?: string;
  /** CTA button */
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Use dashed border style (default: true) */
  dashed?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const EmptyStateInline: React.FC<EmptyStateInlineProps> = ({
  icon: Icon = Inbox,
  message,
  hint,
  action,
  dashed = true,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border ${
        dashed ? 'border-dashed' : ''
      } border-slate-300/60 dark:border-navy-700/70 bg-white/40 dark:bg-navy-900/40 p-8 text-center ${className}`}
    >
      <Icon size={28} className="mx-auto mb-3 text-slate-600 dark:text-slate-400" />
      <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">{message}</p>
      {hint && <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{hint}</p>}
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 transition-colors disabled:opacity-40"
        >
          + {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyStateInline;
