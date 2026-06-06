/**
 * LoadingState - Shared state primitive (X1 Design System)
 *
 * Unified loading placeholder. Defaults to skeleton rows; also supports
 * spinner and pulse variants. Built on the existing Skeleton / Spinner primitives.
 *
 * @example
 * <LoadingState variant="skeleton" rows={5} />
 * <LoadingState variant="spinner" label="Loading report…" />
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';

export interface LoadingStateProps {
  /** Presentation style */
  variant?: 'skeleton' | 'spinner' | 'pulse';
  /** Number of skeleton rows (skeleton variant) */
  rows?: number;
  /** Screen-reader / visible label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'skeleton',
  rows = 4,
  label,
  className = '',
}) => {
  const { t } = useTranslation();
  const srLabel = label ?? t('common.loading', { defaultValue: 'Loading…' });

  if (variant === 'spinner') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center gap-3 py-16 text-navy-400 dark:text-navy-300 ${className}`.trim()}
      >
        <Spinner size="lg" />
        <span className="text-sm">{srLabel}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center justify-center py-16 ${className}`.trim()}
      >
        <div className="h-3 w-32 animate-pulse rounded-token-pill bg-navy-200 dark:bg-navy-700" />
        <span className="sr-only">{srLabel}</span>
      </div>
    );
  }

  // skeleton (default)
  return (
    <div role="status" aria-live="polite" className={`space-y-3 py-2 ${className}`.trim()}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={44} className="w-full rounded-token-sm" />
      ))}
      <span className="sr-only">{srLabel}</span>
    </div>
  );
};

LoadingState.displayName = 'LoadingState';

export default LoadingState;
