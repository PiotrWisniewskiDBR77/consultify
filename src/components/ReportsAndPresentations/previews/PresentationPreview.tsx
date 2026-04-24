import React from 'react';

import {
  TrustStatePreviewSection,
  type TrustStatePreviewSectionProps,
} from '../TrustStatePreviewSection';
import type { PresentationItem } from '../types';

type PresentationPreviewFooterProps = {
  presentation: PresentationItem;
  onStartReview?: () => Promise<void>;
  reviewActionDisabled?: boolean;
  onExport?: () => void;
};

type PresentationPreviewBodyProps = {
  presentation: PresentationItem;
  trustProps?: TrustStatePreviewSectionProps;
};

export const PresentationPreviewBody: React.FC<PresentationPreviewBodyProps> = ({
  presentation,
  trustProps,
}) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">
      {presentation.sourceType} | {presentation.status}
    </div>
    <div className="text-sm text-slate-600 dark:text-slate-300">
      Slides: {presentation.slideCount} | Owner: {presentation.owner}
    </div>
    {trustProps ? <TrustStatePreviewSection {...trustProps} /> : null}
  </div>
);

export const PresentationPreviewFooter: React.FC<PresentationPreviewFooterProps> = ({
  presentation,
  onStartReview,
  reviewActionDisabled = false,
  onExport,
}) => (
  <div className="space-y-3">
    <div className="text-xs text-slate-500 dark:text-slate-400">
      Updated: {presentation.updatedAt}
    </div>
    <div className="flex flex-wrap gap-2">
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
