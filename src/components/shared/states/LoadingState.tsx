/**
 * LoadingState — Systemic loading placeholder (VEGAS V7.1)
 *
 * Replaces bare "Loading…" text with content-shaped skeletons so the layout
 * does not jump when data arrives. Three ready-made templates cover the vast
 * majority of surfaces, plus a labelled progress variant for slow (>3s)
 * operations where a skeleton alone would feel stuck.
 *
 * Templates (`template`):
 *   - 'list'  → stacked rows (tables, feeds, inboxes)
 *   - 'card'  → grid of cards (galleries, hub tiles, dashboards)
 *   - 'panel' → header + body block (detail panes, drawers, editors)
 *
 * Progress variant (`variant="progress"`): a spinner with a live label for
 * long-running work ("Generating presentation…"). Use ONLY when you can name
 * the operation — never a bare "Loading…".
 *
 * Colors use the app CSS token layer (var(--c-*)); light/dark are automatic.
 *
 * @example
 * <LoadingState template="list" rows={6} />
 * <LoadingState template="card" count={4} />
 * <LoadingState variant="progress" label="Generating presentation…" />
 */

import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type LoadingTemplate = 'list' | 'card' | 'panel';

export interface LoadingStateProps {
  /** Skeleton shape. Ignored when `variant="progress"`. */
  template?: LoadingTemplate;
  /** Render mode: content skeleton (default) or labelled progress spinner. */
  variant?: 'skeleton' | 'progress';
  /** Rows for the `list` template. */
  rows?: number;
  /** Cards for the `card` template. */
  count?: number;
  /** Visible/SR label. Required in spirit for `progress` — name the operation. */
  label?: string;
  className?: string;
}

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-token-sm bg-[var(--c-surface-raised)] ${className}`.trim()}
  />
);

const ListSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 rounded-token-md border border-[var(--c-border-subtle)] p-3"
      >
        <Bar className="h-9 w-9 shrink-0 rounded-token-md" />
        <div className="flex-1 space-y-2">
          <Bar className="h-3.5 w-2/5" />
          <Bar className="h-3 w-3/4" />
        </div>
        <Bar className="h-3 w-12 shrink-0" />
      </div>
    ))}
  </div>
);

const CardSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="space-y-3 rounded-token-lg border border-[var(--c-border-subtle)] p-4"
      >
        <Bar className="h-24 w-full rounded-token-md" />
        <Bar className="h-4 w-3/5" />
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-4/5" />
      </div>
    ))}
  </div>
);

const PanelSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Bar className="h-6 w-1/3" />
      <Bar className="h-3.5 w-2/3" />
    </div>
    <div className="space-y-3 rounded-token-lg border border-[var(--c-border-subtle)] p-4">
      <Bar className="h-3.5 w-full" />
      <Bar className="h-3.5 w-11/12" />
      <Bar className="h-3.5 w-4/5" />
      <Bar className="h-3.5 w-3/4" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Bar className="h-20 rounded-token-md" />
      <Bar className="h-20 rounded-token-md" />
    </div>
  </div>
);

export const LoadingState: React.FC<LoadingStateProps> = ({
  template = 'list',
  variant = 'skeleton',
  rows = 5,
  count = 6,
  label,
  className = '',
}) => {
  const { t } = useTranslation();
  const srLabel = label ?? t('common.loading', { defaultValue: 'Loading…' });

  if (variant === 'progress') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`flex flex-col items-center justify-center gap-3 py-16 text-[var(--c-text-muted)] ${className}`.trim()}
      >
        <Loader2 size={28} className="animate-spin text-[var(--c-text-muted)]" aria-hidden />
        <span className="text-sm">{srLabel}</span>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      {template === 'list' && <ListSkeleton rows={rows} />}
      {template === 'card' && <CardSkeleton count={count} />}
      {template === 'panel' && <PanelSkeleton />}
      <span className="sr-only">{srLabel}</span>
    </div>
  );
};

LoadingState.displayName = 'LoadingState';

export default LoadingState;
