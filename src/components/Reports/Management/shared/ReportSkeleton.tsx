/**
 * Report loading skeletons
 *
 * Loading-state placeholders for the Management Reports surface:
 *  - `ReportSkeleton`            — full-report fallback (Suspense while a lazy
 *                                   report component loads).
 *  - `ReportHistoryRowSkeleton` — a single history-table row placeholder.
 *
 * Visual language follows the sibling shared components (slate surfaces,
 * `animate-pulse`). No new design tokens are introduced.
 */

import React from 'react';

import { ManagementReportType } from '../../../../types';

const bar = 'rounded bg-slate-200/80 dark:bg-white/[0.08]';

interface ReportSkeletonProps {
  reportType?: ManagementReportType;
}

/** Full-report loading placeholder used as a Suspense fallback. */
export const ReportSkeleton: React.FC<ReportSkeletonProps> = ({ reportType }) => {
  // Portfolio health renders a denser metric grid; everything else is content-first.
  const metricCount = reportType === 'PORTFOLIO_HEALTH' ? 6 : 3;

  return (
    <div className="animate-pulse space-y-6 p-6" role="status" aria-busy="true">
      <div className="space-y-2">
        <div className={`${bar} h-6 w-1/3`} />
        <div className={`${bar} h-4 w-1/2`} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: metricCount }).map((_, i) => (
          <div key={i} className={`${bar} h-24 w-full`} />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${bar} h-4 w-full`} />
        ))}
      </div>

      <span className="sr-only">Loading report…</span>
    </div>
  );
};

/** Single history-table row placeholder. */
export const ReportHistoryRowSkeleton: React.FC = () => (
  <tr className="animate-pulse" role="status" aria-busy="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className={`${bar} h-4 w-full`} />
      </td>
    ))}
  </tr>
);
