/**
 * EmptyState — Systemic empty / error state (VEGAS V7.1)
 *
 * The canonical, token-driven empty state for lists, panels and hubs.
 * Replaces ad-hoc "Idea Garden"-style placeholders and bare "no data" text.
 *
 * Every empty state answers three questions:
 *   1. WHAT is empty (icon + thesis title)
 *   2. WHY it is empty (one sentence of explanation)
 *   3. WHAT to do next (primary CTA, optional secondary)
 *
 * Variants map to *cause*, so the copy and affordance always match reality:
 *   - 'new'       → empty because nothing has been created yet (offer creation)
 *   - 'filter'    → empty because the current filter/search excludes everything
 *   - 'forbidden' → empty because the user lacks permission
 *   - 'error'     → failed to load (offer Retry)
 *
 * Colors use the app CSS token layer (var(--c-*)) so light/dark are automatic.
 *
 * @example
 * <EmptyState
 *   variant="new"
 *   icon={Lightbulb}
 *   title="No ideas yet"
 *   description="Capture your first idea to start building the map."
 *   primaryAction={{ label: 'New idea', onClick: create }}
 * />
 */

import { motion } from 'framer-motion';
import { AlertTriangle, FilterX, Inbox, Lock, type LucideIcon, RotateCw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type EmptyStateVariant = 'new' | 'filter' | 'forbidden' | 'error';

export interface EmptyStateActionSpec {
  label: string;
  onClick: () => void;
  /** Optional leading icon for the button. */
  icon?: LucideIcon;
  /**
   * Optional stable identifier rendered as `data-testid`. Lets a caller that
   * opens a dialog from this action re-query a LIVE button reference at
   * close-time for focus return, even if this component's own DOM node was
   * replaced by an intervening re-render (e.g. a loading state flash) while
   * the dialog was open.
   */
  testId?: string;
}

export interface EmptyStateProps {
  /** Cause of emptiness — drives default icon, tone and affordances. */
  variant?: EmptyStateVariant;
  /** Override the default icon for the variant. */
  icon?: LucideIcon;
  /** Thesis headline — states the situation, not "Empty". */
  title: string;
  /** One sentence: why it is empty and/or what happens next. */
  description?: string;
  /** Primary call-to-action. */
  primaryAction?: EmptyStateActionSpec;
  /** Optional secondary, lower-emphasis action. */
  secondaryAction?: EmptyStateActionSpec;
  /** Convenience for the `error` variant — renders a "Try again" button. */
  onRetry?: () => void;
  /** Reduce vertical padding for inline / in-card usage. */
  compact?: boolean;
  className?: string;
}

const VARIANT_ICON: Record<EmptyStateVariant, LucideIcon> = {
  new: Inbox,
  filter: FilterX,
  forbidden: Lock,
  error: AlertTriangle,
};

const ICON_TONE: Record<EmptyStateVariant, string> = {
  new: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
  filter: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
  forbidden: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
  error: 'bg-c-danger/12 text-[var(--c-danger)]',
};

const ActionButton: React.FC<{
  spec: EmptyStateActionSpec;
  emphasis: 'primary' | 'secondary';
}> = ({ spec, emphasis }) => {
  const Icon = spec.icon;
  const base =
    'inline-flex items-center gap-2 rounded-token-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)]';
  const emphasisCls =
    emphasis === 'primary'
      ? // Neutral filled CTA (dark fill in light mode, light inverse in dark mode) —
        // NEVER the brand crimson accent token here: this shell is shared across every screen and
        // brand accent is reserved for deliberate brand moments, not default CTAs.
        'bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90'
      : 'border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-surface-raised)]';
  return (
    <button
      type="button"
      onClick={spec.onClick}
      data-testid={spec.testId}
      className={`${base} ${emphasisCls}`}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {spec.label}
    </button>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'new',
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  onRetry,
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const Icon = icon ?? VARIANT_ICON[variant];

  // For the error variant, synthesize a Retry primary action when onRetry is provided.
  const resolvedPrimary: EmptyStateActionSpec | undefined =
    primaryAction ??
    (variant === 'error' && onRetry
      ? {
          label: t('common.retry', { defaultValue: 'Try again' }),
          onClick: onRetry,
          icon: RotateCw,
        }
      : undefined);

  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <motion.div
      role={role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-8' : 'px-8 py-16'
      } ${className}`.trim()}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div
        className={`flex items-center justify-center rounded-token-lg ${ICON_TONE[variant]} ${
          compact ? 'mb-3 h-11 w-11' : 'mb-5 h-16 w-16'
        }`}
      >
        <Icon size={compact ? 22 : 30} aria-hidden />
      </div>

      <h3
        className={`font-semibold text-[var(--c-text)] ${
          compact ? 'mb-1 text-base' : 'mb-2 text-lg'
        }`}
      >
        {title}
      </h3>

      {description && (
        <p className={`max-w-sm text-[var(--c-text-muted)] ${compact ? 'text-sm' : 'text-[15px]'}`}>
          {description}
        </p>
      )}

      {(resolvedPrimary || secondaryAction) && (
        <div
          className={`flex flex-wrap items-center justify-center gap-3 ${
            compact ? 'mt-4' : 'mt-6'
          }`}
        >
          {secondaryAction && <ActionButton spec={secondaryAction} emphasis="secondary" />}
          {resolvedPrimary && <ActionButton spec={resolvedPrimary} emphasis="primary" />}
        </div>
      )}
    </motion.div>
  );
};

EmptyState.displayName = 'EmptyState';

export default EmptyState;
