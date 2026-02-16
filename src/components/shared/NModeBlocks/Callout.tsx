/**
 * Callout
 *
 * N-mode building block for informational, warning, or critical callouts.
 * Follows DBR77 Visual Language — quiet UI with appropriate severity coloring.
 *
 * Variants:
 * - info (blue)    — neutral information, tips
 * - warning (amber) — attention needed, approaching deadlines
 * - critical (red)  — blockers, overdue, errors
 * - success (emerald) — completed actions, positive outcomes
 * - purple (purple) — AI-generated content, insights
 *
 * @see docs/ui-standards/detail-view-presentation-modes.md §2.5.5
 * @see docs/00_foundation/COLOR_SYSTEM_STANDARD.md
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
  Sparkles,
} from 'lucide-react';
import React from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export type CalloutVariant = 'info' | 'warning' | 'critical' | 'success' | 'purple';

export interface CalloutProps {
  /** Visual variant */
  variant?: CalloutVariant;
  /** Custom icon (overrides default per-variant icon) */
  icon?: LucideIcon;
  /** Title text (optional) */
  title?: string;
  /** Body content — string or JSX */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode — less padding, smaller text */
  compact?: boolean;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ── Variant config ──────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  CalloutVariant,
  { bg: string; border: string; text: string; icon: LucideIcon }
> = {
  info: {
    bg: 'bg-blue-500/5 dark:bg-blue-500/10',
    border: 'border-blue-200/60 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-500/5 dark:bg-amber-500/10',
    border: 'border-amber-200/60 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-red-500/5 dark:bg-red-500/10',
    border: 'border-red-200/60 dark:border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    icon: AlertCircle,
  },
  success: {
    bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    border: 'border-emerald-200/60 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  purple: {
    bg: 'bg-purple-500/5 dark:bg-purple-500/10',
    border: 'border-purple-200/60 dark:border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    icon: Sparkles,
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export const Callout: React.FC<CalloutProps> = ({
  variant = 'info',
  icon: CustomIcon,
  title,
  children,
  className = '',
  compact = false,
  action,
}) => {
  const styles = VARIANT_STYLES[variant];
  const Icon = CustomIcon || styles.icon;
  const padding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`${padding} rounded-xl ${styles.bg} border ${styles.border} ${styles.text} ${className}`}
      role={variant === 'critical' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={compact ? 14 : 16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && (
            <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} mb-0.5`}>{title}</p>
          )}
          <div className={`${textSize} leading-relaxed`}>{children}</div>
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 ${textSize} font-medium underline underline-offset-2 hover:no-underline transition-all`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Callout;
