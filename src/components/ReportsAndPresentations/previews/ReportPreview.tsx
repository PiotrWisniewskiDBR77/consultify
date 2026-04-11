import React from 'react';

import {
  TrustStatePreviewSection,
  type TrustStatePreviewSectionProps,
} from '../TrustStatePreviewSection';
import type { ReportItem } from '../types';

type ReportPreviewFooterProps = {
  report: ReportItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onExport?: () => Promise<void> | void;
};

type ReportPreviewBodyProps = {
  report: ReportItem;
  trustProps?: TrustStatePreviewSectionProps;
};

export const ReportPreviewBody: React.FC<ReportPreviewBodyProps> = ({ report, trustProps }) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">
      {report.reportType} | {report.status}
    </div>
    <div className="text-sm text-slate-600 dark:text-slate-300">
      Owner: {report.owner}
    </div>
    {trustProps ? <TrustStatePreviewSection {...trustProps} /> : null}
  </div>
);

export const ReportPreviewFooter: React.FC<ReportPreviewFooterProps> = ({
  report,
  onStartReview,
  reviewActionDisabled = false,
  onExport,
}) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">Updated: {report.updatedAt}</div>
    <div className="flex flex-wrap gap-2">
      {onExport && (
        <button onClick={() => void onExport()} className="rounded-md border px-3 py-1 text-xs">
          Export
        </button>
      )}
      {onStartReview && (
        <button
          onClick={() => void onStartReview()}
          disabled={reviewActionDisabled}
          className="rounded-md border px-3 py-1 text-xs disabled:opacity-50"
        >
          Start review
        </button>
      )}
    </div>
  </div>
);
