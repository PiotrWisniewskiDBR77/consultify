import React from 'react';

import type { ReportItem } from '../types';

type ReportPreviewFooterProps = {
  report: ReportItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onOpen?: () => void;
  onExport?: () => Promise<void> | void;
};

export const ReportPreviewBody: React.FC<{ report: ReportItem }> = ({ report }) => (
  <div className="space-y-3">
    <div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{report.title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {report.reportType} | {report.status}
      </div>
    </div>
    <div className="text-sm text-slate-600 dark:text-slate-300">
      Owner: {report.owner}
    </div>
  </div>
);

export const ReportPreviewFooter: React.FC<ReportPreviewFooterProps> = ({
  report,
  onStartReview,
  reviewActionDisabled = false,
  onOpen,
  onExport,
}) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">Updated: {report.updatedAt}</div>
    <div className="flex flex-wrap gap-2">
      {onOpen && (
        <button onClick={onOpen} className="rounded-md border px-3 py-1 text-xs">
          Open
        </button>
      )}
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
