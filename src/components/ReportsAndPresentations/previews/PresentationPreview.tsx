import React from 'react';

import type { PresentationItem } from '../types';

type PresentationPreviewFooterProps = {
  presentation: PresentationItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onOpen?: () => void;
  onExport?: () => void;
};

export const PresentationPreviewBody: React.FC<{ presentation: PresentationItem }> = ({
  presentation,
}) => (
  <div className="space-y-3">
    <div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{presentation.title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {presentation.sourceType} | {presentation.status}
      </div>
    </div>
    <div className="text-sm text-slate-600 dark:text-slate-300">
      Slides: {presentation.slideCount} | Owner: {presentation.owner}
    </div>
  </div>
);

export const PresentationPreviewFooter: React.FC<PresentationPreviewFooterProps> = ({
  presentation,
  onStartReview,
  reviewActionDisabled = false,
  onOpen,
  onExport,
}) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">Updated: {presentation.updatedAt}</div>
    <div className="flex flex-wrap gap-2">
      {onOpen && (
        <button onClick={onOpen} className="rounded-md border px-3 py-1 text-xs">
          Open
        </button>
      )}
      {onExport && (
        <button onClick={onExport} className="rounded-md border px-3 py-1 text-xs">
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
