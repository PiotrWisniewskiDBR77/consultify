/**
 * SkeletonState — Content-shaped loading skeleton for ARTIFACT screens (SPEC-A)
 *
 * Where `LoadingState` covers *list* surfaces (SPEC-L: table/feed rows, card
 * grids, side panels), `SkeletonState` covers the four artifact archetypes
 * from `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §3:
 *
 *   - 'table'  → D Matryca (Assessment Session, Table/Spreadsheet, Idea Table)
 *   - 'record' → C Rekord (Initiative, Task, Decision, KPI, Insight, RAID…)
 *   - 'canvas' → A Canvas (Mind Map, Process Flow, Whiteboard, Discovery Tool)
 *   - 'deck'   → E Deck (Presentation)
 *
 * The pulsing shapes are purely decorative and are hidden from the
 * accessibility tree (`aria-hidden`); the region carries exactly ONE textual
 * status (`role="status"`, `aria-live="polite"`, sr-only) so screen readers
 * announce the load once instead of walking every skeleton bar.
 *
 * Colors use the app CSS token layer (var(--c-*)); light/dark are automatic.
 * NEVER use the brand crimson accent token here — this shell is shared across every
 * archetype and brand crimson is reserved for deliberate brand moments.
 *
 * @example
 * <SkeletonState variant="record" />
 * <SkeletonState variant="table" rows={8} columns={5} />
 * <SkeletonState variant="canvas" />
 * <SkeletonState variant="deck" count={6} />
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export type SkeletonVariant = 'table' | 'record' | 'canvas' | 'deck';

export interface SkeletonStateProps {
  /** Archetype shape to render. */
  variant?: SkeletonVariant;
  /** Data rows for the `table` variant. */
  rows?: number;
  /** Columns for the `table` variant. */
  columns?: number;
  /** Slide thumbnails for the `deck` variant. */
  count?: number;
  /** SR-only status label. Defaults to a named "Loading…" — never left bare. */
  label?: string;
  className?: string;
}

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-token-sm bg-[var(--c-surface-raised)] ${className}`.trim()}
  />
);

const TableSkeleton: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-3 border-b border-[var(--c-border-subtle)] pb-2">
      {Array.from({ length: columns }).map((_, i) => (
        <Bar key={i} className={`h-3 ${i === 0 ? 'w-1/4' : 'flex-1'}`} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-3 py-1.5">
        {Array.from({ length: columns }).map((_, c) => (
          <Bar key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
        ))}
      </div>
    ))}
  </div>
);

const RecordSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Menu 1 identity bar — icon + title + status badge */}
    <div className="flex items-center gap-3 border-b border-[var(--c-border-subtle)] pb-4">
      <Bar className="h-8 w-8 shrink-0 rounded-token-md" />
      <Bar className="h-4 w-1/3" />
      <Bar className="ml-auto h-5 w-16 shrink-0 rounded-token-pill" />
    </div>
    {/* Property rows — label + value pairs */}
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Bar className="h-3 w-24 shrink-0" />
          <Bar className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  </div>
);

// Fixed, non-overlapping node positions using Tailwind's arbitrary-position
// utilities — a scattered "nodes + open canvas" impression (mind map /
// whiteboard / process flow), all still purely decorative (aria-hidden).
const CANVAS_NODE_POSITION_CLASSES = [
  'left-[6%] top-[14%] w-28',
  'left-[42%] top-[8%] w-32',
  'left-[70%] top-[36%] w-24',
  'left-[18%] top-[54%] w-24',
  'left-[48%] top-[68%] w-32',
] as const;

const CanvasSkeleton: React.FC = () => (
  <div className="relative h-64 w-full overflow-hidden rounded-token-lg border border-[var(--c-border-subtle)]">
    {CANVAS_NODE_POSITION_CLASSES.map((positionCls, i) => (
      <Bar key={i} className={`absolute h-12 rounded-token-md ${positionCls}`} />
    ))}
  </div>
);

const DeckSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="space-y-4">
    <Bar className="aspect-video w-full rounded-token-lg" />
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <Bar key={i} className="aspect-video rounded-token-sm" />
      ))}
    </div>
  </div>
);

export const SkeletonState: React.FC<SkeletonStateProps> = ({
  variant = 'table',
  rows = 5,
  columns = 4,
  count = 8,
  label,
  className = '',
}) => {
  const { t } = useTranslation();
  const srLabel = label ?? t('common.loading', { defaultValue: 'Loading…' });

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <div aria-hidden="true">
        {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
        {variant === 'record' && <RecordSkeleton />}
        {variant === 'canvas' && <CanvasSkeleton />}
        {variant === 'deck' && <DeckSkeleton count={count} />}
      </div>
      <span className="sr-only">{srLabel}</span>
    </div>
  );
};

SkeletonState.displayName = 'SkeletonState';

export default SkeletonState;
